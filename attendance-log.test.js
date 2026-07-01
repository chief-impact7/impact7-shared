import { test } from 'node:test';
import assert from 'node:assert';
import { sortByProcessed, arrivalOrder, departureOrder, groupByState } from './attendance-log.js';

const evs = [
  { student_id: 'a', student_name: '홍길동', type: '등원', occurred_at: '2026-07-01T06:05:00Z' },
  { student_id: 'b', student_name: '김철수', type: '등원', occurred_at: '2026-07-01T06:07:00Z' },
  { student_id: 'a', student_name: '홍길동', type: '외출', occurred_at: '2026-07-01T07:00:00Z' },
  { student_id: 'a', student_name: '홍길동', type: '하원', occurred_at: '2026-07-01T09:00:00Z' },
];
const daily = { a: { day_state: '하원', attendance: { status: '출석' } }, b: { day_state: '원내', attendance: { status: '지각' } } };

test('sortByProcessed — 기본 최신 위(desc)', () => {
  const r = sortByProcessed(evs);
  assert.equal(r[0].occurred_at, '2026-07-01T09:00:00Z');
  assert.equal(r[3].occurred_at, '2026-07-01T06:05:00Z');
});

test('sortByProcessed — asc 토글', () => {
  const r = sortByProcessed(evs, { desc: false });
  assert.equal(r[0].occurred_at, '2026-07-01T06:05:00Z');
});

test('arrivalOrder — 등원만 시각순 + 지각 플래그', () => {
  const r = arrivalOrder(evs, daily);
  assert.deepEqual(r.map(e => e.student_id), ['a', 'b']);
  assert.equal(r[0].late, false);
  assert.equal(r[1].late, true);
});

test('departureOrder — 하원만 시각순', () => {
  const r = departureOrder(evs);
  assert.equal(r.length, 1);
  assert.equal(r[0].type, '하원');
});

test('groupByState — day_state 그룹, daily 없으면 미등원', () => {
  const students = [{ student_id: 'a', name: '홍길동' }, { student_id: 'b', name: '김철수' }, { student_id: 'c', name: '이영희' }];
  const g = groupByState(students, daily);
  assert.deepEqual(g.하원.map(s => s.student_id), ['a']);
  assert.deepEqual(g.원내.map(s => s.student_id), ['b']);
  assert.deepEqual(g.미등원.map(s => s.student_id), ['c']);
});
