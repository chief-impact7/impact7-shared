// class-review.js — 반을 만든 뒤 무엇이 이상한지 찾는다 (단일 소스).
//
// 반 생성 마법사는 저장 직전에 confirm으로 두 가지만 묻는다. 나머지는 통과한 뒤에야 드러난다
// (내신 기간 중인 학생을 정규로만 넣어 내신이 안 잡힌 사고가 실제로 있었다).
// 그래서 "막는 것"과 별개로 "만든 뒤 훑어보는 것"이 필요하다. 서버(어시스턴트)와
// 클라(생성 직후 화면)가 같은 판정을 써야 하므로 여기 둔다.
//
// 순수 함수다 — DB를 읽지 않는다. 호출자가 데이터를 모아 넘긴다.
import { enrollmentCode } from './enrollment-derivation.js';

// 심각도: block은 사람이 반드시 봐야 하는 것, warn은 확인하면 좋은 것.
export const SEVERITY = { block: 'block', warn: 'warn' };

const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일'];

// class_settings의 요일별 시각. 유형마다 필드가 달라 여기서 하나로 모은다.
export function classTimesByDay(settings) {
  const s = settings ?? {};
  if (s.free_schedule) return { ...s.free_schedule };
  if (s.schedule) return { ...s.schedule };
  if (s.default_days) {
    return Object.fromEntries((s.default_days ?? []).map((day) => [day, s.default_time ?? '']));
  }
  return {};
}

// "19:00" → 1140. 형식이 아니면 null — 비교하지 않는다(추측이 사고를 만든다).
function minutes(time) {
  const m = String(time ?? '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function activeAt(enrollment, dateStr) {
  const start = enrollment?.start_date;
  const end = enrollment?.end_date;
  if (start && start > dateStr) return false;
  if (end && end < dateStr) return false;
  return true;
}

const finding = (severity, kind, message, students = []) => ({ severity, kind, message, students });

/**
 * 반 하나를 훑어 특이사항을 돌려준다.
 *
 * @param {object} input
 * @param {string} input.classCode        검토할 반 코드 (예: a101)
 * @param {object} input.settings         그 반의 class_settings
 * @param {Array}  input.students         [{ id, name, status, schoolLevel, enrollments }]
 * @param {object} input.otherSettings    { [반코드]: class_settings } — 시간 충돌 판정에 쓴다
 * @param {string} input.today            'YYYY-MM-DD'
 * @returns {Array} findings — 심각한 것부터
 */
export function reviewClass({ classCode, settings, students = [], otherSettings = {}, today }) {
  const code = String(classCode ?? '').toLowerCase();
  const findings = [];
  const times = classTimesByDay(settings);
  const classDays = Object.keys(times).filter((day) => DAY_ORDER.includes(day));

  if (!students.length) {
    findings.push(finding(SEVERITY.block, 'empty', '이 반에 학생이 없습니다.'));
  }
  if (!String(settings?.teacher ?? '').trim()) {
    findings.push(finding(SEVERITY.warn, 'no_teacher', '담당 선생님이 배정되지 않았습니다.'));
  }
  if (!classDays.length) {
    findings.push(finding(SEVERITY.block, 'no_schedule', '수업 요일과 시간이 비어 있습니다.'));
  }
  const missingTime = classDays.filter((day) => !String(times[day] ?? '').trim());
  if (missingTime.length) {
    findings.push(finding(SEVERITY.block, 'missing_time', `${missingTime.join('·')}요일 수업 시간이 비어 있습니다.`));
  }

  // 기간이 이미 끝난 반 — 만들자마자 끝나 있으면 날짜를 잘못 넣은 것이다.
  const end = settings?.naesin_end ?? settings?.free_end ?? settings?.special_end ?? null;
  if (end && today && end < today) {
    findings.push(finding(SEVERITY.block, 'expired', `수업 기간이 ${end}에 끝나 있습니다. 날짜를 확인하세요.`));
  }

  const wrongDays = [];
  const naesinMissing = [];
  const conflicts = [];
  const levels = new Map();

  for (const student of students) {
    const enrollments = (student.enrollments ?? []).filter((e) => activeAt(e, today));
    const mine = enrollments.filter((e) => String(enrollmentCode(e) ?? '').toLowerCase() === code);
    const others = enrollments.filter((e) => String(enrollmentCode(e) ?? '').toLowerCase() !== code);

    if (student.schoolLevel) levels.set(student.schoolLevel, (levels.get(student.schoolLevel) ?? 0) + 1);

    // 학생 등록 요일이 반 요일과 다르면 그 학생만 다른 날 나온다.
    const myDays = [...new Set(mine.flatMap((e) => e.day ?? []))];
    const extra = myDays.filter((day) => !classDays.includes(day));
    const absent = classDays.filter((day) => !myDays.includes(day));
    if (extra.length || absent.length) wrongDays.push(student);

    // 실제 사고: 내신 기간 중인 학생을 정규로만 넣으면 내신이 안 잡힌다.
    const hasNaesinBase = enrollments.some((e) => e.naesin_class_override);
    if (hasNaesinBase && settings?.class_type === '정규' && !mine.some((e) => e.naesin_class_override)) {
      naesinMissing.push(student);
    }

    // 같은 요일·같은 시각에 다른 반에도 들어 있으면 둘 중 하나는 못 온다.
    for (const other of others) {
      const otherTimes = classTimesByDay(otherSettings[String(enrollmentCode(other) ?? '')] ?? {});
      for (const day of other.day ?? []) {
        if (!classDays.includes(day)) continue;
        const a = minutes(times[day]);
        const b = minutes(otherTimes[day]);
        if (a === null || b === null || a !== b) continue;
        conflicts.push({ student, day, code: enrollmentCode(other) });
      }
    }
  }

  if (naesinMissing.length) {
    findings.push(finding(SEVERITY.block, 'naesin_missing',
      '내신 기간 중인 학생을 정규로만 넣었습니다. 내신 반생성마법사로 다시 배정하세요.', naesinMissing));
  }
  if (conflicts.length) {
    const detail = conflicts.map((c) => `${c.student.name ?? c.student.id}(${c.day}·${c.code})`).join(', ');
    findings.push(finding(SEVERITY.block, 'time_conflict',
      `같은 요일 같은 시각에 다른 반에도 등록돼 있습니다: ${detail}`, conflicts.map((c) => c.student)));
  }
  if (wrongDays.length) {
    findings.push(finding(SEVERITY.warn, 'day_mismatch',
      '반 요일과 등록 요일이 다른 학생이 있습니다.', wrongDays));
  }
  if (levels.size > 1) {
    const detail = [...levels.entries()].map(([level, n]) => `${level} ${n}명`).join(', ');
    findings.push(finding(SEVERITY.warn, 'mixed_level', `학부가 섞여 있습니다: ${detail}`));
  }
  return findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === SEVERITY.block ? -1 : 1));
}
