import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, formatTimeKST, formatDateTimeKST, formatDateKST, todayKST, businessDayKST } from './datetime.js';

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

test('businessDayKST: 06시 경계(당일 06:00~익일 06:00)', () => {
  // KST 05:00(2026-07-02) = 2026-07-01T20:00Z → cutoff 이전 → 전날 07-01
  assert.equal(businessDayKST(new Date('2026-07-01T20:00:00Z')), '2026-07-01');
  // KST 06:00(2026-07-02) = 2026-07-01T21:00Z → cutoff 이상 → 당일 07-02
  assert.equal(businessDayKST(new Date('2026-07-01T21:00:00Z')), '2026-07-02');
  // KST 22:00(2026-07-02) = 2026-07-02T13:00Z → 당일 07-02
  assert.equal(businessDayKST(new Date('2026-07-02T13:00:00Z')), '2026-07-02');
  // KST 00:30(2026-07-03) = 2026-07-02T15:30Z → 전날 근무일 07-02
  assert.equal(businessDayKST(new Date('2026-07-02T15:30:00Z')), '2026-07-02');
  // 잘못된 값 → ''
  assert.equal(businessDayKST('not-a-date'), '');
});

// ─── 2026-07-05 리뷰 P7 회귀 ───
test('직렬화된 Timestamp POJO({seconds}·{_seconds}) 지원', () => {
  const sec = Math.floor(D.getTime() / 1000);
  assert.equal(formatTimeKST({ seconds: sec, nanoseconds: 0 }), '오후 3:05');
  assert.equal(formatTimeKST({ _seconds: sec, _nanoseconds: 0 }), '오후 3:05');
  assert.equal(formatDateKST({ seconds: sec }), ''); // 쌍(nanoseconds) 없는 객체는 Timestamp로 인정하지 않음
});

// ─── 2026-07-05 적대적 검증 회귀 방지 (P7-BROKEN) ───
test("falsy 비-null 입력(''·NaN·false)은 POJO 경로로 오분류되지 않고 빈 문자열", () => {
  assert.equal(formatDateKST(''), '');
  assert.equal(formatTimeKST(''), '');
  assert.equal(formatDateTimeKST(''), '');
  assert.equal(businessDayKST(''), '');
  assert.equal(formatTimeKST(NaN), '');
  assert.equal(formatDateKST(NaN), '');
  assert.equal(formatDateKST(false), '');
});

test('범위 밖 seconds POJO는 크래시 없이 빈 문자열', () => {
  assert.equal(formatTimeKST({ seconds: 1e15 }), '');
});

test('epoch 0(숫자)은 유효 입력으로 유지', () => {
  assert.equal(formatDateKST(0), '1970-01-01');
});

test('숫자 seconds 필드를 가진 비Timestamp 객체(duration류)는 오분류하지 않음', () => {
  assert.equal(formatDateKST({ hours: 1, minutes: 30, seconds: 0 }), '');
});

// ─── addDays ───
test('addDays: 기본 ± 이동', () => {
  assert.equal(addDays('2026-07-17', 1), '2026-07-18');
  assert.equal(addDays('2026-07-17', -1), '2026-07-16');
  assert.equal(addDays('2026-07-17', 0), '2026-07-17');
});

test('addDays: 월·년·윤년 경계', () => {
  assert.equal(addDays('2026-08-01', -1), '2026-07-31');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29'); // 윤년
  assert.equal(addDays('2025-02-28', 1), '2025-03-01');
});

test('addDays: 잘못된 형식은 빈 문자열', () => {
  assert.equal(addDays('', -1), '');
  assert.equal(addDays('2026/07/17', -1), '');
  assert.equal(addDays('2026-7-5', -1), '');
  assert.equal(addDays(null, -1), '');
  assert.equal(addDays(undefined, 1), '');
});

test('businessDayKST: cutoff 이전 전날 귀속이 addDays 경유 후에도 유지', () => {
  // 2026-07-18 01:00 KST = 2026-07-17T16:00:00Z → 근무일은 07-17
  assert.equal(businessDayKST(new Date('2026-07-17T16:00:00Z')), '2026-07-17');
  // 월 경계: 2026-08-01 01:00 KST → 근무일 07-31
  assert.equal(businessDayKST(new Date('2026-07-31T16:00:00Z')), '2026-07-31');
});
