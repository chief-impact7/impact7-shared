import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentSchool,
  formatSchoolLabelFromText,
  normalizeRealLevelGrade,
  schoolLevelGradeLabel,
  schoolLevelFromName,
  canonicalSchoolLabel,
  studentFullLabel,
  studentSearchTerms,
  LEVEL_SHORT,
} from './student-label.js';

test('LEVEL_SHORT: 학부 약어 매핑', () => {
  assert.deepEqual(LEVEL_SHORT, { '초등': '초', '중등': '중', '고등': '고' });
});

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
test('학교+학부+학년 직접 입력 → 화면 공통 축약형', () => {
  assert.equal(schoolLevelGradeLabel({ school: '강서', level: '고등', grade: 1 }), '강서고1');
  assert.equal(schoolLevelGradeLabel({ school: '금옥', level: '중등', grade: 2 }), '금옥중2');
  assert.equal(schoolLevelGradeLabel({ school: '금옥여', level: '중등', grade: 1 }), '금옥여중1');
  assert.equal(schoolLevelGradeLabel({ school: '장승', level: '중등', grade: 2 }), '장승중2');
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

// 학교유형(과학·국제·미술·예술·사대부·외·체육고)은 지역명이 정식명이라 유지
test('학교유형 보호: 경기과학고등학교 → 경기과학고1', () => {
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '경기과학고등학교' })), '경기과학고1');
});
test('학교유형 보호: 부산국제/서울예술/서울체육/경기외국어/서울사대부', () => {
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '부산국제고등학교' })), '부산국제고1');
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '서울예술고등학교' })), '서울예술고1');
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '서울체육고등학교' })), '서울체육고1');
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '경기외국어고등학교' })), '경기외고1');
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '서울사범대부속고등학교' })), '서울사대부고1');
});
test('개별 정식명 보호: 인천하늘고등학교 → 인천하늘고1', () => {
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '인천하늘고등학교' })), '인천하늘고1');
});
test('비숫자 grade("중2")에서 학년 추출 → 염경중2', () => {
  assert.equal(studentFullLabel(SL('중등', '중2', { school_middle: '염경중학교' })), '염경중2');
});
test('비숫자 grade("고1") → 고1', () => {
  assert.equal(studentFullLabel(SL('고등', '고1', { school_high: '양천고등학교' })), '양천고1');
});
// 일반학교는 입력접두 지역명 제거 (버그1)
test('일반학교 지역명 제거: 서울염경중학교 → 염경중1', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '서울염경중학교' })), '염경중1');
});
test('일반학교 지역명 제거: 부산영도초등학교 → 영도초6', () => {
  assert.equal(studentFullLabel(SL('초등', 6, { school_elementary: '부산영도초등학교' })), '영도초6');
});
test('지역명 축약형은 제거: 서울목동중 → 목동중2', () => {
  assert.equal(studentFullLabel(SL('중등', 2, { school_middle: '서울목동중' })), '목동중2');
});
test('지역명 제거 후 1글자는 원복: 서울중 → 서울중1', () => {
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '서울중' })), '서울중1');
});
// 버그3: 학부별 필드 없이 단일 school만 가진 객체(temp_attendance/contacts) 폴백
test('school 단일 폴백: 학부필드 없으면 school로 → 신목초6', () => {
  assert.equal(studentFullLabel({ level: '초등', grade: 6, school: '신목초' }), '신목초6');
});
test('currentSchool 폴백: 학부필드 없으면 school 반환', () => {
  assert.equal(currentSchool({ level: '초등', school: '신목초' }), '신목초');
});
test('학부필드 우선: school_*와 school 둘 다면 school_* 사용', () => {
  assert.equal(currentSchool({ level: '중등', school_middle: '신목', school: '구학교' }), '신목');
});

// className 텍스트 정규화 (비원생·OCR 인식 — 학생 마스터 객체 없을 때)
test('className 텍스트: 서울신가초 6학년 → 신가초6 (지역명 제거)', () => {
  assert.equal(formatSchoolLabelFromText('서울신가초 6학년'), '신가초6');
});
test('className 텍스트: 경인초 / 6학년 → 경인초6', () => {
  assert.equal(formatSchoolLabelFromText('경인초 / 6학년'), '경인초6');
});
test('className 텍스트: 양명초/6 → 양명초6', () => {
  assert.equal(formatSchoolLabelFromText('양명초/6'), '양명초6');
});
test('className 텍스트: 학년 없으면 학교명만, 빈값은 빈문자', () => {
  assert.equal(formatSchoolLabelFromText(''), '');
  assert.equal(formatSchoolLabelFromText('A반'), 'A반');
});

// ─── 2026-07-05 적대적 리뷰 회귀 (C18·C19) ───
test('전각 숫자 학년(２)도 반각으로 정규화해 인식', () => {
  assert.equal(studentFullLabel({ level: '중등', grade: '２', school_middle: '봉영여자중학교' }), '봉영여중2');
  assert.deepEqual(normalizeRealLevelGrade({ level: '고등', grade: '１' }), { level: '고등', grade: 1, graduated: false });
});

test("normalizeRealLevelGrade 멱등 — 자기 출력(level '졸업') 재입력 시 졸업 유지", () => {
  const once = normalizeRealLevelGrade({ level: '고등', grade: 4 });
  assert.deepEqual(once, { level: '졸업', grade: 1, graduated: true });
  assert.deepEqual(normalizeRealLevelGrade(once), { level: '졸업', grade: 1, graduated: true });
});

test('졸업 분기도 전각 학년(１)을 인식 (분기별 파싱 규칙 통일)', () => {
  assert.deepEqual(normalizeRealLevelGrade({ level: '졸업', grade: '１' }), { level: '졸업', grade: 1, graduated: true });
});

// ─── schoolLevelFromName: 학교명 → 학부(초/중/고) 파생 ───
test('정식 접미: 초등학교/중학교/고등학교 확정', () => {
  assert.equal(schoolLevelFromName('금옥중학교'), '중등');
  assert.equal(schoolLevelFromName('강서고등학교'), '고등');
  assert.equal(schoolLevelFromName('금옥여자고등학교'), '고등');
  assert.equal(schoolLevelFromName('신가초등학교'), '초등');
});
test('축약형: 마지막 글자로 파생', () => {
  assert.equal(schoolLevelFromName('금옥중'), '중등');
  assert.equal(schoolLevelFromName('강서고'), '고등');
  assert.equal(schoolLevelFromName('양명초'), '초등');
});
test('지역명 prefix 있어도 파생 (정규화 재사용)', () => {
  assert.equal(schoolLevelFromName('서울염경중학교'), '중등');
  assert.equal(schoolLevelFromName('서울목동중'), '중등');
  assert.equal(schoolLevelFromName('부산영도초등학교'), '초등');
});
test('DUP_EXCEPT bare 학교명 → 미상(공백)', () => {
  assert.equal(schoolLevelFromName('안중'), '');
  assert.equal(schoolLevelFromName('서초'), '');
  assert.equal(schoolLevelFromName('윤중'), '');
});
test('DUP_EXCEPT라도 정식 접미가 있으면 확정', () => {
  assert.equal(schoolLevelFromName('안중중학교'), '중등');
  assert.equal(schoolLevelFromName('안중고등학교'), '고등');
  assert.equal(schoolLevelFromName('안중중'), '중등');
});
test('학교유형(과학·국제·외 등)도 축약형 마지막 글자로 파생', () => {
  assert.equal(schoolLevelFromName('부산국제고'), '고등');
  assert.equal(schoolLevelFromName('경기과학고'), '고등');
  assert.equal(schoolLevelFromName('경기외고'), '고등');
});
test('불명/빈값 → 미상(공백)', () => {
  assert.equal(schoolLevelFromName(''), '');
  assert.equal(schoolLevelFromName(null), '');
  assert.equal(schoolLevelFromName('A반'), '');
  assert.equal(schoolLevelFromName('금옥학교'), '');
});
test('학교급 접미(초등/중등/고등)도 인식', () => {
  assert.equal(schoolLevelFromName('금옥중등'), '중등');
  assert.equal(schoolLevelFromName('강서고등'), '고등');
  assert.equal(schoolLevelFromName('양명초등'), '초등');
  assert.equal(schoolLevelFromName('안중고등'), '고등');
});

// ─── canonicalSchoolLabel: 학교명 표기 통일 ───
test('canonical: 표기 편차를 한 라벨로 통일', () => {
  assert.equal(canonicalSchoolLabel('금옥중학교'), '금옥중');
  assert.equal(canonicalSchoolLabel('금옥중'), '금옥중');
  assert.equal(canonicalSchoolLabel('금옥중등'), '금옥중');
});
test('canonical: 고등·여자·지역명 정규화', () => {
  assert.equal(canonicalSchoolLabel('강서고등학교'), '강서고');
  assert.equal(canonicalSchoolLabel('강서고'), '강서고');
  assert.equal(canonicalSchoolLabel('금옥여자고등학교'), '금옥여고');
  assert.equal(canonicalSchoolLabel('서울염경중학교'), '염경중');
  assert.equal(canonicalSchoolLabel('염경중'), '염경중');
});
test('canonical: DUP_EXCEPT는 학부약어 유지, bare 미상은 정규화만', () => {
  assert.equal(canonicalSchoolLabel('안중중학교'), '안중중');
  assert.equal(canonicalSchoolLabel('안중중'), '안중중');
  assert.equal(canonicalSchoolLabel('안중'), '안중');
});
test('canonical: 초등 표기 통일 + DUP_EXCEPT(서초) 유지', () => {
  assert.equal(canonicalSchoolLabel('양명초등학교'), '양명초');
  assert.equal(canonicalSchoolLabel('양명초'), '양명초');
  assert.equal(canonicalSchoolLabel('양명초등'), '양명초');
  assert.equal(canonicalSchoolLabel('서초'), '서초');
  assert.equal(canonicalSchoolLabel('서초등학교'), '서초');
});
// 지역명유지 학교유형(과학·국제·사대부·외 등)은 bare 축약형도 정식형과 같은 라벨로 통일돼야 한다.
// stem에 학부 글자(고)가 남으면 지역명 접미 판정이 어긋나 지역명이 잘못 제거되는 회귀를 막는다.
test('canonical: 지역명유지 학교유형은 축약형·정식형이 같은 라벨', () => {
  assert.equal(canonicalSchoolLabel('경기과학고등학교'), '경기과학고');
  assert.equal(canonicalSchoolLabel('경기과학고'), '경기과학고');
  assert.equal(canonicalSchoolLabel('부산국제고'), '부산국제고');
  assert.equal(canonicalSchoolLabel('서울사대부고'), '서울사대부고');
  assert.equal(canonicalSchoolLabel('서울외국어고등학교'), '서울외고');
  assert.equal(canonicalSchoolLabel('서울외고'), '서울외고');
  assert.equal(canonicalSchoolLabel('인천하늘고'), '인천하늘고');
});
test('canonical: 앞뒤·중간 공백 정규화', () => {
  assert.equal(canonicalSchoolLabel('  금옥중학교  '), '금옥중');
  assert.equal(canonicalSchoolLabel('금옥 중학교'), '금옥중');
});
test('canonical: 빈/불명값', () => {
  assert.equal(canonicalSchoolLabel(''), '');
  assert.equal(canonicalSchoolLabel(null), '');
  assert.equal(canonicalSchoolLabel('A반'), 'A반');
});
test('앞뒤·중간 공백 정규화 후 판정 (정식 접미가 trim에 의존)', () => {
  assert.equal(schoolLevelFromName('  강서고  '), '고등');
  assert.equal(schoolLevelFromName('금옥중학교 '), '중등');
  assert.equal(schoolLevelFromName('금옥 중학교'), '중등');
});
test('지역명이 정식명 일부라 1글자 남는 학교(서울고·서울중) — 원복 후 판정', () => {
  assert.equal(schoolLevelFromName('서울고'), '고등');
  assert.equal(schoolLevelFromName('서울중'), '중등');
});

// ─── normalizeSchoolForLabel 선재 버그 회귀 (2026-07-05) ───
// 지역명유지 학교유형(과학·국제·외 등)의 축약형은 학부글자(고)가 붙어 있어 지역명 접미 판정이 어긋나
// 지역명이 잘못 제거되던 버그(canonical 우회 경로가 아닌 studentFullLabel/schoolLevelGradeLabel 직접 경로).
test('지역명유지 학교유형 축약형: 직접 라벨도 정식형과 일치', () => {
  assert.equal(schoolLevelGradeLabel({ school: '경기과학고', level: '고등', grade: 1 }), '경기과학고1');
  assert.equal(schoolLevelGradeLabel({ school: '경기과학고등학교', level: '고등', grade: 1 }), '경기과학고1');
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '부산국제고' })), '부산국제고1');
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '서울체육고' })), '서울체육고1');
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '인천하늘고' })), '인천하늘고1');
});
// 1글자 접미 '외'(외국어)의 축약형(서울외고·경기외중)도 지역명 유지 — stemNoLevel 판정이
// 지역명을 잘못 떼지 않아야 한다. 실 학교명 '외X고/중'은 모두 외국어 특목이라 지역명이 정식명 일부.
test('1글자 접미 외: 지역명유지 축약형 직접 라벨', () => {
  assert.equal(studentFullLabel(SL('고등', 1, { school_high: '서울외고' })), '서울외고1');
  assert.equal(schoolLevelGradeLabel({ school: '경기외고', level: '고등', grade: 1 }), '경기외고1');
  // 일반학교 지역명 제거는 회귀 없이 유지되어야 한다(센티넬).
  assert.equal(studentFullLabel(SL('중등', 2, { school_middle: '서울목동중' })), '목동중2');
});
// 공백 낀 지역명('서울 염경중학교')에서 지역명 prefix 제거 후 앞 공백이 남지 않아야 한다.
test('공백 낀 지역명: prefix 제거 후 앞 공백 잔존 안 함', () => {
  assert.equal(schoolLevelGradeLabel({ school: '서울 염경중학교', level: '중등', grade: 1 }), '염경중1');
  assert.equal(studentFullLabel(SL('중등', 1, { school_middle: '서울 목동중' })), '목동중1');
  assert.equal(formatSchoolLabelFromText('서울 염경중 1학년'), '염경중1');
});
