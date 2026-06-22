// enrollment-derivation.js — 내신/자유학기 기간 파생 (단일 소스).
// 정규(또는 자유학기) enrollment를 class_settings의 활성 내신/자유학기 기간에 따라
// 파생된 내신/자유학기 enrollment로 치환한다. DB·DSC가 동일 로직을 공유한다.
//
// 입력 current: 이미 날짜 필터링(미시작·종료 제외)이 끝난 활성 enrollment 배열.
//   (각 앱의 날짜 필터링 방식은 다르므로 그 부분은 호출자가 담당)
// deps:
//   - classSettings: { [csKey]: { naesin_start, naesin_end, schedule, free_start, free_end, free_schedule } }
//   - dateStr: 기준일 'YYYY-MM-DD'
//   - resolveNaesinCsKey(regularEnroll): 내신 csKey 또는 null
//       (override 우선, 앱별 자동 유도는 앱이 주입. null이면 내신 대상 아님)
//   - enrollmentCode(enrollment): level_symbol+class_number 등 반코드 문자열
//
// 우선순위: 내신(기간 활성) > 자유학기(기간 활성) > 그대로. 내신/자유학기가 활성이면 정규를 숨긴다.
const _validDate = (d) => !!d && /^\d{4}-/.test(d);

// 반코드 문자열: level_symbol+class_number (예: HA + 101 → 'HA101').
export function enrollmentCode(e) {
  return `${e.level_symbol || ''}${e.class_number || ''}`;
}

// 활성 내신 enrollment(명시적 내신 또는 정규+override→class_settings 기간 파생) 또는 null.
// applyNaesinFreeDerivation과 isNaesinActiveAt가 공유하는 단일 판정(SSoT) — 로컬 재구현 금지.
// current는 호출자가 날짜 필터(미시작·종료 제외)한 활성 enrollment 배열이어야 한다.
export function deriveActiveNaesinEnrollment(current, { classSettings, dateStr, resolveNaesinCsKey }) {
  const today = dateStr;
  const cs = classSettings || {};
  const explicit = current.find(e =>
    e.class_type === '내신' && _validDate(e.start_date) && e.start_date <= today);
  if (explicit) return explicit;
  const regularEnroll = current.find(e => (e.class_type === '정규' || e.class_type === '자유학기') && e.class_number);
  if (!regularEnroll) return null;
  const csKey = resolveNaesinCsKey(regularEnroll);
  if (!csKey) return null;
  const c = cs[csKey];
  if (!c?.naesin_start || !c?.naesin_end) return null;
  if (c.naesin_start > today || c.naesin_end < today) return null;
  // 학생 개별 override: naesin_days(요일)·naesin_schedule(요일별 시간)가 반 기본을 덮는다.
  const studentDays = Array.isArray(regularEnroll.naesin_days) && regularEnroll.naesin_days.length > 0
    ? regularEnroll.naesin_days
    : Object.keys(c.schedule || {});
  return {
    class_type: '내신',
    level_symbol: '',
    class_number: csKey,
    day: studentDays,
    schedule: { ...(c.schedule || {}), ...(regularEnroll.naesin_schedule || {}) },
    start_date: c.naesin_start,
    end_date: c.naesin_end,
  };
}

// 기준일에 내신기간이 활성인가(boolean). 등원일정 파생(applyNaesinFreeDerivation)과
// 동일 판정을 공유하므로 '내신 라벨'과 '파생 등원일정'이 항상 일치한다.
export function isNaesinActiveAt(current, { classSettings, dateStr, resolveNaesinCsKey }) {
  return !!deriveActiveNaesinEnrollment(current, { classSettings, dateStr, resolveNaesinCsKey });
}

export function applyNaesinFreeDerivation(current, { classSettings, dateStr, resolveNaesinCsKey, enrollmentCode: code = enrollmentCode }) {
  const today = dateStr;
  const cs = classSettings || {};
  const regularEnroll = current.find(e => (e.class_type === '정규' || e.class_type === '자유학기') && e.class_number);

  // 1) 내신: 명시적 내신 enrollment 또는 정규+override→class_settings 내신기간 파생 (SSoT 공유)
  const activeNaesin = deriveActiveNaesinEnrollment(current, { classSettings: cs, dateStr: today, resolveNaesinCsKey });
  if (activeNaesin) {
    const nonRegular = current.filter(e => !['정규', '자유학기', ''].includes(e.class_type || ''));
    return [activeNaesin, ...nonRegular.filter(e => e !== activeNaesin)];
  }

  // 2) 자유학기: 명시적 자유학기 또는 정규 반코드의 class_settings 자유학기 기간 파생
  const activeFree = (() => {
    const explicit = current.find(e =>
      e.class_type === '자유학기' && _validDate(e.start_date) && e.start_date <= today);
    if (explicit) return explicit;
    if (!regularEnroll) return null;
    const csKey = code(regularEnroll);
    const c = cs[csKey];
    if (!c?.free_start || !c?.free_end) return null;
    if (c.free_start > today || c.free_end < today) return null;
    return {
      class_type: '자유학기',
      level_symbol: regularEnroll.level_symbol || '',
      class_number: regularEnroll.class_number || '',
      day: Object.keys(c.free_schedule || {}),
      schedule: c.free_schedule || {},
      start_date: c.free_start,
      end_date: c.free_end,
    };
  })();
  if (activeFree) {
    const freeCode = code(activeFree);
    return [
      activeFree,
      ...current.filter(e => e.class_type !== '정규' || code(e) !== freeCode)
        .filter(e => e !== activeFree),
    ];
  }

  return current;
}

// 수업이력용: override 기반 내신/자유학기를 "수업이력 항목"으로 파생한다.
// history_logs에 로그가 없는 override 케이스(예: 마법사 표준 정규+naesin_class_override)를
// 수업이력에 노출하기 위함. 명시적 class_type='내신'/'자유학기' enrollment가 있으면 그쪽이
// 로그로 표현되므로 파생하지 않는다(중복 방지).
// 반환: [{ class_type:'내신'|'자유학기', code, start_date, end_date }]
// (호출자가 표시 코드 포맷·로그 중복 dedup·정렬을 담당)
export function deriveClassPeriodHistory(enrollments, classSettings, { enrollmentCode: code = enrollmentCode } = {}) {
  const list = enrollments || [];
  const cs = classSettings || {};
  const entries = [];

  const hasExplicitNaesin = list.some(e => e.class_type === '내신');
  const hasExplicitFree = list.some(e => e.class_type === '자유학기');

  for (const e of list) {
    if (e.class_type !== '정규' && e.class_type !== '자유학기') continue;

    // 내신: 정규+override(빈 문자열 제외) → class_settings 내신기간
    if (!hasExplicitNaesin) {
      const override = e.naesin_class_override;
      if (typeof override === 'string' && override !== '') {
        const c = cs[override];
        if (c?.naesin_start && c?.naesin_end) {
          entries.push({ class_type: '내신', code: override, start_date: c.naesin_start, end_date: c.naesin_end });
        }
      }
    }

    // 자유학기: 정규 반코드 → class_settings 자유학기 기간
    if (!hasExplicitFree && e.class_type === '정규') {
      const csKey = code(e);
      const c = cs[csKey];
      if (c?.free_start && c?.free_end) {
        entries.push({ class_type: '자유학기', code: csKey, start_date: c.free_start, end_date: c.free_end });
      }
    }
  }
  return entries;
}

// 레벨기간 — 현재 수강 중인 반/레벨의 시작일과 경과기간.
// enrollment.start_date 중 가장 이른 유효일 기준(복귀 시 리셋됨).
// 이력 기반 재원기간(history deriveTenure)과는 다른 값이다.
// 반환: { start: 'YYYY-MM-DD'|null, label: '14일'|'3개월'|'1년 2개월'|'등원예정'|'—' }
export function deriveLevelPeriod(enrollments, todayStr) {
  const starts = (enrollments || [])
    .map(e => e?.start_date)
    .filter(d => d && d !== '?' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= '2020-01-01')
    .sort();
  if (!starts.length) return { start: null, label: '—' };
  const start = starts[0];
  const startD = new Date(start + 'T00:00:00+09:00');
  const today = new Date((todayStr || '') + 'T00:00:00+09:00');
  if (isNaN(today.getTime())) return { start, label: '—' };
  const diffDays = Math.floor((today - startD) / 86400000);
  if (diffDays < 0) return { start, label: '등원예정' };
  const totalMonths = (today.getFullYear() - startD.getFullYear()) * 12 + (today.getMonth() - startD.getMonth());
  if (totalMonths < 1) return { start, label: `${diffDays}일` };
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const label = years > 0 ? `${years}년${months > 0 ? ' ' + months + '개월' : ''}` : `${totalMonths}개월`;
  return { start, label };
}
