import { test } from 'node:test';
import assert from 'node:assert';
import {
  getDayName, normalizedDays, startTime, earliestExpectedTime, computeExpectedArrival, isLate,
} from './expected-arrival.js';

test('getDayName — TZ 무관 한글 요일', () => {
  assert.equal(getDayName('2026-07-01'), '수'); // 2026-07-01 = 수요일
  assert.equal(getDayName('2026-07-04'), '토');
});

test('normalizedDays — 요일 접미·구분자 정규화', () => {
  assert.deepEqual(normalizedDays('월,수·금'), ['월', '수', '금']);
  assert.deepEqual(normalizedDays(['월요일', '수요일']), ['월', '수']);
  assert.deepEqual(normalizedDays(''), []);
});

test('startTime — enrollment.schedule 우선', () => {
  assert.equal(startTime({ schedule: { 수: '16:00' } }, '수', {}), '16:00');
  assert.equal(startTime({ level_symbol: 'HA', class_number: '101' }, '수', { HA101: { schedule: { 수: '17:30' } } }), '17:30');
  assert.equal(startTime({ start_time: '15:00' }, '수', {}), '15:00');
  assert.equal(startTime({}, '수', {}), '');
});

test('earliestExpectedTime — 여러 소스 중 가장 이른 값', () => {
  const got = earliestExpectedTime({
    enrollments: [{ schedule: { 수: '16:00' } }],
    dayName: '수', classSettings: {},
    rec: { extra_visit: { date: '2026-07-01', time: '15:30' } },
    hwTasks: [{ type: '등원', scheduled_date: '2026-07-01', scheduled_time: '15:00' }],
    testTasks: [], absences: [], date: '2026-07-01',
  });
  assert.equal(got, '15:00'); // task 15:00 < extra 15:30 < 정규 16:00
});

test('earliestExpectedTime — 후보 없으면 빈 문자열', () => {
  assert.equal(earliestExpectedTime({
    enrollments: [], dayName: '수', classSettings: {}, rec: {}, hwTasks: [], testTasks: [], absences: [], date: '2026-07-01',
  }), '');
});

test('computeExpectedArrival — 정규 시간표(오늘 요일) 반영', () => {
  const got = computeExpectedArrival({
    enrollments: [{ class_type: '정규', level_symbol: 'HA', class_number: '101', day: '월,수', start_date: '2026-01-01' }],
    classSettings: { HA101: { schedule: { 월: '16:00', 수: '17:00' } } },
    rec: {}, hwTasks: [], testTasks: [], absences: [], date: '2026-07-01', // 수요일
  });
  assert.equal(got, '17:00');
});

test('computeExpectedArrival — 오늘 요일 수업 없으면 빈 문자열(정규만)', () => {
  const got = computeExpectedArrival({
    enrollments: [{ class_type: '정규', level_symbol: 'HA', class_number: '101', day: '월', start_date: '2026-01-01' }],
    classSettings: { HA101: { schedule: { 월: '16:00' } } },
    rec: {}, hwTasks: [], testTasks: [], absences: [], date: '2026-07-01', // 수요일
  });
  assert.equal(got, '');
});

test('computeExpectedArrival — 결석 보충 makeup_time 반영', () => {
  const got = computeExpectedArrival({
    enrollments: [], classSettings: {}, rec: {}, hwTasks: [], testTasks: [],
    absences: [{ resolution: '보충', makeup_date: '2026-07-01', status: 'pending', makeup_status: 'pending', makeup_time: '14:00' }],
    date: '2026-07-01',
  });
  assert.equal(got, '14:00');
});

test('isLate — 예정+5분 초과만 지각', () => {
  assert.equal(isLate('16:06', '16:00'), true);
  assert.equal(isLate('16:05', '16:00'), false); // 경계(정확히 +5분)는 출석
  assert.equal(isLate('16:00', '16:00'), false);
  assert.equal(isLate('16:06', ''), false);      // 예정 없음 → 지각 아님
  assert.equal(isLate('', '16:00'), false);
});

test('getDayName — 일/월 (TZ 무관 확인 보강)', () => {
  assert.equal(getDayName('2026-07-05'), '일');
  assert.equal(getDayName('2026-07-06'), '월');
});

test('computeExpectedArrival — 내신 파생(override 활성) 시각', () => {
  const got = computeExpectedArrival({
    enrollments: [{ class_type: '정규', level_symbol: 'HA', class_number: '101', day: '월,수', start_date: '2026-01-01', naesin_class_override: 'NAESIN1' }],
    classSettings: {
      HA101: { schedule: { 월: '16:00', 수: '17:00' } },
      NAESIN1: { naesin_start: '2026-06-01', naesin_end: '2026-07-31', schedule: { 수: '18:00' } },
    },
    rec: {}, hwTasks: [], testTasks: [], absences: [], date: '2026-07-01', // 수요일, 내신기간 활성
  });
  assert.equal(got, '18:00'); // 내신 파생 → NAESIN1.schedule[수]
});

test('computeExpectedArrival — 미래 시작 enrollment는 제외', () => {
  const got = computeExpectedArrival({
    enrollments: [{ class_type: '정규', level_symbol: 'HA', class_number: '101', day: '수', start_date: '2026-08-01' }],
    classSettings: { HA101: { schedule: { 수: '17:00' } } },
    rec: {}, hwTasks: [], testTasks: [], absences: [], date: '2026-07-01',
  });
  assert.equal(got, ''); // start_date(08-01) > date(07-01) → 제외
});
