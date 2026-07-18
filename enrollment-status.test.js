import { test } from 'node:test';
import assert from 'node:assert';
import {
  isEnrollableStatus, hasRealEnrollment, reconcileEnrollments,
  studentCategory, selectableStatuses, STUDENT_STATUS_GROUPS,
  LEAVE_STATUSES, ENROLLABLE_STATUSES,
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
