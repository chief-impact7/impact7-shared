import { test } from 'node:test';
import assert from 'node:assert';
import {
  ATTENDANCE_ACTIONS, normalizeAttendanceLabel, attendanceLabel, attendanceActionKey,
} from './attendance-action.js';

test('attendanceLabel — key→표준 라벨', () => {
  assert.equal(attendanceLabel('arrival'), '등원');
  assert.equal(attendanceLabel('out'), '외출');
  assert.equal(attendanceLabel('return'), '귀원');
  assert.equal(attendanceLabel('departure'), '하원');
  assert.equal(attendanceLabel('unknown'), '');
});

test('normalizeAttendanceLabel — 구 동의어 흡수', () => {
  assert.equal(normalizeAttendanceLabel('귀가'), '하원');
  assert.equal(normalizeAttendanceLabel('복귀'), '귀원');
});

test('normalizeAttendanceLabel — 표준/비대상 라벨은 통과', () => {
  for (const v of Object.values(ATTENDANCE_ACTIONS)) assert.equal(normalizeAttendanceLabel(v), v);
  assert.equal(normalizeAttendanceLabel('지각'), '지각');
  assert.equal(normalizeAttendanceLabel(''), '');
  assert.equal(normalizeAttendanceLabel(undefined), '');
});

test('attendanceActionKey — 구·신 라벨 모두 key로', () => {
  assert.equal(attendanceActionKey('하원'), 'departure');
  assert.equal(attendanceActionKey('귀가'), 'departure');
  assert.equal(attendanceActionKey('귀원'), 'return');
  assert.equal(attendanceActionKey('복귀'), 'return');
  assert.equal(attendanceActionKey('없음'), '');
});
