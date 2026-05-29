// 학생의 학교+학부+학년 라벨("봉영여중1") 단일 소스. 순수 함수.
const LEVEL_CUMULATIVE_START = { '초등': 0, '중등': 6, '고등': 9 };
const LEVEL_SHORT = { '초등': '초', '중등': '중', '고등': '고' };
// 긴 패턴 우선(사범대부속이 부속보다 먼저). 한국 학교명 약어.
const SCHOOL_ABBR = [['사범대부속', '사대부'], ['여자', '여'], ['외국어', '외'], ['부속', '부']];
// 학교명 자체가 학부글자로 끝나 levelShort 생략 대상이 아닌 예외(윤중/운중).
const DUP_EXCEPT = new Set(['윤중', '운중']);

export function normalizeRealLevelGrade(s) {
  const gradeNum = parseInt(s?.grade, 10);
  if (isNaN(gradeNum) || gradeNum <= 0) return { level: s?.level || '초등', grade: 0, graduated: false };
  const base = LEVEL_CUMULATIVE_START[s.level] ?? 0;
  const cumulative = base + gradeNum;
  if (cumulative <= 6)  return { level: '초등', grade: cumulative,     graduated: false };
  if (cumulative <= 9)  return { level: '중등', grade: cumulative - 6, graduated: false };
  if (cumulative <= 12) return { level: '고등', grade: cumulative - 9, graduated: false };
  return { level: '졸업', grade: cumulative - 12, graduated: true };
}

function normalizeSchoolForLabel(name) {
  let s = String(name || '').trim().replace(/\s+/g, ' ');
  s = s.replace(/(초등학교|중학교|고등학교|학교)$/, '').trim();
  for (const [a, b] of SCHOOL_ABBR) s = s.split(a).join(b);
  return s;
}

export function studentFullLabel(student) {
  const norm = normalizeRealLevelGrade(student || {});
  const school = normalizeSchoolForLabel(student?.school);
  const lv = LEVEL_SHORT[norm.graduated ? '고등' : norm.level] || '';
  const dup = lv && school.endsWith(lv) && !DUP_EXCEPT.has(school);
  const lvPart = dup ? '' : lv;
  if (norm.graduated) return school ? `${school}${lvPart}(졸업+${norm.grade})` : `졸업+${norm.grade}`;
  return `${school}${lvPart}${norm.grade ? String(norm.grade) : ''}`;
}
