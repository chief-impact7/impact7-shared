// attendance-log.js — 출결 이벤트 조회용 정렬·그룹 (순수 함수). 태블릿·DSC 공유.
import { normalizeAttendanceLabel } from './attendance-action.js';

// occurred_at 정렬 — 절대시각(epoch) 우선. 'Z'와 '+09:00' 표기가 섞여도 시각순을 보장하고,
// 파싱 불가 문자열은 뒤로 보내되 그들끼리는 사전순.
const _ts = (v) => {
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
};
function sortByOccurredAt(events) {
  return events
    .map((e) => ({ e, k: _ts(e.occurred_at) }))
    .sort((a, b) => {
      if (a.k != null && b.k != null) return a.k - b.k;
      if (a.k == null && b.k == null) {
        const sa = String(a.e.occurred_at), sb = String(b.e.occurred_at);
        return sa < sb ? -1 : sa > sb ? 1 : 0;
      }
      return a.k != null ? -1 : 1;
    })
    .map((x) => x.e);
}

// 처리순: occurred_at 기준. desc=true면 최신 위.
export function sortByProcessed(events, { desc = true } = {}) {
  const s = sortByOccurredAt(events || []); // sortByOccurredAt은 새 배열 반환 — 입력 비변경
  return desc ? s.reverse() : s;
}

// 등원순: 등원 이벤트만 시각 오름차순 + 해당 학생 지각 여부.
export function arrivalOrder(events, dailyByStudent = {}) {
  return sortByOccurredAt((events || []).filter(e => normalizeAttendanceLabel(e.type) === '등원'))
    .map(e => ({ ...e, late: dailyByStudent[e.student_id]?.attendance?.status === '지각' }));
}

// 귀가순: 하원 이벤트만 시각 오름차순. 구 라벨('귀가')도 표준 정규화로 포함.
export function departureOrder(events) {
  return sortByOccurredAt((events || []).filter(e => normalizeAttendanceLabel(e.type) === '하원'));
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
