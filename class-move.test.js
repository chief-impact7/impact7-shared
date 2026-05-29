import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveClass } from './class-move.js';

const student = (enrollments, name = '홍길동') => ({ name, enrollments });

test('정상: 해당 학기 정규를 새 반으로 in-place 이동', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106', semester: '2026-Spring', day: ['월'], start_date: '2026-03-02' }]);
  const r = moveClass(s, { semester: '2026-Spring', targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.skipped, false);
  assert.equal(r.before, 'HX106');
  assert.equal(r.after, 'HX108');
  assert.equal(r.updatedEnrollments[0].class_number, '108');
  assert.deepEqual(r.updatedEnrollments[0].day, ['월']);
  assert.equal(r.updatedEnrollments[0].start_date, '2026-03-02');
});

test('skipped: 해당 학기 정규 enrollment 없음 → 원본 불변', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106', semester: '2026-Winter' }]);
  const r = moveClass(s, { semester: '2026-Spring', targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.skipped, true);
  assert.equal(r.updatedEnrollments[0].class_number, '106');
});

test('override 보존 + 경고 없음', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106', semester: '2026-Spring', naesin_class_override: '2단지강서고1A' }]);
  const r = moveClass(s, { semester: '2026-Spring', targetLevelSymbol: 'HX', targetClassNumber: '107' });
  assert.equal(r.updatedEnrollments[0].naesin_class_override, '2단지강서고1A');
  assert.equal(r.warning, null);
});

test('A/B 경고: override 없고 끝자리 홀짝 바뀜(106→107)', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106', semester: '2026-Spring' }]);
  const r = moveClass(s, { semester: '2026-Spring', targetLevelSymbol: 'HX', targetClassNumber: '107' });
  assert.ok(r.warning);
});

test('경고 없음: 끝자리 홀짝 동일(106→108)', () => {
  const s = student([{ class_type: '정규', level_symbol: 'HX', class_number: '106', semester: '2026-Spring' }]);
  const r = moveClass(s, { semester: '2026-Spring', targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.warning, null);
});

test('enrollments 없는 학생 → skipped, 빈 배열 반환', () => {
  const r = moveClass({ name: '무학생' }, { semester: '2026-Spring', targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.skipped, true);
  assert.deepEqual(r.updatedEnrollments, []);
});

test('특강 enrollment는 대상 아님 (정규만 이동)', () => {
  const s = student([
    { class_type: '특강', level_symbol: 'HX', class_number: '900', semester: '2026-Spring' },
    { class_type: '정규', level_symbol: 'HX', class_number: '106', semester: '2026-Spring' },
  ]);
  const r = moveClass(s, { semester: '2026-Spring', targetLevelSymbol: 'HX', targetClassNumber: '108' });
  assert.equal(r.updatedEnrollments[0].class_number, '900');
  assert.equal(r.updatedEnrollments[1].class_number, '108');
});
