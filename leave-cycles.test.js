import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { leaveRequestSortKey, groupLeaveCycles } from './leave-cycles.js';

const ts = (iso) => ({ toDate: () => new Date(iso), toMillis: () => new Date(iso).getTime() });

describe('leaveRequestSortKey', () => {
  it('created_at 우선 (날짜 전용 문자열은 KST 자정)', () => {
    assert.equal(
      leaveRequestSortKey({ created_at: '2026-01-10', leave_start_date: '2026-05-01' }),
      new Date('2026-01-10T00:00:00+09:00').getTime(),
    );
  });

  it('created_at 없으면 requested_at → leave_start_date 순 폴백', () => {
    assert.equal(
      leaveRequestSortKey({ requested_at: '2026-02-02' }),
      new Date('2026-02-02T00:00:00+09:00').getTime(),
    );
    assert.equal(
      leaveRequestSortKey({ leave_start_date: '2026-03-03' }),
      new Date('2026-03-03T00:00:00+09:00').getTime(),
    );
  });

  it('Firestore Timestamp · Date · ISO 문자열 모두 처리', () => {
    const expected = new Date('2026-04-04T00:00:00Z').getTime();
    assert.equal(leaveRequestSortKey({ created_at: ts('2026-04-04T00:00:00Z') }), expected);
    assert.equal(leaveRequestSortKey({ created_at: new Date('2026-04-04T00:00:00Z') }), expected);
    assert.equal(leaveRequestSortKey({ created_at: '2026-04-04T00:00:00Z' }), expected);
  });

  it('날짜 전용 문자열은 KST 자정 — 같은 날 UTC 자정 ISO보다 9시간 이르다', () => {
    const dateOnly = leaveRequestSortKey({ created_at: '2026-01-10' });
    const utcMidnight = leaveRequestSortKey({ created_at: '2026-01-10T00:00:00Z' });
    assert.equal(utcMidnight - dateOnly, 9 * 60 * 60 * 1000);
  });

  it('엣지: null/빈 객체 → 0', () => {
    assert.equal(leaveRequestSortKey(null), 0);
    assert.equal(leaveRequestSortKey({}), 0);
    assert.equal(leaveRequestSortKey({ created_at: '잘못된날짜' }), 0);
  });
});

describe('groupLeaveCycles — 도메인 규칙', () => {
  it('휴원요청 → 복귀요청: 하나의 휴원 사이클로 묶고 종료', () => {
    const cycles = groupLeaveCycles([
      {
        request_type: '휴원요청',
        created_at: '2026-01-01',
        leave_start_date: '2026-01-05',
        leave_end_date: '2026-02-05',
        consultation_note: '개인 사정',
      },
      {
        request_type: '복귀요청',
        created_at: '2026-02-01',
        return_date: '2026-02-10',
        consultation_note: '복귀합니다',
      },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'leave');
    assert.equal(cycles[0].startDate, '2026-01-05');
    assert.equal(cycles[0].returnDate, '2026-02-10');
    assert.equal(cycles[0].note, '개인 사정\n[복귀] 복귀합니다');
    assert.equal(cycles[0].requests.length, 2);
  });

  it('휴원연장: 열린 사이클에 흡수, endDate 갱신 + [연장] prefix 누적', () => {
    const cycles = groupLeaveCycles([
      {
        request_type: '휴원요청',
        created_at: '2026-01-01',
        leave_start_date: '2026-01-05',
        leave_end_date: '2026-02-05',
        consultation_note: '시작',
      },
      {
        request_type: '휴원연장',
        created_at: '2026-02-01',
        leave_end_date: '2026-03-05',
        consultation_note: '한 달 더',
      },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'leave');
    assert.equal(cycles[0].endDate, '2026-03-05');
    assert.equal(cycles[0].note, '시작\n[연장] 한 달 더');
    assert.equal(cycles[0].requests.length, 2);
  });

  it('엣지: 휴원연장 단독 시작 (열린 사이클 없음) → 새 휴원 사이클', () => {
    const cycles = groupLeaveCycles([
      {
        request_type: '휴원연장',
        created_at: '2026-01-01',
        leave_start_date: '2026-01-05',
        leave_end_date: '2026-02-05',
        consultation_note: '연장만 기록됨',
      },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'leave');
    assert.equal(cycles[0].startDate, '2026-01-05');
    assert.equal(cycles[0].note, '연장만 기록됨');
  });

  it('엣지: 복귀요청 단독 (휴원 기록 없음) → reenroll 단독 카드', () => {
    const cycles = groupLeaveCycles([
      { request_type: '재등원요청', created_at: '2026-01-01', return_date: '2026-01-10' },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'reenroll');
    assert.equal(cycles[0].returnDate, '2026-01-10');
    assert.equal(cycles[0].startDate, '2026-01-10');
  });

  it('휴원→퇴원: 열린 휴원 사이클을 leave_to_withdraw로 전환해 닫음', () => {
    const cycles = groupLeaveCycles([
      {
        request_type: '휴원요청',
        created_at: '2026-01-01',
        leave_start_date: '2026-01-05',
        consultation_note: '휴원',
      },
      {
        request_type: '휴원→퇴원',
        created_at: '2026-02-01',
        withdrawal_date: '2026-02-15',
        consultation_note: '결국 퇴원',
      },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'leave_to_withdraw');
    assert.equal(cycles[0].withdrawalDate, '2026-02-15');
    assert.equal(cycles[0].note, '휴원\n[퇴원전환] 결국 퇴원');
  });

  it('휴원→퇴원 단독 (열린 사이클 없음) → withdraw 단독 카드', () => {
    const cycles = groupLeaveCycles([
      { request_type: '휴원→퇴원', created_at: '2026-01-01', withdrawal_date: '2026-01-15' },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'withdraw');
    assert.equal(cycles[0].withdrawalDate, '2026-01-15');
    assert.equal(cycles[0].startDate, null);
  });

  it('퇴원요청 단독 → withdraw 단독 카드', () => {
    const cycles = groupLeaveCycles([
      { request_type: '퇴원요청', created_at: '2026-01-01', withdrawal_date: '2026-01-20' },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'withdraw');
    assert.equal(cycles[0].withdrawalDate, '2026-01-20');
  });

  it('경계: 열린 휴원 중 퇴원요청 → 휴→퇴 전환 (DB·DSC 통일 정책)', () => {
    const cycles = groupLeaveCycles([
      {
        request_type: '휴원요청',
        created_at: '2026-01-01',
        leave_start_date: '2026-01-05',
        consultation_note: '휴원',
      },
      {
        request_type: '퇴원요청',
        created_at: '2026-02-01',
        withdrawal_date: '2026-02-10',
        consultation_note: '퇴원으로 마무리',
      },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'leave_to_withdraw');
    assert.equal(cycles[0].withdrawalDate, '2026-02-10');
    assert.equal(cycles[0].note, '휴원\n[퇴원전환] 퇴원으로 마무리');
  });

  it('알 수 없는 request_type → other 단독 카드', () => {
    const cycles = groupLeaveCycles([
      { request_type: '뭔가다른요청', created_at: '2026-01-01', leave_start_date: '2026-01-05' },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'other');
    assert.equal(cycles[0].startDate, '2026-01-05');
  });

  it('cancelled/rejected 제외', () => {
    const cycles = groupLeaveCycles([
      { request_type: '휴원요청', created_at: '2026-01-01', leave_start_date: '2026-01-05', status: 'cancelled' },
      { request_type: '퇴원요청', created_at: '2026-02-01', withdrawal_date: '2026-02-10', status: 'rejected' },
      { request_type: '휴원요청', created_at: '2026-03-01', leave_start_date: '2026-03-05', status: 'approved' },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].startDate, '2026-03-05');
  });

  it('Timestamp/문자열 혼합 정렬: 시간순으로 묶임 (입력 순서 무관)', () => {
    const cycles = groupLeaveCycles([
      // 입력 순서를 일부러 뒤섞음
      { request_type: '복귀요청', created_at: '2026-02-01', return_date: '2026-02-10' },
      { request_type: '휴원요청', created_at: ts('2026-01-01T00:00:00Z'), leave_start_date: '2026-01-05' },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'leave');
    assert.equal(cycles[0].startDate, '2026-01-05');
    assert.equal(cycles[0].returnDate, '2026-02-10');
  });

  it('미종결 사이클 flush: 종료 요청 없는 열린 휴원도 포함', () => {
    const cycles = groupLeaveCycles([
      { request_type: '휴원요청', created_at: '2026-01-01', leave_start_date: '2026-01-05', consultation_note: '진행중' },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'leave');
    assert.equal(cycles[0].returnDate, null);
    assert.equal(cycles[0].withdrawalDate, null);
  });

  it('새 휴원요청은 열린 사이클을 닫고 새로 시작 (다중 사이클, 최신이 위로)', () => {
    const cycles = groupLeaveCycles([
      { request_type: '휴원요청', created_at: '2026-01-01', leave_start_date: '2026-01-05' },
      { request_type: '휴원요청', created_at: '2026-03-01', leave_start_date: '2026-03-05' },
    ]);
    assert.equal(cycles.length, 2);
    // 최신이 위로
    assert.equal(cycles[0].startDate, '2026-03-05');
    assert.equal(cycles[1].startDate, '2026-01-05');
  });

  it('엣지: null/빈 배열 → 빈 배열', () => {
    assert.deepEqual(groupLeaveCycles(null), []);
    assert.deepEqual(groupLeaveCycles([]), []);
    assert.deepEqual(groupLeaveCycles([null, undefined]), []);
  });

  it('created_at 일부 누락 + leave_start_date 폴백 혼합 → 휴원→복귀 1사이클', () => {
    const cycles = groupLeaveCycles([
      // 휴원요청은 created_at 없이 leave_start_date(KST 자정)로만 정렬됨
      { request_type: '휴원요청', leave_start_date: '2026-01-05', consultation_note: '휴원' },
      // 복귀요청은 created_at(KST) 보유 — 휴원보다 뒤로 정렬돼야 1사이클로 묶임
      { request_type: '복귀요청', created_at: '2026-02-10', return_date: '2026-02-12', consultation_note: '복귀' },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'leave');
    assert.equal(cycles[0].startDate, '2026-01-05');
    assert.equal(cycles[0].returnDate, '2026-02-12');
    assert.equal(cycles[0].requests.length, 2);
  });

  it('leave_end_date 없는 휴원연장 → endDate는 최초값 유지', () => {
    const cycles = groupLeaveCycles([
      {
        request_type: '휴원요청',
        created_at: '2026-01-01',
        leave_start_date: '2026-01-05',
        leave_end_date: '2026-02-05',
      },
      { request_type: '휴원연장', created_at: '2026-02-01', consultation_note: '기간 미정 연장' },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].endDate, '2026-02-05');
    assert.equal(cycles[0].note, '[연장] 기간 미정 연장');
    assert.equal(cycles[0].requests.length, 2);
  });

  it("'퇴원→휴원' 타입으로 새 leave 사이클 시작", () => {
    const cycles = groupLeaveCycles([
      {
        request_type: '퇴원→휴원',
        created_at: '2026-01-01',
        leave_start_date: '2026-01-05',
        leave_end_date: '2026-02-05',
        consultation_note: '퇴원 취소하고 휴원으로',
      },
    ]);
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].type, 'leave');
    assert.equal(cycles[0].startDate, '2026-01-05');
    assert.equal(cycles[0].endDate, '2026-02-05');
  });

  it('열린 휴원 중 알 수 없는 타입 → 휴원 닫히고 other 카드, 총 2카드 (최신이 위)', () => {
    const cycles = groupLeaveCycles([
      { request_type: '휴원요청', created_at: '2026-01-01', leave_start_date: '2026-01-05' },
      { request_type: '정체불명요청', created_at: '2026-02-01', leave_start_date: '2026-02-05' },
    ]);
    assert.equal(cycles.length, 2);
    // 최신이 위로
    assert.equal(cycles[0].type, 'other');
    assert.equal(cycles[0].startDate, '2026-02-05');
    assert.equal(cycles[1].type, 'leave');
    assert.equal(cycles[1].startDate, '2026-01-05');
  });
});
