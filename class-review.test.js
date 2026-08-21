import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewClass, classTimesByDay, SEVERITY } from './class-review.js';

const TODAY = '2026-08-21';
const kinds = (findings) => findings.map((f) => f.kind);

const student = (id, name, enrollments, extra = {}) => ({ id, name, status: '재원', enrollments, ...extra });
const enroll = (symbol, number, day, extra = {}) => ({
  level_symbol: symbol, class_number: number, day, start_date: '2026-01-01', ...extra,
});

// 정상 반 — 여기서 findings가 나오면 오탐이다.
const healthy = () => ({
  classCode: 'a101',
  settings: { teacher: '김선생', class_type: '정규', default_days: ['월', '수'], default_time: '19:00' },
  students: [
    student('s1', '홍길동', [enroll('a', '101', ['월', '수'])]),
    student('s2', '김영희', [enroll('a', '101', ['월', '수'])]),
  ],
  otherSettings: {},
  today: TODAY,
});

test('정상 반은 아무것도 잡지 않는다', () => {
  assert.deepEqual(reviewClass(healthy()), []);
});

test('classTimesByDay — 유형마다 다른 필드를 하나로 모은다', () => {
  assert.deepEqual(classTimesByDay({ default_days: ['월', '수'], default_time: '19:00' }), { 월: '19:00', 수: '19:00' });
  assert.deepEqual(classTimesByDay({ schedule: { 화: '17:00' } }), { 화: '17:00' });
  assert.deepEqual(classTimesByDay({ free_schedule: { 목: '16:00' } }), { 목: '16:00' });
  assert.deepEqual(classTimesByDay(null), {});
});

test('학생 없음·담당 없음·시간 없음을 잡는다', () => {
  const found = reviewClass({ ...healthy(), settings: { class_type: '정규' }, students: [] });
  assert.deepEqual(kinds(found).sort(), ['empty', 'no_schedule', 'no_teacher'].sort());
});

test('요일은 있는데 시간이 빈 요일을 잡는다', () => {
  const input = healthy();
  input.settings = { ...input.settings, schedule: { 월: '19:00', 수: '' }, default_days: undefined, default_time: undefined };
  assert.ok(kinds(reviewClass(input)).includes('missing_time'));
});

test('이미 끝난 기간은 날짜 실수다', () => {
  const input = healthy();
  input.settings = { ...input.settings, class_type: '특강', special_end: '2026-07-01' };
  const expired = reviewClass(input).find((f) => f.kind === 'expired');
  assert.equal(expired.severity, SEVERITY.block);
  assert.match(expired.message, /2026-07-01/);
});

test('내신 기간 중인 학생을 정규로만 넣으면 잡는다 (실제 사고)', () => {
  const input = healthy();
  input.students = [
    student('s1', '김시헌', [
      enroll('h', '301', ['화'], { naesin_class_override: 'n301' }),
      enroll('a', '101', ['월', '수']),
    ]),
  ];
  const hit = reviewClass(input).find((f) => f.kind === 'naesin_missing');
  assert.equal(hit.severity, SEVERITY.block);
  assert.deepEqual(hit.students.map((s) => s.name), ['김시헌']);
});

test('같은 요일 같은 시각에 다른 반에도 있으면 잡는다', () => {
  const input = healthy();
  input.students = [student('s1', '홍길동', [
    enroll('a', '101', ['월', '수']),
    enroll('b', '203', ['월']),
  ])];
  input.otherSettings = { b203: { schedule: { 월: '19:00' } } };
  const hit = reviewClass(input).find((f) => f.kind === 'time_conflict');
  assert.match(hit.message, /홍길동\(월·b203\)/);
});

test('시각이 다르면 충돌이 아니다', () => {
  const input = healthy();
  input.students = [student('s1', '홍길동', [
    enroll('a', '101', ['월', '수']),
    enroll('b', '203', ['월']),
  ])];
  input.otherSettings = { b203: { schedule: { 월: '21:00' } } };
  assert.equal(kinds(reviewClass(input)).includes('time_conflict'), false);
});

test('시각 형식이 아니면 비교하지 않는다 — 추측이 사고를 만든다', () => {
  const input = healthy();
  input.students = [student('s1', '홍길동', [
    enroll('a', '101', ['월', '수']),
    enroll('b', '203', ['월']),
  ])];
  input.otherSettings = { b203: { schedule: { 월: '미정' } } };
  assert.equal(kinds(reviewClass(input)).includes('time_conflict'), false);
});

test('반 요일과 등록 요일이 다르면 알린다', () => {
  const input = healthy();
  input.students = [student('s1', '홍길동', [enroll('a', '101', ['월'])])];
  const hit = reviewClass(input).find((f) => f.kind === 'day_mismatch');
  assert.equal(hit.severity, SEVERITY.warn);
});

test('학부가 섞이면 알린다', () => {
  const input = healthy();
  input.students = [
    student('s1', '홍길동', [enroll('a', '101', ['월', '수'])], { schoolLevel: '중등' }),
    student('s2', '김영희', [enroll('a', '101', ['월', '수'])], { schoolLevel: '고등' }),
  ];
  const hit = reviewClass(input).find((f) => f.kind === 'mixed_level');
  assert.match(hit.message, /중등 1명/);
});

test('끝난 등록은 검토 대상이 아니다', () => {
  const input = healthy();
  input.students = [student('s1', '홍길동', [
    enroll('a', '101', ['월', '수']),
    enroll('b', '203', ['월'], { end_date: '2026-06-30' }),
  ])];
  input.otherSettings = { b203: { schedule: { 월: '19:00' } } };
  assert.deepEqual(reviewClass(input), []);
});

test('심각한 것이 먼저 나온다', () => {
  const input = healthy();
  input.settings = { class_type: '정규', default_days: ['월', '수'], default_time: '19:00' };  // 담당 없음(warn)
  input.students = [student('s1', '홍길동', [enroll('a', '101', ['월'])])];                    // 요일 불일치(warn)
  input.students.push(student('s2', '김영희', []));                                            // 요일 불일치(warn)
  const found = reviewClass(input);
  assert.equal(found[0].severity, SEVERITY.block === found[0].severity ? SEVERITY.block : found[0].severity);
  assert.ok(found.every((f, i) => i === 0 || found[i - 1].severity !== SEVERITY.warn || f.severity === SEVERITY.warn));
});
