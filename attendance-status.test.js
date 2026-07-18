import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTENDANCE_STATUSES, ARRIVAL_STATUSES } from './attendance-status.js';

test('ATTENDANCE_STATUSES: 출석·지각·조퇴·결석 4종', () => {
  for (const s of ['출석', '지각', '조퇴', '결석']) assert.ok(ATTENDANCE_STATUSES.has(s));
  assert.equal(ATTENDANCE_STATUSES.size, 4);
  assert.equal(ATTENDANCE_STATUSES.has('등원'), false);
});

test('ARRIVAL_STATUSES: 출석·지각만 (도착시각 기록 상태)', () => {
  assert.ok(ARRIVAL_STATUSES.has('출석'));
  assert.ok(ARRIVAL_STATUSES.has('지각'));
  assert.equal(ARRIVAL_STATUSES.size, 2);
  assert.equal(ARRIVAL_STATUSES.has('조퇴'), false);
});

test('ARRIVAL_STATUSES ⊂ ATTENDANCE_STATUSES', () => {
  for (const s of ARRIVAL_STATUSES) assert.ok(ATTENDANCE_STATUSES.has(s));
});
