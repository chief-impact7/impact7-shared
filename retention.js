// impact7 공유 — 강사별 유지율(리텐션) 귀속 규칙 (SSoT)
//
// 이탈(퇴원·휴원→퇴원)을 강사별로 귀속하고 기간 유지율을 집계한다.
// 핵심 도메인 규칙:
// - 담당 전환 버퍼는 [T, T+14) 반개구간 — 전환일 당일 이탈 포함, 14일째부터 제외.
//   버퍼 안 이탈은 이전·현재 담당 0.5/0.5, 밖은 현재 담당 1.0.
// - 첫 배정(이전 세그먼트 없음)·같은 teacher 재배정은 전환이 아니다 → 현재 담당 1.0.
// - 휴원은 유지 — 세그먼트를 끊지 않고 이벤트도 아니다.
// - 퇴원은 퇴원신청서 작성자(form-author) 귀책 1.0, 교수 매칭 실패 시
//   퇴원일(anchorDate) 기준 버퍼 룰 폴백(uncertain).
import { toDate, formatDateKST, addDays, addMonths, todayKST } from './datetime.js';
import { isSameTeacher } from './teacher-label.js';
import { accountStateAt, accountTypeOf, groupEnrollmentAccounts } from './enrollment-status.js';
import { classSettingsGet, normalizeClassCode } from './class-code.js';
import { enrollmentCode } from './enrollment-derivation.js';

export const RETENTION_BUFFER_DAYS = 14;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const _valid = (d) => typeof d === 'string' && ISO_DATE.test(d);
const _enrollmentKey = (e) => [
  e?.account_id || '',
  accountTypeOf(e),
  e?.class_type || '',
  enrollmentCode(e || {}),
  e?.start_date || '',
  e?.end_date || '',
  e?.naesin_class_override || '',
].join('\0');
const _combinedEnrollments = (current, archived) => {
  const byKey = new Map();
  for (const e of [...(archived || []), ...(current || [])]) {
    if (e && typeof e === 'object') byKey.set(_enrollmentKey(e), e);
  }
  return [...byKey.values()].sort((a, b) => _enrollmentKey(a).localeCompare(_enrollmentKey(b)));
};

const _classRecords = (teacherHistory, classCode) => {
  const code = normalizeClassCode(classCode);
  return (teacherHistory || [])
    .filter((r) => r && normalizeClassCode(r.class_code) === code)
    .map((r) => ({ record: r, date: formatDateKST(toDate(r.changed_at)) }))
    .filter((x) => x.date)
    .sort((a, b) => a.date.localeCompare(b.date));
};

// 반코드의 D 시점 담당. changed_at<=D 최신 레코드 → 첫 레코드 prev_teacher(uncertain)
// → classSettings teacher(uncertain — history는 2026-05-28부터라 과거는 추정) → ''(uncertain)
export function teacherOfClassAt(classCode, dateStr, teacherHistory, classSettings) {
  const records = _classRecords(teacherHistory, classCode);
  if (_valid(dateStr)) {
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].date <= dateStr) {
        return { teacher: records[i].record.teacher || '', uncertain: false };
      }
    }
  }
  if (records.length && records[0].record.prev_teacher) {
    return { teacher: records[0].record.prev_teacher, uncertain: true };
  }
  const setting = classSettingsGet(classSettings, classCode);
  if (setting?.teacher) return { teacher: setting.teacher, uncertain: true };
  return { teacher: '', uncertain: true };
}

// [start,end](null=열린 끝) 정규 조각에서 [ovStart,ovEnd] 교집합을 kind 조각으로 치환
function _overlay(parts, ovStart, ovEnd, ovCode, kind) {
  const out = [];
  for (const p of parts) {
    if (p.kind !== '정규') {
      out.push(p);
      continue;
    }
    const lo = p.start === null || p.start < ovStart ? ovStart : p.start;
    let hi = p.end;
    if (ovEnd !== null && (hi === null || hi > ovEnd)) hi = ovEnd;
    if (hi !== null && lo > hi) {
      out.push(p);
      continue;
    }
    if (p.start === null || p.start < lo) out.push({ ...p, end: addDays(lo, -1) });
    out.push({ ...p, start: lo, end: hi, classCode: ovCode, kind });
    if (hi !== null && (p.end === null || p.end > hi)) {
      out.push({ ...p, start: addDays(hi, 1) });
    }
  }
  return out;
}

// 담당 teacher가 바뀌는 history 시점에서 조각을 분할
function _splitByTeacher(p, teacherHistory, classSettings) {
  if (!p.start) {
    const t = teacherOfClassAt(p.classCode, p.end || todayKST(), teacherHistory, classSettings);
    return [{ ...p, teacher: t.teacher, uncertain: true }];
  }
  const first = teacherOfClassAt(p.classCode, p.start, teacherHistory, classSettings);
  const boundaries = [...new Set(
    _classRecords(teacherHistory, p.classCode)
      .map((x) => x.date)
      .filter((d) => d > p.start && (p.end === null || d <= p.end))
  )];
  const out = [];
  let cur = { start: p.start, teacher: first.teacher, uncertain: !!(p.uncertain || first.uncertain) };
  for (const d of boundaries) {
    const t = teacherOfClassAt(p.classCode, d, teacherHistory, classSettings);
    if (t.teacher === cur.teacher || isSameTeacher(t.teacher, cur.teacher)) continue;
    out.push({ ...p, start: cur.start, end: addDays(d, -1), teacher: cur.teacher, uncertain: cur.uncertain });
    cur = { start: d, teacher: t.teacher, uncertain: !!(p.uncertain || t.uncertain) };
  }
  out.push({ ...p, start: cur.start, end: p.end, teacher: cur.teacher, uncertain: cur.uncertain });
  return out;
}

// 학생의 담당 세그먼트 타임라인. 정규 계정만(특강·기타 제외), 휴원은 세그먼트를 끊지 않음.
// 내신 overlay(naesin_class_override + csKey의 naesin_start/end)·자유학기(자기 코드의
// free_start/end)가 정규 기간을 치환한다. 퇴원생(enrollments 없음)은 fallbackClassCodes로
// 최종 반 세그먼트를 구성한다(uncertain).
export function buildStudentSegments(student, { classSettings, teacherHistory, fallbackClassCodes, archivedEnrollments } = {}) {
  const enrollments = _combinedEnrollments(student?.enrollments, archivedEnrollments);
  const accounts = groupEnrollmentAccounts(enrollments);
  const accountsById = new Map(accounts.map((account) => [account.accountId, account]));
  for (const enrollment of enrollments) {
    if (enrollment.account_id && ['내신', '자유학기'].includes(enrollment.class_type) && !enrollmentCode(enrollment)) {
      accountsById.get(enrollment.account_id)?.items.push(enrollment);
    }
  }
  const regularAccounts = accounts
    .filter((account) => account.accountType === '정규')
    .sort((a, b) => a.key.localeCompare(b.key));
  const firstReg = _valid(student?.first_registered) ? student.first_registered : null;
  const pieces = [];

  for (const account of regularAccounts) {
    const meta = {
      accountKey: account.key,
      accountId: account.accountId,
      accountType: account.accountType,
    };
    const items = [...account.items].sort((a, b) => _enrollmentKey(a).localeCompare(_enrollmentKey(b)));
    const baseItems = items.filter((e) => !['내신', '자유학기'].includes(e.class_type || ''));
    const explicitOverlays = items.filter((e) => ['내신', '자유학기'].includes(e.class_type));
    const baseOverrides = [...new Set(
      baseItems
        .map((base) => base.naesin_class_override)
        .filter((code) => typeof code === 'string' && code)
    )];
    const baseCodes = [...new Set(baseItems.map(enrollmentCode).filter(Boolean))];
    let parts = baseItems.flatMap((e) => {
      const code = enrollmentCode(e);
      if (!code) return [];
      const start = _valid(e.start_date) ? e.start_date : firstReg;
      return [{
        start,
        end: _valid(e.end_date) ? e.end_date : null,
        classCode: code,
        kind: '정규',
        uncertain: !_valid(e.start_date),
        ...meta,
      }];
    });
    const overlays = explicitOverlays.flatMap((e) => {
      const code = enrollmentCode(e)
        || (e.class_type === '내신' && baseOverrides.length === 1 ? baseOverrides[0] : '')
        || (e.class_type === '자유학기' && baseCodes.length === 1 ? baseCodes[0] : '');
      const cs = classSettingsGet(classSettings, code);
      let start = e.start_date;
      let end = e.end_date;
      if (!_valid(start)) start = e.class_type === '내신' ? cs?.naesin_start : cs?.free_start;
      if (!_valid(end)) end = e.class_type === '내신' ? cs?.naesin_end : cs?.free_end;
      return code && _valid(start)
        ? [{ start, end: _valid(end) ? end : null, code, kind: e.class_type }]
        : [];
    });
    if (!overlays.some((e) => e.kind === '내신')) {
      for (const e of baseItems) {
        const code = typeof e.naesin_class_override === 'string' ? e.naesin_class_override : '';
        const cs = classSettingsGet(classSettings, code);
        if (code && _valid(cs?.naesin_start) && _valid(cs?.naesin_end)) {
          overlays.push({ start: cs.naesin_start, end: cs.naesin_end, code, kind: '내신' });
        }
      }
    }
    if (!overlays.some((e) => e.kind === '자유학기')) {
      for (const e of baseItems) {
        const code = enrollmentCode(e);
        const cs = classSettingsGet(classSettings, code);
        if (code && _valid(cs?.free_start) && _valid(cs?.free_end)) {
          overlays.push({ start: cs.free_start, end: cs.free_end, code, kind: '자유학기' });
        }
      }
    }
    for (const overlay of overlays.sort((a, b) =>
      (a.kind === '내신' ? 0 : 1) - (b.kind === '내신' ? 0 : 1)
      || a.start.localeCompare(b.start)
      || a.code.localeCompare(b.code)
    )) {
      parts = _overlay(parts, overlay.start, overlay.end, overlay.code, overlay.kind);
    }
    if (!parts.length) {
      parts = explicitOverlays.flatMap((e) => {
        const code = enrollmentCode(e);
        return code
          ? [{
              start: _valid(e.start_date) ? e.start_date : firstReg,
              end: _valid(e.end_date) ? e.end_date : null,
              classCode: code,
              kind: e.class_type,
              uncertain: !_valid(e.start_date),
              ...meta,
            }]
          : [];
      });
    }
    pieces.push(...parts);
  }

  if (!pieces.length && Array.isArray(fallbackClassCodes)) {
    const end = _valid(student?.withdrawal_date) ? addDays(student.withdrawal_date, -1) : null;
    for (const code of fallbackClassCodes) {
      if (!code) continue;
      pieces.push({
        start: firstReg,
        end,
        classCode: code,
        kind: '정규',
        uncertain: true,
        accountKey: `legacy:정규:${normalizeClassCode(code)}`,
        accountId: null,
        accountType: '정규',
      });
    }
  }

  return pieces
    .flatMap((p) => _splitByTeacher(p, teacherHistory, classSettings))
    .sort((a, b) =>
      (a.start || '').localeCompare(b.start || '')
      || a.accountKey.localeCompare(b.accountKey)
      || (a.end || '').localeCompare(b.end || '')
      || a.classCode.localeCompare(b.classCode)
    );
}

// groupLeaveCycles 결과 + 학생 문서 → 이탈 이벤트. 휴원 진입·복귀·종강·상담은 이벤트 아님.
export function churnEventsForStudent(student, cycles, { archivedEnrollments, today = todayKST() } = {}) {
  const events = new Map();
  const accounts = groupEnrollmentAccounts(
    _combinedEnrollments(student?.enrollments, archivedEnrollments)
  );
  const addEvent = (event) => {
    const scope = event.accountKey || event.accountId || '';
    const key = scope ? `${scope}\0${event.date}` : event.date;
    const current = events.get(key);
    if (!current || (current.type === 'withdraw' && event.type === 'leave_to_withdraw')) {
      events.set(key, event);
    }
  };
  const scopeFor = (accountId, accountType, date) => {
    const target = accountId
      ? accounts.find((account) => account.key === accountId || account.accountId === accountId)
      : null;
    const type = accountType || target?.accountType || '';
    if (type && type !== '정규') return null;
    const otherRegularActive = accountId && accounts.some((account) =>
      account.accountType === '정규'
      && account.key !== accountId
      && account.accountId !== accountId
      && ['활성', '휴원'].includes(accountStateAt(account, date))
    );
    if (otherRegularActive) return null;
    return accountId
      ? {
          accountKey: accountId,
          accountId: target?.accountId ?? (accountId.startsWith('legacy:') ? null : accountId),
          accountType: type || '정규',
        }
      : {};
  };
  let sawExitCycle = false;
  for (const cycle of cycles || []) {
    if (!cycle) continue;
    if (cycle.type !== 'withdraw' && cycle.type !== 'leave_to_withdraw') continue;
    sawExitCycle = true;
    const date = cycle.withdrawalDate || student?.withdrawal_date || null;
    if (!_valid(date) || date > today) continue;
    const scope = scopeFor(cycle.account_id, cycle.account_type, date);
    if (!scope) continue;
    const withdrawalRequest = cycle.requests?.at(-1);
    addEvent({
      type: cycle.type,
      date,
      anchorDate: date,
      formAuthor: withdrawalRequest?.requested_by || '',
      ...(cycle.type === 'leave_to_withdraw' && cycle.subType ? { subType: cycle.subType } : {}),
      ...scope,
    });
  }

  for (const account of accounts) {
    if (account.accountType !== '정규' || !account.items.some((item) => item?.end_reason === '퇴원')) {
      continue;
    }
    const endDate = account.items
      .map((item) => item?.end_date)
      .filter(_valid)
      .sort()
      .at(-1);
    const date = endDate ? addDays(endDate, 1) : '';
    if (!date || date > today) continue;
    const scope = scopeFor(account.key, account.accountType, date);
    if (scope) addEvent({ type: 'withdraw', date, anchorDate: date, ...scope });
  }

  // leave_requests가 누락된 퇴원생 — 학생 문서만으로 1건 보강
  if (
    !sawExitCycle
    && events.size === 0
    && student?.status === '퇴원'
    && _valid(student?.withdrawal_date)
    && student.withdrawal_date <= today
  ) {
    addEvent({ type: 'withdraw', date: student.withdrawal_date, anchorDate: student.withdrawal_date });
  }
  return [...events.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
    || (a.accountKey || '').localeCompare(b.accountKey || '')
    || a.type.localeCompare(b.type)
  );
}

function _attributeByBuffer(anchorDate, segments, bufferDays) {
  const list = segments || [];
  let i = -1;
  if (_valid(anchorDate)) {
    for (let j = list.length - 1; j >= 0; j--) {
      const s = list[j];
      if (s && (!s.start || s.start <= anchorDate) && (s.end == null || anchorDate <= s.end)) {
        i = j;
        break;
      }
    }
    if (i < 0) {
      const previousDay = addDays(anchorDate, -1);
      for (let j = list.length - 1; j >= 0; j--) {
        if (list[j]?.end === previousDay) {
          i = j;
          break;
        }
      }
    }
  }
  if (i < 0) return [{ teacher: '', weight: 1, rule: 'unknown', uncertain: true }];
  const S = list[i];
  const prev = i > 0
    ? [...list.slice(0, i)].reverse().find((s) => !S.accountKey || s.accountKey === S.accountKey) || null
    : null;
  // 버퍼 [T, T+14) 반개구간 — 전환일 당일 포함, 14일째는 밖
  const inBuffer = !!S.start && anchorDate < addDays(S.start, bufferDays);
  if (prev?.teacher && S.teacher && !isSameTeacher(prev.teacher, S.teacher) && inBuffer) {
    const unc = !!(S.uncertain || prev.uncertain);
    return [
      { teacher: prev.teacher, weight: 0.5, rule: 'buffer-split', ...(unc ? { uncertain: true } : {}) },
      { teacher: S.teacher, weight: 0.5, rule: 'buffer-split', ...(unc ? { uncertain: true } : {}) },
    ];
  }
  return [{ teacher: S.teacher || '', weight: 1, rule: 'current', ...(S.uncertain ? { uncertain: true } : {}) }];
}

// 이벤트 1건 귀속 — 반환 가중치 합 1.0.
export function attributeEvent(event, segments, { bufferDays = RETENTION_BUFFER_DAYS, teacherEmails } = {}) {
  if (!event) return [{ teacher: '', weight: 1, rule: 'unknown', uncertain: true }];
  const scopedSegments = event.accountKey
    ? (segments || []).filter((s) =>
        s?.accountKey === event.accountKey
        || (event.accountId && s?.accountId === event.accountId)
      )
    : segments;
  if ((event.type === 'withdraw' || event.type === 'leave_to_withdraw') && Object.hasOwn(event, 'formAuthor')) {
    const author = event.formAuthor || '';
    const emails = teacherEmails instanceof Set ? [...teacherEmails] : teacherEmails || [];
    if (author && emails.some((t) => isSameTeacher(author, t))) {
      return [{ teacher: author, weight: 1, rule: 'form-author' }];
    }
    return _attributeByBuffer(event.anchorDate || event.date, scopedSegments, bufferDays).map((a) => ({ ...a, uncertain: true }));
  }
  return _attributeByBuffer(event.anchorDate || event.date, scopedSegments, bufferDays);
}

// 기간 해석. month: 해당 월 [1일, 말일]. semester: semester_settings 시작일 ~
// 같은 학부 다음 학기 시작 전일 (마지막 학기면 오늘).
export function periodRange(period, semesterSettings) {
  if (period?.type === 'month' && /^\d{4}-(0[1-9]|1[0-2])$/.test(period.value || '')) {
    const next = addMonths(period.value, 1);
    return { start: `${period.value}-01`, end: addDays(`${next}-01`, -1) };
  }
  if (period?.type === 'semester' && period.level) {
    const m = /^(\d{4})-(.+)$/.exec(period.value || '');
    if (m) {
      const key = `${period.level}-${m[1]}-${m[2].toLowerCase()}`;
      const start = (semesterSettings || {})[key]?.start_date;
      if (_valid(start)) {
        let nextStart = null;
        for (const [k, v] of Object.entries(semesterSettings || {})) {
          if (!k.startsWith(`${period.level}-`)) continue;
          const s = v?.start_date;
          if (_valid(s) && s > start && (nextStart === null || s < nextStart)) nextStart = s;
        }
        return { start, end: nextStart ? addDays(nextStart, -1) : todayKST() };
      }
    }
  }
  return { start: null, end: null };
}

// 집계. exposed(분모) = 기간과 겹치는 teacher 세그먼트의 학생-account 노출 수,
// churn(분자) = 기간 내 이벤트 귀속 가중 합. attributionsByStudent는 수동 override가
// 이미 반영된 최종본 — Map 또는 plain object 모두 허용.
export function aggregateRetention({ studentIds, segmentsByStudent, attributionsByStudent, range } = {}) {
  const acc = {};
  const keyCache = new Map();
  // 구(@gw)·신 도메인 이메일이 강사 행을 쪼개지 않도록 첫 등장 키로 병합
  const rowFor = (email) => {
    const raw = email || '';
    let key = keyCache.get(raw);
    if (key === undefined) {
      key = Object.keys(acc).find((k) => isSameTeacher(k, raw)) ?? raw;
      keyCache.set(raw, key);
    }
    if (!acc[key]) acc[key] = { exposedSet: new Set(), churn: 0, events: [] };
    return acc[key];
  };
  const get = (coll, k) => (coll instanceof Map ? coll.get(k) : coll?.[k]);
  const { start, end } = range || {};

  for (const sid of studentIds || []) {
    const entries = get(attributionsByStudent, sid) || [];
    const eventsInRange = entries
      .map((entry) => entry?.event)
      .filter((event) =>
        event?.date
        && (!start || event.date >= start)
        && (!end || event.date <= end)
      );
    for (const seg of get(segmentsByStudent, sid) || []) {
      if (!seg) continue;
      const overlaps =
        (seg.end == null || !start || seg.end >= start) &&
        (seg.start == null || !end || seg.start <= end);
      const exitsAtBoundary = eventsInRange.some((event) => {
        const scope = event.accountKey || event.accountId;
        return seg.end === addDays(event.date, -1)
          && (!scope || seg.accountKey === scope || seg.accountId === scope);
      });
      if (overlaps || exitsAtBoundary) {
        const exposureKey = seg.accountKey ? `${sid}\0${seg.accountKey}` : sid;
        rowFor(seg.teacher).exposedSet.add(exposureKey);
      }
    }
    for (const entry of entries) {
      const date = entry?.event?.date;
      if (!date || (start && date < start) || (end && date > end)) continue;
      for (const a of entry.attribution || []) {
        const row = rowFor(a.teacher);
        row.churn += a.weight || 0;
        row.events.push({ studentId: sid, event: entry.event, weight: a.weight || 0, rule: a.rule });
      }
    }
  }

  const byTeacher = {};
  for (const [key, row] of Object.entries(acc)) {
    const exposed = row.exposedSet.size;
    byTeacher[key] = {
      exposed,
      churn: row.churn,
      retentionRate: exposed > 0 ? Math.max(0, 1 - row.churn / exposed) : null,
      events: row.events,
    };
  }
  return { byTeacher };
}
