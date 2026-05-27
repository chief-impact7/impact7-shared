import { test } from 'node:test';
import assert from 'node:assert';
import {
  isEnrollableStatus, hasRealEnrollment, reconcileEnrollments,
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
