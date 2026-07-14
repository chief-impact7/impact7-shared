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

test('computeExpectedArrival — 정규 → 내신 → 정규 복귀 시 반 유형별 시간표를 사용', () => {
  const args = {
    enrollments: [{
      class_type: '정규', level_symbol: 'HA', class_number: '104', day: ['월'],
      start_date: '2026-01-01', schedule: { 월: '19:00' }, naesin_class_override: 'NAESIN1',
    }],
    classSettings: {
      HA104: { schedule: { 월: '16:00' } },
      NAESIN1: { naesin_start: '2026-07-20', naesin_end: '2026-07-26', schedule: { 월: '17:00' } },
    },
    rec: {}, hwTasks: [], testTasks: [], absences: [],
  };

  assert.equal(computeExpectedArrival({ ...args, date: '2026-07-13' }), '16:00');
  assert.equal(computeExpectedArrival({ ...args, date: '2026-07-20' }), '17:00');
  assert.equal(computeExpectedArrival({ ...args, date: '2026-07-27' }), '16:00');
});

test('computeExpectedArrival — 정규 → 자유학기 → 정규 복귀 시 반 유형별 시간표를 사용', () => {
  const args = {
    enrollments: [{
      class_type: '정규', level_symbol: 'HA', class_number: '104', day: ['월'],
      start_date: '2026-01-01', schedule: { 월: '19:00' },
    }],
    classSettings: {
      HA104: {
        schedule: { 월: '16:00' },
        free_start: '2026-08-10', free_end: '2026-08-16', free_schedule: { 월: '18:00' },
      },
    },
    rec: {}, hwTasks: [], testTasks: [], absences: [],
  };

  assert.equal(computeExpectedArrival({ ...args, date: '2026-08-03' }), '16:00');
  assert.equal(computeExpectedArrival({ ...args, date: '2026-08-10' }), '18:00');
  assert.equal(computeExpectedArrival({ ...args, date: '2026-08-17' }), '16:00');
});

test('computeExpectedArrival — 미래 시작 enrollment는 제외', () => {
  const got = computeExpectedArrival({
    enrollments: [{ class_type: '정규', level_symbol: 'HA', class_number: '101', day: '수', start_date: '2026-08-01' }],
    classSettings: { HA101: { schedule: { 수: '17:00' } } },
    rec: {}, hwTasks: [], testTasks: [], absences: [], date: '2026-07-01',
  });
  assert.equal(got, ''); // start_date(08-01) > date(07-01) → 제외
});

// ─── 2026-07-05 적대적 리뷰 회귀 (C1·C7) ───
test('earliestExpectedTime — 한 자리 시각이 섞여도 시각순 최솟값 (사전순 아님)', () => {
  const args = (schedules) => ({
    enrollments: schedules.map((t, i) => ({ schedule: { 월: t }, level_symbol: 'H', class_number: String(100 + i) })),
    dayName: '월', classSettings: {}, date: '2026-07-06',
  });
  assert.equal(earliestExpectedTime(args(['9:30', '10:00'])), '9:30');
  assert.equal(earliestExpectedTime(args(['10:00', '9:30'])), '9:30');
  assert.equal(earliestExpectedTime(args(['09:30', '10:00'])), '09:30');
  assert.equal(earliestExpectedTime(args(['16:00', '9:00'])), '9:00');
});

test('earliestExpectedTime — task·보충 소스 혼합에서도 시각순', () => {
  const got = earliestExpectedTime({
    enrollments: [{ schedule: { 월: '16:00' }, level_symbol: 'H', class_number: '101' }],
    dayName: '월', classSettings: {},
    rec: {}, hwTasks: [{ type: '등원', scheduled_date: '2026-07-06', scheduled_time: '9:30' }],
    testTasks: [], absences: [], date: '2026-07-06',
  });
  assert.equal(got, '9:30');
});

test('earliestExpectedTime — 시각 형식이 하나도 없으면 사전식 폴백 유지', () => {
  const got = earliestExpectedTime({
    enrollments: [{ schedule: { 월: '미정' }, level_symbol: 'H', class_number: '101' }],
    dayName: '월', classSettings: {}, date: '2026-07-06',
  });
  assert.equal(got, '미정');
});

test('computeExpectedArrival — enrollments의 null 원소를 무시 (Firestore 원본 경계)', () => {
  const got = computeExpectedArrival({
    enrollments: [null, { class_type: '정규', level_symbol: 'HA', class_number: '101', day: '수', start_date: '2026-01-01', schedule: { 수: '15:00' } }],
    classSettings: {}, rec: {}, hwTasks: [], testTasks: [], absences: [], date: '2026-07-01',
  });
  assert.equal(got, '15:00');
});

// ─── 2026-07-05 리뷰 P5·P8·P3 회귀 ───
test('isLate — 같은 날 비교 계약: 자정 넘김 보정은 하지 않는다', () => {
  assert.equal(isLate('23:00', '22:00'), true);   // 같은 날 지각
  assert.equal(isLate('21:50', '22:00'), false);  // 정시
  assert.equal(isLate('08:00', '09:00'), false);  // 이른 등원
  assert.equal(isLate('13:05', '13:00'), false);  // 유예 5분 이내
  // 자정 넘김(익일 00:30 vs 예정 22:00)은 시각만으로 방향 구분이 불가능해 판정하지 않는다.
  // DSC 대시보드가 isLate(현재시각, 예정)로 호출하므로 내부 보정 시 아침에 저녁수업
  // 학생 전원이 '미도착'으로 오분류된다 (2026-07-05 적대적 검증에서 확인된 회귀 방지).
  assert.equal(isLate('00:30', '22:00'), false);
  assert.equal(isLate('09:30', '22:00'), false);  // 오전에 본 저녁수업 예정 — 지각 아님
});

test('getDayName — 실존하지 않는 날짜는 rollover 없이 빈 문자열', () => {
  assert.equal(getDayName('2026-02-30'), '');
  assert.equal(getDayName('2026-13-01'), '');
  assert.equal(getDayName('2024-02-29'), '목'); // 윤년 실존 날짜는 정상
});

test('startTime — 소문자 반코드도 classSettings 조회 성공 (표기 차이 흡수)', () => {
  const e = { class_type: '정규', level_symbol: 'ha', class_number: '101' };
  assert.equal(startTime(e, '수', { HA101: { schedule: { 수: '15:00' } } }), '15:00');
});
