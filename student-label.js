// 학생의 학교+학부+학년 라벨("봉영여중1") 단일 소스. 순수 함수.
const LEVEL_CUMULATIVE_START = { '초등': 0, '중등': 6, '고등': 9 };
const LEVEL_SHORT = { '초등': '초', '중등': '중', '고등': '고' };
export const SCHOOL_FIELD = { '초등': 'school_elementary', '중등': 'school_middle', '고등': 'school_high' };
const SCHOOL_ABBR = [['사범대부속', '사대부'], ['여자', '여'], ['외국어', '외'], ['부속', '부']];
// 광역시/도 — 학교명 앞 지역명 prefix 제거용.
const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
// 학교명이 학부글자로 끝나지만 그 글자가 학부가 아닌 예외(학부글자 유지).
const DUP_EXCEPT = new Set(['서초', '활초', '소초', '속초', '시초', '도초', '백초', '생초', '연초', '윤중', '안중', '영중', '운중', '아중']);

// 현재 학부의 학교명. 학부별 필드(school_elementary/middle/high)에서 현재 level 것.
export function currentSchool(student) {
  return student?.[SCHOOL_FIELD[student?.level]] || '';
}

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
  // 지역명 prefix 제거. 남은 글자가 2글자 이상이고 학부글자(초/중/고)로 끝날 때만 제거(빈값·1글자는 원복).
  for (const r of REGIONS) {
    if (s.startsWith(r) && s.length > r.length) {
      const rest = s.slice(r.length);
      if (rest.length > 1 && /[초중고]$/.test(rest)) s = rest;
      break;
    }
  }
  return s;
}

export function studentFullLabel(student) {
  const norm = normalizeRealLevelGrade(student || {});
  const predLevel = norm.graduated ? '고등' : norm.level;
  const school = normalizeSchoolForLabel(student?.[SCHOOL_FIELD[predLevel]] || '');
  const lv = LEVEL_SHORT[predLevel] || '';
  const dup = lv && school.endsWith(lv) && !DUP_EXCEPT.has(school);
  const lvPart = dup ? '' : lv;
  if (norm.graduated) return `${school}${lvPart}(졸업+${norm.grade})`;
  return `${school}${lvPart}${norm.grade ? String(norm.grade) : ''}`;
}

// 검색어 후보 [학교, 학교+학부글자, 풀라벨]. studentFullLabel과 동일 기준(정규화·예측학부·졸업)으로
// 표시와 검색을 일치시킨다. 풀라벨에서 학년/졸업 꼬리를 떼어 상위 단계를 복원.
export function studentSearchTerms(student) {
  const full = studentFullLabel(student);
  if (!full) return [];
  const norm = normalizeRealLevelGrade(student || {});
  const predLevel = norm.graduated ? '고등' : norm.level;
  const lv = LEVEL_SHORT[predLevel] || '';

  let schoolPlusLevel = full;
  if (norm.graduated) {
    schoolPlusLevel = full.replace(/\(졸업\+\d+\)$/, '');
  } else if (norm.grade) {
    const g = String(norm.grade);
    schoolPlusLevel = full.endsWith(g) ? full.slice(0, -g.length) : full;
  }

  const school = lv && schoolPlusLevel.endsWith(lv)
    ? schoolPlusLevel.slice(0, -lv.length)
    : schoolPlusLevel;

  if (!school) return [full];
  return Array.from(new Set([school, schoolPlusLevel, full]));
}
