// 출결 액션 표준 용어 (단일 소스). DB·DSC·태블릿이 import.
// key는 알림 템플릿 키(arrival/out/return/departure)와 동일하게 맞춘다.
export const ATTENDANCE_ACTIONS = {
  arrival: '등원',
  out: '외출',
  return: '귀원',
  departure: '하원',
};

// 구 동의어 → 표준. 출결 액션 값에만 적용한다.
// 주의: 일반 텍스트의 '복귀'(휴원/재등원/정규/화면/상담 복귀)·'귀가'에는 절대 쓰지 않는다.
const LABEL_SYNONYMS = { 귀가: '하원', 복귀: '귀원' };

// 출결 액션 라벨을 표준값으로 정규화. 비대상 라벨은 그대로 통과.
export function normalizeAttendanceLabel(label) {
  return LABEL_SYNONYMS[label] || label || '';
}

// key(arrival 등) → 표준 라벨.
export function attendanceLabel(key) {
  return ATTENDANCE_ACTIONS[key] || '';
}

// 라벨(구·신 모두) → key. 매칭 없으면 ''.
const LABEL_TO_KEY = Object.fromEntries(
  Object.entries(ATTENDANCE_ACTIONS).map(([k, v]) => [v, k]),
);
export function attendanceActionKey(label) {
  return LABEL_TO_KEY[normalizeAttendanceLabel(label)] || '';
}
