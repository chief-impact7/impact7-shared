import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studentFullLabel, normalizeRealLevelGrade, currentSchool, studentSearchTerms } from './student-label.js';

const SL = (level, grade, schools) => ({ level, grade, ...schools });

test('풀네임 여자중학교 → 봉영여중1', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '봉영여자중학교' })), '봉영여중1');
});
test('약어 봉영여중 → 봉영여중1 (학부글자 중복 제거)', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '봉영여중' })), '봉영여중1');
});
test('예외 윤중중 → 윤중중1 (중복 제거 안 함)', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '윤중중' })), '윤중중1');
});
test('예외 운중중 → 운중중2', () => {
  assert.equal(studentFullLabel(SL('중등', 2, { school_middle: '운중중' })), '운중중2');
});
test('예외 약어 윤중 → 윤중중1 (levelShort 유지)', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '윤중' })), '윤중중1');
});
test('예외 약어 운중 → 운중중3 (levelShort 유지)', () => {
  assert.equal(studentFullLabel(SL('중등', 3, { school_middle: '운중' })), '운중중3');
});
test('초등학교 풀네임 → 양명초6', () => {
  assert.equal(studentFullLabel(SL('초등', 6, { school_elementary: '양명초등학교' })), '양명초6');
});
test('초 약어 → 양명초6 (초초 중복 제거)', () => {
  assert.equal(studentFullLabel(SL('초등', 6, { school_elementary: '양명초' })), '양명초6');
});
test('외국어 → 외: 이화외고2', () => {
  assert.equal(studentFullLabel(SL('고등', 2, { school_high: '이화외국어고등학교' })), '이화외고2');
});
test('부속 → 부: 이대부고1', () => {
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '이대부속고등학교' })), '이대부고1');
});
test('사범대부속 → 사대부 (긴 것 우선)', () => {
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '서울사범대부속고등학교' })), '서울사대부고1');
});
test('졸업: 고등 grade 4 → 누적 13 → (졸업+1)', () => {
  assert.equal(studentFullLabel(SL('고등', 4, { school_high: '한국고등학교' })), '한국고(졸업+1)');
});
test('누적 학년 보정: 초등 grade 11 → 고2 (예측 학부=고등 학교 읽음)', () => {
  assert.equal(studentFullLabel(SL('초등', 11, { school_high: '한국고등학교' })), '한국고2');
});
test('학년 없음 → 학교+학부', () => {
  assert.equal(studentFullLabel(SL('초등', 0, { school_elementary: '양명초등학교' })), '양명초');
});
test('school 빈 값 → 학부+학년만', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '' })), '중1');
});

test('normalizeRealLevelGrade: 졸업 판정', () => {
  assert.deepEqual(normalizeRealLevelGrade({ level: '고등', grade: 4 }), { level: '졸업', grade: 1, graduated: true });
});

test('currentSchool: 현재 학부 필드 반환', () => {
  assert.equal(currentSchool({ level: '중등', school_middle: '봉영여중', school_elementary: '양명초' }), '봉영여중');
});
test('currentSchool: 해당 학부 빈값이면 빈 문자열', () => {
  assert.equal(currentSchool({ level: '고등', school_middle: '봉영여중' }), '');
});
test('label: 중등1 → school_middle 읽음', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '봉영여자중학교' })), '봉영여중1');
});
test('지역명 제거: 서울목동중 → 목동중2', () => {
  assert.equal(studentFullLabel(SL('중등', 2, { school_middle: '서울목동중' })), '목동중2');
});
test('지역명+학부만 → 원복: 서울중 → 서울중1', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '서울중' })), '서울중1');
});
test('지역명 풀네임: 서울중학교 → 서울중1', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '서울중학교' })), '서울중1');
});
test('예외 서초: 서초 → 서초초3', () => {
  assert.equal(studentFullLabel(SL('초등', 3, { school_elementary: '서초' })), '서초초3');
});
test('예외 안중: 안중 → 안중중2', () => {
  assert.equal(studentFullLabel(SL('중등', 2, { school_middle: '안중' })), '안중중2');
});
test('일반 약어 양명초 → 양명초6 (중복 제거)', () => {
  assert.equal(studentFullLabel(SL('초등', 6, { school_elementary: '양명초' })), '양명초6');
});

test('누적 중등7 + 고 학교 미입력 → 고(졸업+1) (학교 없이)', () => {
  assert.equal(studentFullLabel(SL('중등', 7, { school_middle: '봉영여' })), '고(졸업+1)');
});
test('중등4 + 고 학교 미입력 → 고1 (진학 예측, 중4 아님)', () => {
  assert.equal(studentFullLabel(SL('중등', 4, { school_middle: '봉영여' })), '고1');
});
test('중등4 + 고 학교 입력 → 대일고1', () => {
  assert.equal(studentFullLabel(SL('중등', 4, { school_middle: '봉영여', school_high: '대일' })), '대일고1');
});
test('봉영여중3 (예측=기록 중등) → 봉영여중3 (무영향)', () => {
  assert.equal(studentFullLabel(SL('중등', 3, { school_middle: '봉영여중' })), '봉영여중3');
});
test('졸업 + 고 학교 없음 → 고(졸업+6)', () => {
  assert.equal(studentFullLabel(SL('중등', 12, { school_middle: '봉영여' })), '고(졸업+6)');
});

test('studentSearchTerms: 신목 중2 → [신목, 신목중, 신목중2]', () => {
  assert.deepEqual(studentSearchTerms(SL('중등', 2, { school_middle: '신목' })), ['신목', '신목중', '신목중2']);
});
test('studentSearchTerms: 진명여자고등학교 고1 → 정규화 [진명여, 진명여고, 진명여고1]', () => {
  assert.deepEqual(studentSearchTerms(SL('고등', 1, { school_high: '진명여자고등학교' })), ['진명여', '진명여고', '진명여고1']);
});
test('studentSearchTerms: 빈 학교 중2 → [중2]', () => {
  assert.deepEqual(studentSearchTerms(SL('중등', 2, {})), ['중2']);
});
test('studentSearchTerms: 서초 중2 (DUP_EXCEPT) → [서초, 서초중, 서초중2]', () => {
  assert.deepEqual(studentSearchTerms(SL('중등', 2, { school_middle: '서초' })), ['서초', '서초중', '서초중2']);
});
test('studentSearchTerms: 졸업 예측 → [대일, 대일고, 대일고(졸업+1)]', () => {
  assert.deepEqual(studentSearchTerms(SL('중등', 7, { school_middle: '봉영여', school_high: '대일' })), ['대일', '대일고', '대일고(졸업+1)']);
});
