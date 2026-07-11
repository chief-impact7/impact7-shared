// impact7 공유 — 휴원/퇴원 사이클 묶음 (SSoT)
//
// leave_requests 를 시간순으로 묶어 휴원/퇴원/재등원 카드로 만든다.
// impact7DB(groupLeaveRequestsIntoCycles)와 impact7newDSC(_buildLeaveCycles)가
// 같은 컬렉션을 각자 다르게 묶던 것을 하나로 통일한다.
//
// 정렬은 created_at → requested_at → leave_start_date → withdrawal_date → return_date
// ms 폴백으로 단일화한다 — DB의 leave_start_date 우선 정렬과 DSC의 created_at 우선
// 정렬을 의도적으로 한쪽(생성시각 우선)으로 통일한 동작 변경이다.
//
// endDate는 휴원 사이클에선 휴원 종료일만 담는다 — 복귀일/퇴원일은 returnDate/withdrawalDate로 분리
// (DB 원본의 endDate 덮어쓰기 동작을 의도적으로 폐기).
// 예외: 단독 withdraw/other 카드는 endDate에 해당 날짜를 함께 담는다(소비자 표시 폴백용).
//
// 정렬 동률(같은 sortKey) 시 요청 타입 순서(휴원시작 → 연장 → 복귀 → 퇴원)로 tiebreak —
// 입력(쿼리) 순서에 따라 사이클 묶음이 달라지는 비결정성을 막는다.

import { toDate } from './datetime.js';

// 정렬키 ms 변환 — 입력 파싱은 datetime.js toDate(SSoT)를 재사용.
// 날짜 전용 문자열('YYYY-MM-DD')만 KST 자정으로 별도 처리 — created_at ISO(KST)와 동률·순서 왜곡 방지.
function toMs(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+09:00`).getTime() || 0;
  }
  const d = toDate(value);
  return d ? d.getTime() : 0;
}

export function leaveRequestSortKey(r) {
  if (!r) return 0;
  return (
    toMs(r.created_at) ||
    toMs(r.requested_at) ||
    toMs(r.leave_start_date) ||
    toMs(r.withdrawal_date) ||
    toMs(r.return_date) ||
    0
  );
}

const LEAVE_START_TYPES = new Set(['휴원요청', '퇴원→휴원']);
const LEAVE_EXTEND_TYPES = new Set(['휴원연장']);
const RETURN_TYPES = new Set(['복귀요청', '재등원요청']);
const WITHDRAW_TYPES = new Set(['퇴원요청', '휴원→퇴원']);

function appendNote(note, prefix, added) {
  if (!added) return note;
  const tagged = prefix ? `[${prefix}] ${added}` : added;
  return note ? `${note}\n${tagged}` : tagged;
}

function newLeaveCycle(r) {
  return {
    type: 'leave',
    startDate: r.leave_start_date || null,
    endDate: r.leave_end_date || null,
    returnDate: null,
    withdrawalDate: null,
    note: r.consultation_note || '',
    subType: r.leave_sub_type || '',
    requests: [r],
  };
}

const _typeRank = (t) =>
  LEAVE_START_TYPES.has(t) ? 0
  : LEAVE_EXTEND_TYPES.has(t) ? 1
  : RETURN_TYPES.has(t) ? 2
  : WITHDRAW_TYPES.has(t) ? 3
  : 4;

export function groupLeaveCycles(requests) {
  const sorted = (requests || [])
    .filter((r) => r && r.status !== 'cancelled' && r.status !== 'rejected')
    .map((r) => ({ r, key: leaveRequestSortKey(r), rank: _typeRank(r.request_type) }))
    .sort((a, b) => a.key - b.key || a.rank - b.rank)
    .map((x) => x.r);

  const cycles = [];
  let open = null;

  const close = () => {
    if (open) {
      cycles.push(open);
      open = null;
    }
  };

  for (const r of sorted) {
    const t = r.request_type;

    if (LEAVE_START_TYPES.has(t)) {
      close();
      open = newLeaveCycle(r);
    } else if (LEAVE_EXTEND_TYPES.has(t)) {
      if (!open) {
        open = newLeaveCycle(r);
      } else {
        if (r.leave_end_date) open.endDate = r.leave_end_date;
        open.note = appendNote(open.note, '연장', r.consultation_note);
        open.requests.push(r);
      }
    } else if (RETURN_TYPES.has(t)) {
      if (open) {
        open.returnDate = r.return_date || null;
        open.note = appendNote(open.note, '복귀', r.consultation_note);
        open.requests.push(r);
        close();
      } else {
        cycles.push({
          type: 'reenroll',
          startDate: r.return_date || null,
          endDate: null,
          returnDate: r.return_date || null,
          withdrawalDate: null,
          note: r.consultation_note || '',
          subType: '',
          requests: [r],
        });
      }
    } else if (WITHDRAW_TYPES.has(t)) {
      // 열린 휴원 사이클이 있으면 휴→퇴 전환으로 닫음 (DB·DSC 동일 정책).
      if (open && open.type === 'leave') {
        open.type = 'leave_to_withdraw';
        open.withdrawalDate = r.withdrawal_date || null;
        open.note = appendNote(open.note, '퇴원전환', r.consultation_note);
        open.requests.push(r);
        close();
      } else {
        close();
        cycles.push({
          type: 'withdraw',
          startDate: null,
          endDate: r.withdrawal_date || null,
          returnDate: null,
          withdrawalDate: r.withdrawal_date || null,
          note: r.consultation_note || '',
          subType: '',
          requests: [r],
        });
      }
    } else {
      // 알 수 없는 타입 — 단독 카드로 그대로 노출 (DB 방식)
      close();
      cycles.push({
        type: 'other',
        startDate: r.leave_start_date || r.withdrawal_date || r.return_date || null,
        endDate: r.leave_end_date || r.withdrawal_date || r.return_date || null,
        returnDate: r.return_date || null,
        withdrawalDate: r.withdrawal_date || null,
        note: r.consultation_note || '',
        subType: r.leave_sub_type || '',
        requests: [r],
      });
    }
  }
  close();

  // 최신이 위로
  return cycles.slice().reverse();
}
