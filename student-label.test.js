import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studentFullLabel, normalizeRealLevelGrade } from './student-label.js';

const S = (school, level, grade) => ({ school, level, grade });

test('풀네임 여자중학교 → 봉영여중1', () => {
  assert.equal(studentFullLabel(S('봉영여자중학교', '중등', 1)), '봉영여중1');
});
test('약어 봉영여중 → 봉영여중1 (학부글자 중복 제거)', () => {
  assert.equal(studentFullLabel(S('봉영여중', '중등', 1)), '봉영여중1');
});
test('예외 윤중중 → 윤중중1 (중복 제거 안 함)', () => {
  assert.equal(studentFullLabel(S('윤중중', '중등', 1)), '윤중중1');
});
test('예외 운중중 → 운중중2', () => {
  assert.equal(studentFullLabel(S('운중중', '중등', 2)), '운중중2');
});
test('예외 약어 윤중 → 윤중중1 (levelShort 유지)', () => {
  assert.equal(studentFullLabel(S('윤중', '중등', 1)), '윤중중1');
});
test('예외 약어 운중 → 운중중3 (levelShort 유지)', () => {
  assert.equal(studentFullLabel(S('운중', '중등', 3)), '운중중3');
});
test('초등학교 풀네임 → 양명초6', () => {
  assert.equal(studentFullLabel(S('양명초등학교', '초등', 6)), '양명초6');
});
test('초 약어 → 양명초6 (초초 중복 제거)', () => {
  assert.equal(studentFullLabel(S('양명초', '초등', 6)), '양명초6');
});
test('외국어 → 외: 이화외고2', () => {
  assert.equal(studentFullLabel(S('이화외국어고등학교', '고등', 2)), '이화외고2');
});
test('부속 → 부: 이대부고1', () => {
  assert.equal(studentFullLabel(S('이대부속고등학교', '고등', 1)), '이대부고1');
});
test('사범대부속 → 사대부 (긴 것 우선)', () => {
  assert.equal(studentFullLabel(S('서울사범대부속고등학교', '고등', 1)), '서울사대부고1');
});
test('졸업: 고등 grade 4 → 누적 13 → (졸업+1)', () => {
  assert.equal(studentFullLabel(S('한국고등학교', '고등', 4)), '한국고(졸업+1)');
});
test('누적 학년 보정: 초등 grade 11 → 고2', () => {
  assert.equal(studentFullLabel(S('한국고등학교', '초등', 11)), '한국고2');
});
test('학년 없음 → 학교+학부', () => {
  assert.equal(studentFullLabel(S('양명초등학교', '초등', 0)), '양명초');
});
test('school 빈 값 → 학부+학년만', () => {
  assert.equal(studentFullLabel(S('', '중등', 1)), '중1');
});

test('normalizeRealLevelGrade: 졸업 판정', () => {
  assert.deepEqual(normalizeRealLevelGrade({ level: '고등', grade: 4 }), { level: '졸업', grade: 1, graduated: true });
});
