// impact7 공유 — 직원 인사 날짜 → 유효 상태 파생 (SSoT)
//
// 소비자: impact7HR(직원 현황 표시), impact7DB functions(태블릿 staffCheckin, bulkMessage).
// 규칙:
// - 종무일(lastWorkDate)은 당일까지 재직, 익일부터 퇴직.
// - 퇴사일·퇴사예정일은 첫 비고용일 — 당일부터 퇴직.
// - 날짜순 상태 전이: from 검사는 고정 base가 아닌 직전 파생 상태에 적용해
//   휴직→복직처럼 앞선 규칙이 만든 상태에서 이어지는 규칙이 걸린다.
// - 퇴사 기록보다 늦은 입사 계열 날짜는 재입사로 되살린다. 퇴사 날짜 없는
//   수동 terminated는 유지하고, returnDate로는 퇴직을 되살릴 수 없다.
// - today는 필수 — 달력일(todayKST)과 영업일(businessDayKST 06시 경계)의 선택은
//   호출자의 도메인 결정이므로 기본값으로 가리지 않는다.
// - HR 원본과의 의도적 편차: status가 빈 문자열인 퇴화 문서는 active 기준으로 파생한다
//   (구 서버 의미론 — HR의 `?? 'active'`는 ''를 통과시켰음).

/** @typedef {{ type?: unknown, date?: unknown }} PersonnelDateInput */
/** @typedef {Record<string, unknown> & { status?: unknown, personnelDates?: PersonnelDateInput[] }} StaffLike */
/** @typedef {{ status: string, priority: number, from: string[] }} StatusRule */
/** @typedef {{ type: string, date: string }} PersonnelDate */
/** @typedef {PersonnelDate & StatusRule} StatusChange */

/** @param {unknown} v */
const textOf = (v) => String(v ?? '').trim();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** @type {Record<string, StatusRule>} */
const AUTO_STATUS_BY_DATE_TYPE = {
  joinDate: { status: 'active', priority: 1, from: ['onboarding', 'join_pending', 'active'] },
  plannedJoinDate: { status: 'active', priority: 1, from: ['onboarding', 'join_pending', 'active'] },
  firstWorkDate: { status: 'active', priority: 1, from: ['onboarding', 'join_pending', 'active'] },
  returnDate: { status: 'active', priority: 1, from: ['inactive', 'leave_pending'] },
  leaveDate: { status: 'inactive', priority: 2, from: ['active', 'leave_pending'] },
  plannedResignationDate: { status: 'terminated', priority: 3, from: ['active', 'inactive', 'leave_pending'] },
  resignationDate: { status: 'terminated', priority: 3, from: ['active', 'inactive', 'leave_pending'] },
  lastWorkDate: { status: 'terminated', priority: 3, from: ['active', 'inactive', 'leave_pending'] },
};

const REJOIN_TYPES = new Set(['joinDate', 'plannedJoinDate', 'firstWorkDate']);
const CANCELLED_STATUSES = new Set(['join_cancelled', 'leave_cancelled']);

// 병합·dedupe 대상 known 타입 — 파생에 안 쓰는 interviewDate·other도 포함해
// HR 편집 화면이 같은 병합 결과를 쓰게 한다.
const KNOWN_TYPES = [
  'joinDate',
  'resignationDate',
  'plannedJoinDate',
  'plannedResignationDate',
  'leaveDate',
  'returnDate',
  'firstWorkDate',
  'lastWorkDate',
  'other',
  'interviewDate',
];
const KNOWN_TYPE_SET = new Set(KNOWN_TYPES);
// legacy 최상위 필드로 존재했던 타입만 — 'other'는 최상위 날짜 필드였던 적이 없다.
const LEGACY_FIELD_TYPES = KNOWN_TYPES.filter((type) => type !== 'other');

// personnelDates 배열 + legacy 최상위 필드 병합 — 같은 타입은 personnelDates가 우선,
// known 타입은 하나로 dedupe, 알 수 없는 타입 항목은 그대로 보존한다. 정렬 없음(UI는 별도 정렬).
/**
 * @param {StaffLike} staff
 * @returns {PersonnelDate[]}
 */
export function mergePersonnelDates(staff) {
  const existing = Array.isArray(staff?.personnelDates) ? staff.personnelDates : [];
  const records = existing
    .map((record) => ({ type: textOf(record?.type), date: textOf(record?.date) }))
    .filter((record) => record.type && record.date);
  const map = new Map(records.map((record) => [record.type, record.date]));
  for (const type of LEGACY_FIELD_TYPES) {
    const value = textOf(staff?.[type]);
    if (value && !map.get(type)) map.set(type, value);
  }
  const known = KNOWN_TYPES
    .map((type) => ({ type, date: map.get(type) ?? '' }))
    .filter((record) => record.date);
  const preserved = records.filter((record) => !KNOWN_TYPE_SET.has(record.type));
  return [...known, ...preserved];
}

/**
 * @param {PersonnelDate[]} records
 * @param {string} current
 * @param {string} today
 */
export function autoStatusFromPersonnelDates(records, current, today) {
  // today 생략·비문자열은 조용한 오판(미래 가드 무력화) 대신 시끄럽게 실패시킨다
  if (typeof today !== 'string' || !ISO_DATE.test(today)) {
    throw new TypeError('today는 YYYY-MM-DD 문자열이어야 합니다');
  }
  if (CANCELLED_STATUSES.has(current)) return current;
  /** @type {StatusChange[]} */
  const changes = [];
  for (const record of records) {
    const date = record?.date;
    // 형식 불일치 날짜는 사전식 비교가 오판하므로 무시한다 (datetime.js addDays와 동일 가드)
    if (typeof date !== 'string' || !ISO_DATE.test(date) || date > today) continue;
    // 종무일은 마지막 근무일 — 당일까지 재직, 익일부터 퇴직
    if (record.type === 'lastWorkDate' && date === today) continue;
    // hasOwn 가드 — 'constructor' 같은 프로토타입 키가 규칙으로 오인되지 않게
    if (!Object.hasOwn(AUTO_STATUS_BY_DATE_TYPE, record.type)) continue;
    changes.push({ date, type: record.type, ...AUTO_STATUS_BY_DATE_TYPE[record.type] });
  }
  changes.sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority);
  let status = current;
  let sawTerminate = false;
  for (const change of changes) {
    const rehire = sawTerminate && status === 'terminated' && REJOIN_TYPES.has(change.type);
    if (change.status === 'terminated') sawTerminate = true;
    if (!change.from.includes(status) && !rehire) continue;
    status = change.status;
  }
  // 미래 입사예정일이 잡힌 온보딩 직원은 입사예정으로 파생
  if (
    status === 'onboarding' &&
    records.some(
      (record) =>
        record?.type === 'plannedJoinDate' &&
        typeof record.date === 'string' &&
        ISO_DATE.test(record.date) &&
        record.date > today
    )
  ) {
    return 'join_pending';
  }
  return status;
}

// staff 문서 → today 기준 유효 상태. leave_pending(폐기 용어)은 재직으로 정규화.
/**
 * @param {StaffLike} staff
 * @param {string} today
 */
export function effectiveStaffStatus(staff, today) {
  const raw = textOf(staff?.status) || 'active';
  const base = raw === 'leave_pending' ? 'active' : raw;
  return autoStatusFromPersonnelDates(mergePersonnelDates(staff), base, today);
}
