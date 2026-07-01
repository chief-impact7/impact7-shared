// attendance-log.js — 출결 이벤트 조회용 정렬·그룹 (순수 함수). 태블릿·DSC 공유.
const cmp = (a, b) => String(a).localeCompare(String(b));

// 처리순: occurred_at 기준. desc=true면 최신 위.
export function sortByProcessed(events, { desc = true } = {}) {
  const s = [...(events || [])].sort((a, b) => cmp(a.occurred_at, b.occurred_at));
  return desc ? s.reverse() : s;
}

// 등원순: 등원 이벤트만 시각 오름차순 + 해당 학생 지각 여부.
export function arrivalOrder(events, dailyByStudent = {}) {
  return (events || [])
    .filter(e => e.type === '등원')
    .sort((a, b) => cmp(a.occurred_at, b.occurred_at))
    .map(e => ({ ...e, late: dailyByStudent[e.student_id]?.attendance?.status === '지각' }));
}

// 귀가순: 하원 이벤트만 시각 오름차순.
export function departureOrder(events) {
  return (events || []).filter(e => e.type === '하원').sort((a, b) => cmp(a.occurred_at, b.occurred_at));
}

// 상태별: day_state로 그룹. daily 없거나 미등원이면 '미등원'.
const STATES = ['미등원', '원내', '외출중', '하원'];
export function groupByState(students, dailyByStudent = {}) {
  const groups = { 미등원: [], 원내: [], 외출중: [], 하원: [] };
  for (const s of (students || [])) {
    const state = dailyByStudent[s.student_id]?.day_state;
    (groups[STATES.includes(state) ? state : '미등원']).push(s);
  }
  return groups;
}
