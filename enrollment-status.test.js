import { test } from 'node:test';
import assert from 'node:assert';
import {
  isEnrollableStatus, hasRealEnrollment, reconcileEnrollments,
  studentCategory, selectableStatuses, STUDENT_STATUS_GROUPS,
  LEAVE_STATUSES, ENROLLABLE_STATUSES,
  ACCOUNT_TYPES, accountTypeOf, groupEnrollmentAccounts, accountStateAt,
  openAccounts, openAccountIds, activeEnrollmentsAt,
  hasActiveRegularAccount,
  pauseAccount, resumeAccount, closeAccount, deriveStudentStatusAfterAccountChange,
} from './enrollment-status.js';

test('isEnrollableStatus — 재원 계열만 true', () => {
  for (const s of ['재원', '등원예정', '실휴원', '가휴원']) assert.equal(isEnrollableStatus(s), true);
  for (const s of ['상담', '퇴원', '종강', '', undefined]) assert.equal(isEnrollableStatus(s), false);
});

test('hasRealEnrollment — 빈 placeholder 제외', () => {
  assert.equal(hasRealEnrollment([]), false);
  assert.equal(hasRealEnrollment(null), false);
  assert.equal(hasRealEnrollment([{ class_type: '정규' }]), false); // 반코드 없음
  assert.equal(hasRealEnrollment([{ class_type: '정규', class_number: '104' }]), true);
  assert.equal(hasRealEnrollment([{ level_symbol: 'HA' }]), true);
});

test('reconcileEnrollments — 비재원(상담/퇴원/종강)은 enrollment 강제 비움', () => {
  for (const s of ['상담', '퇴원', '종강']) {
    const r = reconcileEnrollments(s, [{ class_type: '정규', class_number: '104' }]);
    assert.deepEqual(r.enrollments, []);
    assert.equal(r.valid, true);
  }
});

test('reconcileEnrollments — 재원 계열인데 반 없으면 invalid', () => {
  const r = reconcileEnrollments('재원', []);
  assert.equal(r.valid, false);
  assert.ok(r.reason);
  const r2 = reconcileEnrollments('등원예정', [{ class_type: '정규' }]); // placeholder만
  assert.equal(r2.valid, false);
});

test('reconcileEnrollments — 재원 계열 + 실질 반 있으면 valid', () => {
  const r = reconcileEnrollments('재원', [{ class_type: '정규', class_number: '104' }]);
  assert.equal(r.valid, true);
  assert.equal(r.enrollments.length, 1);
});

test('reconcileEnrollments — 휴원·퇴원에서 재원 전환은 활성 정규반이 필수', () => {
  const special = [{ account_type: '특강', class_type: '특강', class_number: '여름특강' }];
  const regular = [{ account_type: '정규', class_type: '정규', class_number: '201' }];
  for (const previousStatus of ['가휴원', '실휴원', '퇴원']) {
    const invalid = reconcileEnrollments('재원', special, {
      previousStatus,
      dateStr: '2026-07-27',
    });
    assert.equal(invalid.valid, false);
    assert.match(invalid.reason, /활성 정규반/);
    assert.equal(reconcileEnrollments('재원', regular, {
      previousStatus,
      dateStr: '2026-07-27',
    }).valid, true);
  }
  assert.equal(reconcileEnrollments('재원', special, {
    previousStatus: '재원',
    dateStr: '2026-07-27',
  }).valid, true);
  assert.equal(reconcileEnrollments('재원', regular, {
    previousStatus: '실휴원',
  }).valid, false);
});

test('studentCategory — 재원생/비원생 분류', () => {
  for (const s of ['등원예정', '재원', '실휴원', '가휴원']) assert.equal(studentCategory(s), '재원생');
  for (const s of ['상담', '퇴원', '종강']) assert.equal(studentCategory(s), '비원생');
});

test('STUDENT_STATUS_GROUPS — 7개 status 모두 포함, 중복 없음', () => {
  const all = STUDENT_STATUS_GROUPS.flatMap(g => g.statuses);
  assert.equal(all.length, 7);
  assert.equal(new Set(all).size, 7);
});

test('selectableStatuses — 신규는 등원예정/재원만 (휴원 차단)', () => {
  const s = selectableStatuses(null, true);
  assert.deepEqual(s, ['등원예정', '재원']);
});

test('selectableStatuses — 비원생은 등원예정/재원 + 현 status, 휴원 차단', () => {
  const s = selectableStatuses('상담', false);
  assert.ok(s.includes('등원예정') && s.includes('재원') && s.includes('상담'));
  assert.ok(!s.includes('실휴원') && !s.includes('가휴원'));
});

test('selectableStatuses — 재원생은 휴원 진입 가능, 상담은 불가', () => {
  const s = selectableStatuses('재원', false);
  assert.ok(s.includes('실휴원') && s.includes('가휴원'));
  assert.ok(!s.includes('상담'));
});

// ─── 2026-07-05 리뷰 P1 회귀 ───
test('reconcileEnrollments: 7종 밖 status는 valid:false (오타·구 데이터·undefined 차단)', () => {
  const enrolls = [{ level_symbol: 'HA', class_number: '101' }];
  for (const bad of ['휴원', '재학', undefined, null, '']) {
    const r = reconcileEnrollments(bad, enrolls);
    assert.equal(r.valid, false);
    assert.ok(r.reason.includes('알 수 없는 상태'));
    assert.deepEqual(r.enrollments, enrolls); // 데이터는 훼손하지 않음
  }
});

test('reconcileEnrollments: 빈 문자열 status의 reason은 (없음) 표기', () => {
  assert.ok(reconcileEnrollments('', []).reason.includes('(없음)'));
});

test("LEAVE_STATUSES: 실휴원·가휴원만 포함", () => {
  assert.ok(LEAVE_STATUSES.has("실휴원"));
  assert.ok(LEAVE_STATUSES.has("가휴원"));
  assert.equal(LEAVE_STATUSES.size, 2);
  assert.equal(LEAVE_STATUSES.has("재원"), false);
});
test("LEAVE_STATUSES ⊂ ENROLLABLE_STATUSES (휴원도 재원 유지)", () => {
  for (const s of LEAVE_STATUSES) assert.ok(ENROLLABLE_STATUSES.has(s));
});

test('수강계정 유형은 명시값 우선, 레거시는 class_type으로 파생', () => {
  assert.deepEqual(ACCOUNT_TYPES, ['정규', '특강', '기타']);
  assert.equal(accountTypeOf({ account_type: '기타', class_type: '정규' }), '기타');
  assert.equal(accountTypeOf({ class_type: '특강' }), '특강');
  assert.equal(accountTypeOf({ class_type: '기타' }), '기타');
  assert.equal(accountTypeOf({ class_type: '내신' }), '정규');
  assert.equal(accountTypeOf({}), '정규');
});

test('account_id별 그룹을 첫 등장 순서로 만들고 중복 ID를 병합', () => {
  const enrollments = [
    { account_id: 'regular-a', class_type: '정규', class_number: '101' },
    { account_id: 'regular-b', class_type: '정규', class_number: '201' },
    { account_id: 'regular-a', class_type: '내신', class_number: '내신A' },
  ];
  const groups = groupEnrollmentAccounts(enrollments);
  assert.deepEqual(groups.map(g => g.accountId), ['regular-a', 'regular-b']);
  assert.deepEqual(groups[0].items, [enrollments[0], enrollments[2]]);
  assert.deepEqual(activeEnrollmentsAt(enrollments, '2026-07-23'), enrollments);
});

test('레거시는 정규계열만 합치고 특강·기타는 항목별 독립 계정', () => {
  const enrollments = [
    { class_type: '정규', class_number: '101' },
    { class_type: '내신', class_number: '내신A' },
    { class_type: '특강', class_number: '특강A' },
    { class_type: '특강', class_number: '특강B' },
    { class_type: '기타', class_number: '기타A' },
  ];
  const groups = groupEnrollmentAccounts(enrollments);
  assert.deepEqual(groups.map(g => g.accountType), ['정규', '특강', '특강', '기타']);
  assert.deepEqual(groups.map(g => g.accountId), [null, null, null, null]);
  assert.deepEqual(groups.map(g => g.key), [
    'legacy:정규:101', 'legacy:특강:특강A', 'legacy:특강:특강B', 'legacy:기타:기타A',
  ]);
  assert.deepEqual(groups[0].items, enrollments.slice(0, 2));
});

test('그룹은 null·비객체·반코드 없는 placeholder를 제외해 dateStr 검사를 우회하지 못한다', () => {
  const ended = { account_id: 'ended', class_number: '101', end_date: '2026-07-22' };
  const enrollments = [null, 'invalid', {}, { class_type: '정규' }, ended];
  assert.deepEqual(groupEnrollmentAccounts(enrollments).flatMap(group => group.items), [ended]);
  assert.equal(reconcileEnrollments('재원', enrollments, { dateStr: '2026-07-23' }).valid, false);
});

test('활성 계정에서도 기준일에 활성인 과거·현재·미래 항목만 반환', () => {
  const ended = {
    account_id: 'a', class_type: '내신', class_number: '내신A',
    start_date: '2026-05-01', end_date: '2026-06-30',
  };
  const current = {
    account_id: 'a', class_type: '정규', class_number: '101',
    start_date: '2026-07-01', end_date: '2026-12-31',
  };
  const future = {
    account_id: 'a', class_type: '자유학기', class_number: '101',
    start_date: '2027-01-01',
  };
  assert.deepEqual(activeEnrollmentsAt([ended, current, future], '2026-07-23'), [current]);
  assert.deepEqual(activeEnrollmentsAt([current], 'invalid'), [current]);
});

test('활성 정규계정 판정은 특강과 휴원·종료 정규를 제외한다', () => {
  assert.equal(hasActiveRegularAccount([
    { account_type: '특강', class_type: '특강', class_number: '여름특강' },
    {
      account_type: '정규',
      class_type: '정규',
      class_number: '201',
      pause_start_date: '2026-07-01',
      pause_end_date: '2026-08-20',
    },
  ], '2026-07-27'), false);
  assert.equal(hasActiveRegularAccount([
    { account_type: '정규', class_type: '정규', class_number: '201' },
  ], '2026-07-27'), true);
});

test('계정 상태는 미래 시작 예정, end_date 당일 활성, 다음 날 종료', () => {
  const future = { items: [{ start_date: '2026-08-01', class_number: '101' }] };
  const ending = { items: [{ start_date: '2026-07-01', end_date: '2026-07-23', class_number: '101' }] };
  assert.equal(accountStateAt(future, '2026-07-23'), '예정');
  assert.equal(accountStateAt(ending, '2026-07-23'), '활성');
  assert.equal(accountStateAt(ending, '2026-07-24'), '종료');
});

test('휴원은 시작·종료 양끝을 포함하고 종료일 없는 pause는 열린 구간', () => {
  const bounded = {
    items: [{
      class_number: '101', pause_start_date: '2026-07-10', pause_end_date: '2026-07-20',
    }],
  };
  const open = { items: [{ class_number: '201', pause_start_date: '2026-07-10' }] };
  assert.equal(accountStateAt(bounded, '2026-07-09'), '활성');
  assert.equal(accountStateAt(bounded, '2026-07-10'), '휴원');
  assert.equal(accountStateAt(bounded, '2026-07-20'), '휴원');
  assert.equal(accountStateAt(bounded, '2026-07-21'), '활성');
  assert.equal(accountStateAt(open, '2026-07-10'), '휴원');
  assert.equal(accountStateAt(open, '2027-01-01'), '휴원');
  assert.equal(accountStateAt(open, 'invalid'), '활성');
});

test('열린 계정과 ID는 종료 계정을 제외하고 레거시 null ID를 생략', () => {
  const enrollments = [
    { account_id: 'open', class_number: '101', start_date: '2026-08-01' },
    { account_id: 'closed', class_number: '201', end_date: '2026-07-22' },
    { class_type: '특강', class_number: '특강A' },
  ];
  assert.deepEqual(openAccounts(enrollments, '2026-07-23').map(a => a.accountId), ['open', null]);
  assert.deepEqual(openAccountIds(enrollments, '2026-07-23'), ['open']);
});

test('한 계정만 휴원하면 다른 활성 계정 때문에 학생 status는 재원 유지', () => {
  const original = [
    { account_id: 'a', class_type: '정규', class_number: '101' },
    { account_id: 'a', class_type: '내신', class_number: '내신A' },
    { account_id: 'b', class_type: '정규', class_number: '201' },
  ];
  const paused = pauseAccount(original, 'a', {
    pauseStart: '2026-07-01',
    pauseEnd: '2026-07-31',
    leaveSubType: '실휴원',
  });
  assert.equal(paused.skipped, false);
  assert.equal(original[0].pause_start_date, undefined);
  assert.deepEqual(paused.updatedEnrollments.slice(0, 2).map(e => e.leave_sub_type), ['실휴원', '실휴원']);
  assert.equal(deriveStudentStatusAfterAccountChange(paused.updatedEnrollments, '2026-07-23'), '재원');

  const resumed = resumeAccount(paused.updatedEnrollments, 'a');
  assert.equal(resumed.skipped, false);
  assert.equal(resumed.updatedEnrollments[0].pause_start_date, undefined);
  assert.equal(resumed.updatedEnrollments[0].leave_sub_type, undefined);
});

test('부분 종료는 재원 계열 currentStatus를 보존하고 마지막 종료는 fallbackReason으로 파생', () => {
  const original = [
    { account_id: 'a', class_number: '101' },
    { account_id: 'b', class_number: '201' },
  ];
  const first = closeAccount(original, 'a', { endDate: '2026-07-23', endReason: '퇴원' });
  assert.equal(first.skipped, false);
  assert.deepEqual(first.updatedEnrollments, [original[1]]);
  assert.deepEqual(first.removed, [{ ...original[0], end_date: '2026-07-23', end_reason: '퇴원' }]);
  assert.equal(deriveStudentStatusAfterAccountChange(first.updatedEnrollments, '2026-07-23'), '재원');
  for (const currentStatus of ['재원', '등원예정', '실휴원', '가휴원']) {
    assert.equal(
      deriveStudentStatusAfterAccountChange(first.updatedEnrollments, '2026-07-23', { currentStatus }),
      currentStatus,
    );
  }
  for (const currentStatus of ['퇴원', '레거시오염']) {
    assert.equal(
      deriveStudentStatusAfterAccountChange(first.updatedEnrollments, '2026-07-23', { currentStatus }),
      '재원',
    );
  }

  const last = closeAccount(first.updatedEnrollments, 'b', { endDate: '2026-07-23', endReason: '종강' });
  assert.equal(deriveStudentStatusAfterAccountChange(last.updatedEnrollments, '2026-07-23', { fallbackReason: '퇴원' }), '퇴원');
  assert.equal(deriveStudentStatusAfterAccountChange(last.updatedEnrollments, '2026-07-23'), '종강');
});

test('모든 계정 휴원 시 실휴원이 가휴원보다 우선', () => {
  const enrollments = [
    {
      account_id: 'a', class_number: '101',
      pause_start_date: '2026-07-01', pause_end_date: '2026-07-31', leave_sub_type: '가휴원',
    },
    {
      account_id: 'b', class_number: '201',
      pause_start_date: '2026-07-01', pause_end_date: '2026-07-31', leave_sub_type: '실휴원',
    },
  ];
  assert.equal(deriveStudentStatusAfterAccountChange(enrollments, '2026-07-23'), '실휴원');
});

test('대상 account_id가 없으면 계정 변경 함수는 원본을 그대로 반환하고 skip', () => {
  const enrollments = [{ account_id: 'a', class_number: '101' }];
  assert.deepEqual(pauseAccount(enrollments, 'missing', {}), { updatedEnrollments: enrollments, skipped: true });
  assert.deepEqual(resumeAccount(enrollments, 'missing'), { updatedEnrollments: enrollments, skipped: true });
  assert.deepEqual(closeAccount(enrollments, 'missing', {}), {
    updatedEnrollments: enrollments, removed: [], skipped: true,
  });
});

test('레거시 key로 열린 휴원·재개·종료 경로를 조작', () => {
  const original = [{ class_type: '정규', level_symbol: 'HA', class_number: '101' }];
  const key = groupEnrollmentAccounts(original)[0].key;
  assert.equal(key, 'legacy:정규:HA101');

  const paused = pauseAccount(original, key, {
    pauseStart: '2026-07-23', leaveSubType: '가휴원',
  });
  assert.equal(paused.skipped, false);
  assert.equal(paused.updatedEnrollments[0].pause_end_date, undefined);
  assert.equal(accountStateAt(groupEnrollmentAccounts(paused.updatedEnrollments)[0], '2026-08-01'), '휴원');

  const resumed = resumeAccount(paused.updatedEnrollments, key);
  assert.equal(resumed.skipped, false);
  assert.equal(resumed.updatedEnrollments[0].pause_start_date, undefined);

  const closed = closeAccount(resumed.updatedEnrollments, key, {
    endDate: '2026-08-31', endReason: '종강',
  });
  assert.equal(closed.skipped, false);
  assert.deepEqual(closed.updatedEnrollments, []);
  assert.equal(closed.removed[0].end_date, '2026-08-31');
});

test('같은 account_id의 계정 유형 혼재를 표시하고 dateStr 정합성 검사에서 거부', () => {
  const enrollments = [
    { account_id: 'mixed', account_type: '정규', class_type: '정규', class_number: '101' },
    { account_id: 'mixed', account_type: '특강', class_type: '특강', class_number: '특강A' },
  ];
  const [group] = groupEnrollmentAccounts(enrollments);
  assert.equal(group.typeConflict, true);
  const result = reconcileEnrollments('재원', enrollments, { dateStr: '2026-07-23' });
  assert.equal(result.valid, false);
  assert.match(result.reason, /서로 다른 계정 유형/);
});

test('reconcileEnrollments는 2인자 하위호환을 유지하고 dateStr에서 종료 계정을 거부', () => {
  const ended = [{ account_id: 'a', class_number: '101', end_date: '2026-07-22' }];
  assert.deepEqual(reconcileEnrollments('재원', ended), { enrollments: ended, valid: true });
  assert.equal(reconcileEnrollments('재원', ended, { dateStr: '2026-07-23' }).valid, false);

  const future = [{ account_id: 'a', class_number: '101', start_date: '2026-08-01' }];
  assert.equal(reconcileEnrollments('등원예정', future, { dateStr: '2026-07-23' }).valid, true);
});
