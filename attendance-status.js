// 출결 결과 상태(출석·지각·조퇴·결석) 집합 SSoT.
// 출결 액션(등원·외출·귀원·하원, ./attendance-action)과는 다른 축 — 이건 '결과 상태'.
// 소비자: 태블릿 서버 checkinHandler 등 출결 판정부.

export const ATTENDANCE_STATUSES = new Set(['출석', '지각', '조퇴', '결석']);

// 도착 시각을 기록하는 상태(등원 시점 의미가 있는 것만) — 출석·지각.
export const ARRIVAL_STATUSES = new Set(['출석', '지각']);
