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

export function applyNaesinFreeDerivation(current, { classSettings, dateStr, resolveNaesinCsKey, enrollmentCode }) {
  const today = dateStr;
  const cs = classSettings || {};
  const regularEnroll = current.find(e => (e.class_type === '정규' || e.class_type === '자유학기') && e.class_number);

  // 1) 내신: 명시적 내신 enrollment 또는 정규+override→class_settings 내신기간 파생
  const activeNaesin = (() => {
    const explicit = current.find(e =>
      e.class_type === '내신' && _validDate(e.start_date) && e.start_date <= today);
    if (explicit) return explicit;
    if (!regularEnroll) return null;
    const csKey = resolveNaesinCsKey(regularEnroll);
    if (!csKey) return null;
    const c = cs[csKey];
    if (!c?.naesin_start || !c?.naesin_end) return null;
    if (c.naesin_start > today || c.naesin_end < today) return null;
    return {
      class_type: '내신',
      level_symbol: '',
      class_number: csKey,
      day: Object.keys(c.schedule || {}),
      schedule: c.schedule || {},
      start_date: c.naesin_start,
      end_date: c.naesin_end,
    };
  })();
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
    const code = enrollmentCode(regularEnroll);
    const c = cs[code];
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
    const freeCode = enrollmentCode(activeFree);
    return [
      activeFree,
      ...current.filter(e => e.class_type !== '정규' || enrollmentCode(e) !== freeCode)
        .filter(e => e !== activeFree),
    ];
  }

  return current;
}
