import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTimeKST, formatDateTimeKST, formatDateKST, todayKST } from './datetime.js';

// 2026-06-07T06:05:00Z = KST 15:05 (오후 3:05)
const D = new Date('2026-06-07T06:05:00Z');

test('formatTimeKST: KST 12시간제 오후 표기', () => {
  assert.equal(formatTimeKST(D), '오후 3:05');
});
test('formatTimeKST: 오전 경계 (KST 00:30)', () => {
  // 2026-06-06T15:30:00Z = KST 익일 00:30 → 오전 12:30
  assert.equal(formatTimeKST(new Date('2026-06-06T15:30:00Z')), '오전 12:30');
});
test('formatDateTimeKST: 월·일 + 12시간제 시간', () => {
  assert.equal(formatDateTimeKST(D), '6월 7일 오후 3:05');
});
test('formatDateTimeKST: withYear', () => {
  assert.equal(formatDateTimeKST(D, { withYear: true }), '2026년 6월 7일 오후 3:05');
});
test('formatDateKST: YYYY-MM-DD (KST 기준 날짜 경계)', () => {
  // KST 00:30 → 날짜는 06-07
  assert.equal(formatDateKST(new Date('2026-06-06T15:30:00Z')), '2026-06-07');
});
test('Firestore Timestamp(toDate) 입력 지원', () => {
  assert.equal(formatTimeKST({ toDate: () => D }), '오후 3:05');
});
test('epoch ms / ISO 문자열 입력 지원', () => {
  assert.equal(formatTimeKST(D.getTime()), '오후 3:05');
  assert.equal(formatTimeKST('2026-06-07T06:05:00Z'), '오후 3:05');
});
test('잘못된 값 → 빈 문자열', () => {
  assert.equal(formatTimeKST(null), '');
  assert.equal(formatDateTimeKST(undefined), '');
  assert.equal(formatDateKST('not-a-date'), '');
});

test('todayKST: YYYY-MM-DD 형식이며 formatDateKST(new Date())와 일치', () => {
  const t = todayKST();
  assert.match(t, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(t, formatDateKST(new Date()));
});
