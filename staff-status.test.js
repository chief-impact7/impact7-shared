import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoStatusFromPersonnelDates,
  effectiveStaffStatus,
  mergePersonnelDates,
} from './staff-status.js';
import * as staffStatus from './staff-status.js';

const T = '2026-07-17';
const d = (type, date) => ({ type, date });

test('휴직 후 복직하면 재직으로 돌아온다', () => {
  assert.equal(
    autoStatusFromPersonnelDates([d('leaveDate', '2026-01-10'), d('returnDate', '2026-03-10')], 'active', T),
    'active'
  );
});

test('휴직만 있으면 휴직', () => {
  assert.equal(autoStatusFromPersonnelDates([d('leaveDate', '2026-01-10')], 'active', T), 'inactive');
});

test('수동 inactive도 복직일로 재직 전환', () => {
  assert.equal(autoStatusFromPersonnelDates([d('returnDate', '2026-03-10')], 'inactive', T), 'active');
});

test('종무일 당일은 재직, 퇴사일 당일부터 퇴직', () => {
  const records = [
    d('joinDate', '2020-02-20'),
    d('lastWorkDate', '2026-07-17'),
    d('resignationDate', '2026-07-18'),
  ];
  assert.equal(autoStatusFromPersonnelDates(records, 'active', '2026-07-17'), 'active');
  assert.equal(autoStatusFromPersonnelDates(records, 'active', '2026-07-18'), 'terminated');
});

test('온보딩부터 입사·휴직·복직·종무 체인 전이', () => {
  const chain = [
    d('joinDate', '2024-01-01'),
    d('leaveDate', '2025-01-01'),
    d('returnDate', '2025-06-01'),
    d('lastWorkDate', '2026-07-10'),
  ];
  assert.equal(autoStatusFromPersonnelDates(chain, 'onboarding', T), 'terminated');
  assert.equal(autoStatusFromPersonnelDates(chain.slice(0, 3), 'onboarding', T), 'active');
});

test('미래 입사예정일이 있는 온보딩은 입사예정', () => {
  assert.equal(autoStatusFromPersonnelDates([d('plannedJoinDate', '2026-09-01')], 'onboarding', T), 'join_pending');
});

test('취소 상태는 날짜 규칙이 건드리지 않는다', () => {
  assert.equal(autoStatusFromPersonnelDates([d('joinDate', '2020-01-01')], 'join_cancelled', T), 'join_cancelled');
});

test('퇴사 기록보다 늦은 입사일은 재입사로 되살린다', () => {
  const rehire = [d('resignationDate', '2024-02-01'), d('joinDate', '2025-03-01')];
  assert.equal(autoStatusFromPersonnelDates(rehire, 'active', T), 'active');
  assert.equal(autoStatusFromPersonnelDates(rehire, 'terminated', T), 'active');
});

test('퇴사 날짜 없는 수동 terminated는 유지', () => {
  assert.equal(autoStatusFromPersonnelDates([d('joinDate', '2020-01-01')], 'terminated', T), 'terminated');
});

test('입사 후 퇴사한 정상 순서는 퇴직 유지', () => {
  const records = [d('joinDate', '2020-01-01'), d('resignationDate', '2024-02-01')];
  assert.equal(autoStatusFromPersonnelDates(records, 'terminated', T), 'terminated');
  assert.equal(autoStatusFromPersonnelDates(records, 'active', T), 'terminated');
});

test('복직일로는 퇴직을 되살릴 수 없다', () => {
  assert.equal(
    autoStatusFromPersonnelDates(
      [d('leaveDate', '2026-01-01'), d('resignationDate', '2026-03-01'), d('returnDate', '2026-04-01')],
      'active',
      T
    ),
    'terminated'
  );
});

test('재입사 후 재퇴사', () => {
  assert.equal(
    autoStatusFromPersonnelDates(
      [d('resignationDate', '2024-02-01'), d('joinDate', '2025-03-01'), d('lastWorkDate', '2026-01-31')],
      'active',
      T
    ),
    'terminated'
  );
});

test('재입사 입사일이 미래면 아직 퇴직', () => {
  assert.equal(
    autoStatusFromPersonnelDates([d('resignationDate', '2026-01-01'), d('joinDate', '2026-12-01')], 'active', T),
    'terminated'
  );
});

// 2026-07-17 태블릿 장애 회귀 — 서버 구현이 종무일 당일을 즉시 퇴직 처리해
// HR(재직)과 갈라졌던 케이스. staff 문서 그대로 넣어 검증한다.
test('effectiveStaffStatus: 종무일 당일 staff 문서는 재직', () => {
  const staff = { status: 'active', lastWorkDate: '2026-07-17', resignationDate: '2026-07-18' };
  assert.equal(effectiveStaffStatus(staff, '2026-07-17'), 'active');
  assert.equal(effectiveStaffStatus(staff, '2026-07-18'), 'terminated');
});

test('effectiveStaffStatus: leave_pending은 재직으로 정규화, 빈 status는 active', () => {
  assert.equal(effectiveStaffStatus({ status: 'leave_pending' }, T), 'active');
  assert.equal(effectiveStaffStatus({}, T), 'active');
});

test('mergePersonnelDates: personnelDates 항목이 legacy 필드보다 우선하고 dedupe된다', () => {
  const records = mergePersonnelDates({
    joinDate: '2020-01-01',
    personnelDates: [d('joinDate', '2021-05-05')],
  });
  assert.deepEqual(records.filter((r) => r.type === 'joinDate'), [d('joinDate', '2021-05-05')]);
});

test('mergePersonnelDates: legacy interviewDate 병합, 알 수 없는 타입 보존', () => {
  const records = mergePersonnelDates({
    interviewDate: '2020-01-15',
    personnelDates: [d('customType', '2022-02-02')],
  });
  assert.ok(records.some((r) => r.type === 'interviewDate' && r.date === '2020-01-15'));
  assert.ok(records.some((r) => r.type === 'customType' && r.date === '2022-02-02'));
});

test('mergePersonnelDates: 공백 날짜 항목은 legacy 필드 fallback을 막지 않는다', () => {
  const records = mergePersonnelDates({
    joinDate: '2020-01-01',
    personnelDates: [d('joinDate', '   ')],
  });
  assert.deepEqual(records, [d('joinDate', '2020-01-01')]);
});

test('mergePersonnelDates: 공백 낀 known 타입은 trim 후 하나로 dedupe', () => {
  const records = mergePersonnelDates({ personnelDates: [d(' joinDate ', '2021-05-05')] });
  assert.deepEqual(records, [d('joinDate', '2021-05-05')]);
});

test('mergePersonnelDates: 최상위 other 필드는 날짜로 오인하지 않는다', () => {
  assert.deepEqual(mergePersonnelDates({ other: '특이사항 메모' }), []);
});

test('null 항목·프로토타입 키 타입·형식 불일치 날짜에도 크래시 없이 파생', () => {
  const records = [
    null,
    d('constructor', '2020-01-01'),
    d('resignationDate', '2026.7.9'),
    d('joinDate', '2020-01-01'),
  ];
  assert.equal(autoStatusFromPersonnelDates(records, 'onboarding', T), 'active');
});

test('형식 불일치 날짜는 무시된다 — 연도 누락이 고대 퇴사로 소급되지 않음', () => {
  assert.equal(
    autoStatusFromPersonnelDates([d('joinDate', '2020-01-01'), d('resignationDate', '07-18')], 'active', T),
    'active'
  );
});

test('형식 불일치 입사예정일은 join_pending 파생에도 쓰이지 않는다', () => {
  assert.equal(
    autoStatusFromPersonnelDates([d('plannedJoinDate', '2026.03.01')], 'onboarding', T),
    'onboarding'
  );
});

test('today 생략·비문자열·비ISO는 throw — 조용한 오판 금지', () => {
  assert.throws(() => autoStatusFromPersonnelDates([], 'active'), TypeError);
  assert.throws(() => effectiveStaffStatus({ status: 'active' }), TypeError);
  assert.throws(() => effectiveStaffStatus({ status: 'active' }, new Date()), TypeError);
});

test('담당 가능 직원은 교수·행정의 온보딩·입사예정·재직만 허용한다', () => {
  for (const department of ['교수', '행정']) {
    for (const status of ['onboarding', 'join_pending', 'active']) {
      assert.equal(staffStatus.isAssignableStaff({ department, status }, T), true);
    }
  }
  assert.equal(staffStatus.isAssignableStaff({ department: '단기', status: 'active' }, T), false);
  assert.equal(staffStatus.isAssignableStaff({ department: '교수', status: 'inactive' }, T), false);
  assert.equal(staffStatus.isAssignableStaff({ department: '행정', status: 'join_cancelled' }, T), false);
  assert.equal(staffStatus.isAssignableStaff({ department: '교수', status: 'active', excludedFromPersonnel: true }, T), false);
});
