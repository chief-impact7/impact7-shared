import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveClass, moveRegularClass } from './class-move.js';

const student = (enrollments, name = '홍길동') => ({ name, enrollments });
const SPRING = { start: '2026-03-02', end: '2026-07-19' };

test('정상: 해당 기간 정규를 새 반으로 in-place 이동', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106', day: ['월'], start_date: '2026-03-02' }]);
  const r = moveClass(s, { period: SPRING, targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.skipped, false);
  assert.equal(r.before, 'HX106');
  assert.equal(r.after, 'HX108');
  assert.equal(r.updatedEnrollments[0].class_number, '108');
  assert.deepEqual(r.updatedEnrollments[0].day, ['월']);
  assert.equal(r.updatedEnrollments[0].start_date, '2026-03-02');
});

test('skipped: 해당 기간 정규 enrollment 없음 → 원본 불변', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106', start_date: '2026-07-20' }]);
  const r = moveClass(s, { period: SPRING, targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.skipped, true);
  assert.equal(r.updatedEnrollments[0].class_number, '106');
});

test('override 보존 + 경고 없음', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106', naesin_class_override: '2단지강서고1A' }]);
  const r = moveClass(s, { period: SPRING, targetLevelSymbol: 'HX', targetClassNumber: '107' });
  assert.equal(r.updatedEnrollments[0].naesin_class_override, '2단지강서고1A');
  assert.equal(r.warning, null);
});

test('A/B 경고: override 없고 끝자리 홀짝 바뀜(106→107)', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106' }]);
  const r = moveClass(s, { period: SPRING, targetLevelSymbol: 'HX', targetClassNumber: '107' });
  assert.ok(r.warning);
});

test('경고 없음: 끝자리 홀짝 동일(106→108)', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106' }]);
  const r = moveClass(s, { period: SPRING, targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.warning, null);
});

test('enrollments 없는 학생 → skipped, 빈 배열 반환', () => {
  const r = moveClass({ name: '무학생' }, { period: SPRING, targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.skipped, true);
  assert.deepEqual(r.updatedEnrollments, []);
});

test('특강 enrollment는 대상 아님 (정규만 이동)', () => {
  const s = student([
    { class_type: '특강', level_symbol: 'HX', class_number: '900' },
    { class_type: '정규', level_symbol: 'HX', class_number: '106' },
  ]);
  const r = moveClass(s, { period: SPRING, targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.updatedEnrollments[0].class_number, '900');
  assert.equal(r.updatedEnrollments[1].class_number, '108');
});

test('명시 account_type이 class_type보다 우선해 정규 계정만 이동', () => {
  const s = student([
    {
      account_id: 'special', account_type: '특강', class_type: '정규',
      level_symbol: 'SP', class_number: '900',
    },
    {
      account_id: 'regular', account_type: '정규', class_type: '정규',
      level_symbol: 'HX', class_number: '106',
    },
  ]);
  const r = moveClass(s, {
    period: SPRING, targetLevelSymbol: 'HX', targetClassNumber: '108',
  });
  assert.equal(r.updatedEnrollments[0].class_number, '900');
  assert.equal(r.updatedEnrollments[1].class_number, '108');
});

test('accountId 지정 시 해당 계정 정규만 이동하고 계정·휴원 필드를 보존', () => {
  const s = student([
    {
      class_type: '정규', level_symbol: 'HX', class_number: '106',
      account_id: 'regular-a', account_type: '정규',
    },
    {
      class_type: '정규', level_symbol: 'KS', class_number: '132',
      account_id: 'regular-b', account_type: '정규',
      pause_start_date: '2026-07-01', pause_end_date: '2026-07-31', leave_sub_type: '가휴원',
    },
  ]);
  const r = moveClass(s, {
    period: SPRING, targetLevelSymbol: 'KS', targetClassNumber: '134', accountId: 'regular-b',
  });
  assert.equal(r.updatedEnrollments[0].class_number, '106');
  assert.deepEqual(r.updatedEnrollments[1], {
    class_type: '정규', level_symbol: 'KS', class_number: '134',
    account_id: 'regular-b', account_type: '정규',
    pause_start_date: '2026-07-01', pause_end_date: '2026-07-31', leave_sub_type: '가휴원',
  });
});

// ─── moveRegularClass (2026-08-16 반이동 전용 경로) ───
const TODAY = '2026-08-16';
const regular = (over = {}) => ({
  account_id: 'acct-1', account_type: '정규', class_type: '정규',
  level_symbol: 'SP', class_number: '102', day: ['화', '목'], start_date: '2026-03-02',
  naesin_class_override: 'cs-1',
  ...over,
});

test('예약 이동: 활성 반은 이동일 전날까지 유지 + 새 반은 이동일 시작 (같은 계정 2단)', () => {
  const s = student([regular()]);
  const r = moveRegularClass(s, {
    targetLevelSymbol: 'SP', targetClassNumber: '101', targetDay: ['월', '금'],
    moveDate: '2026-08-31', today: TODAY,
  });
  assert.equal(r.skipped, false);
  assert.equal(r.before, 'SP102');
  assert.equal(r.after, 'SP101');
  assert.deepEqual(r.updatedEnrollments.map(e => `${e.level_symbol}${e.class_number} ${e.start_date}~${e.end_date || ''}`), [
    'SP102 2026-03-02~2026-08-30',
    'SP101 2026-08-31~',
  ]);
  assert.equal(r.updatedEnrollments[1].account_id, 'acct-1');
  assert.deepEqual(r.updatedEnrollments[1].day, ['월', '금']);
});

test('즉시(오늘) 이동: 옛 반은 어제까지, 새 반은 오늘부터', () => {
  const s = student([regular()]);
  const r = moveRegularClass(s, {
    targetLevelSymbol: 'SP', targetClassNumber: '104', moveDate: TODAY, today: TODAY,
  });
  assert.deepEqual(r.updatedEnrollments.map(e => `${e.class_number} ${e.start_date}~${e.end_date || ''}`), [
    '102 2026-03-02~2026-08-15',
    '104 2026-08-16~',
  ]);
});

test('예약만 있는 학생 재예약: 공백 조각 없이 예약 항목을 교체', () => {
  const s = student([regular({ start_date: '2026-08-17' })]);
  const r = moveRegularClass(s, {
    targetLevelSymbol: 'AX', targetClassNumber: '101', moveDate: '2026-08-18', today: TODAY,
  });
  assert.equal(r.updatedEnrollments.length, 1);
  assert.equal(r.updatedEnrollments[0].class_number, '101');
  assert.equal(r.updatedEnrollments[0].start_date, '2026-08-18');
});

test('2단 구성 학생의 재이동: 활성 조각 유지 + 기존 예약 조각은 새 예약으로 대체', () => {
  const s = student([
    regular({ end_date: '2026-08-30' }),
    regular({ class_number: '101', start_date: '2026-08-31' }),
  ]);
  const r = moveRegularClass(s, {
    targetLevelSymbol: 'SP', targetClassNumber: '103', moveDate: '2026-09-01', today: TODAY,
  });
  assert.deepEqual(r.updatedEnrollments.map(e => `${e.class_number} ${e.start_date}~${e.end_date || ''}`), [
    '102 2026-03-02~2026-08-31',
    '103 2026-09-01~',
  ]);
});

test('요일 미지정이면 기존 요일 유지, 시작일 없는 레거시 활성 반도 분할', () => {
  const s = student([regular({ start_date: undefined })]);
  const r = moveRegularClass(s, {
    targetLevelSymbol: 'SP', targetClassNumber: '104', moveDate: '2026-08-20', today: TODAY,
  });
  assert.deepEqual(r.updatedEnrollments.map(e => `${e.class_number}~${e.end_date || ''}`), ['102~2026-08-19', '104~']);
  assert.deepEqual(r.updatedEnrollments[1].day, ['화', '목']);
});

test('가드: 과거 이동일·정규 없음·정규 계정 2개는 skipped', () => {
  assert.equal(moveRegularClass(student([regular()]), {
    targetLevelSymbol: 'SP', targetClassNumber: '104', moveDate: '2026-08-15', today: TODAY,
  }).skipped, true);
  assert.equal(moveRegularClass(student([]), {
    targetLevelSymbol: 'SP', targetClassNumber: '104', moveDate: '2026-08-20', today: TODAY,
  }).skipped, true);
  assert.equal(moveRegularClass(student([
    regular(), regular({ account_id: 'acct-2', class_number: '201' }),
  ]), {
    targetLevelSymbol: 'SP', targetClassNumber: '104', moveDate: '2026-08-20', today: TODAY,
  }).skipped, true);
});

test('내신·특강 항목은 건드리지 않고 보존', () => {
  const naesin = { account_id: 'acct-1', account_type: '정규', class_type: '내신', class_number: '내신A', start_date: '2026-09-01', end_date: '2026-09-30' };
  const special = { account_id: 'sp-1', account_type: '특강', class_type: '특강', class_number: '겨울특강', start_date: '2026-12-01' };
  const s = student([regular(), naesin, special]);
  const r = moveRegularClass(s, {
    targetLevelSymbol: 'SP', targetClassNumber: '104', moveDate: '2026-08-31', today: TODAY,
  });
  assert.ok(r.updatedEnrollments.includes(naesin));
  assert.ok(r.updatedEnrollments.includes(special));
});
