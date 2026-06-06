// 학생의 학교+학부+학년 라벨("봉영여중1") 단일 소스. 순수 함수.
const LEVEL_CUMULATIVE_START = { '초등': 0, '중등': 6, '고등': 9 };
const LEVEL_SHORT = { '초등': '초', '중등': '중', '고등': '고' };
export const SCHOOL_FIELD = { '초등': 'school_elementary', '중등': 'school_middle', '고등': 'school_high' };
const SCHOOL_ABBR = [['사범대부속', '사대부'], ['여자', '여'], ['외국어', '외'], ['부속', '부']];
// 광역시/도 — 학교명 앞 지역명 prefix 제거용.
const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
// 학교명이 학부글자로 끝나지만 그 글자가 학부가 아닌 예외(학부글자 유지).
const DUP_EXCEPT = new Set(['서초', '활초', '소초', '속초', '시초', '도초', '백초', '생초', '연초', '윤중', '안중', '영중', '운중', '아중']);
// 지역명이 학교 정식명 일부인 학교유형(접미어·약어 적용 후 stem 기준) — 지역명 prefix 유지.
// 예: 경기과학고·부산국제고·서울예술고·서울사대부고·대원외고·서울체육고.
const REGION_KEEP_SUFFIX = ['과학', '국제', '미술', '예술', '사대부', '외', '체육'];
// 지역명이 정식명이지만 학교유형 접미사가 아닌 개별 학교(stem 완전일치) — 지역명 유지.
const REGION_KEEP_EXACT = new Set(['인천하늘']);

// 현재 학부의 학교명. 학부별 필드(school_elementary/middle/high)에서 현재 level 것.
// 학부별 필드가 없는 객체(temp_attendance·contacts 등 자체 도메인)는 단일 school로 폴백.
export function currentSchool(student) {
  return student?.[SCHOOL_FIELD[student?.level]] || student?.school || '';
}

export function normalizeRealLevelGrade(s) {
  // grade가 '중2'처럼 학부글자 섞인 비정상 입력(진단평가)이어도 첫 숫자그룹만 추출 → 학년 인식.
  const _gm = String(s?.grade ?? '').match(/\d+/);
  const gradeNum = _gm ? parseInt(_gm[0], 10) : NaN;
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
  // 지역명 prefix 제거. 단 학교유형(과학·국제·미술·예술·사대부·외·체육고)은 지역명이
  // 정식명 일부('경기과학고')라 유지. 그 외는 입력접두로 보고 제거('서울염경중'→'염경중').
  if (!REGION_KEEP_SUFFIX.some(k => s.endsWith(k)) && !REGION_KEEP_EXACT.has(s)) {
    for (const r of REGIONS) {
      if (s.startsWith(r) && s.length > r.length) {
        const rest = s.slice(r.length);
        if (rest.length > 1) s = rest;  // 1글자 남으면 원복(예: '서울중')
        break;
      }
    }
  }
  return s;
}

export function schoolLevelGradeLabel({ school = '', level = '', grade = '' } = {}) {
  const norm = normalizeRealLevelGrade({ level, grade });
  const predLevel = norm.graduated ? '고등' : norm.level;
  const normalizedSchool = normalizeSchoolForLabel(school);
  const lv = LEVEL_SHORT[predLevel] || '';
  const dup = lv && normalizedSchool.endsWith(lv) && !DUP_EXCEPT.has(normalizedSchool);
  const lvPart = dup ? '' : lv;
  if (norm.graduated) return `${normalizedSchool}${lvPart}(졸업+${norm.grade})`;
  return `${normalizedSchool}${lvPart}${norm.grade ? String(norm.grade) : ''}`;
}

export function studentFullLabel(student) {
  const norm = normalizeRealLevelGrade(student || {});
  const predLevel = norm.graduated ? '고등' : norm.level;
  return schoolLevelGradeLabel({
    school: student?.[SCHOOL_FIELD[predLevel]] || student?.school || '',
    level: student?.level,
    grade: student?.grade,
  });
}

// 학생 마스터 객체가 없을 때(비원생·OCR 인식) 합쳐진 className 텍스트를 학교라벨로 정규화한다.
// 예) "서울신가초 6학년" → "신가초6", "경인초 / 6학년" → "경인초6", "양명초/6" → "양명초6".
// 학교명 부분에 studentFullLabel과 동일한 normalizeSchoolForLabel(지역명 제거·약어)을 적용하고
// 학년(마지막 숫자그룹)을 결합한다. 학년을 못 찾거나 학교명이 비면 정규화한 학교명(또는 원문)만 반환.
export function formatSchoolLabelFromText(raw) {
  const text = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  const gm = text.match(/(\d+)\s*학년/) || text.match(/[/\s](\d+)\s*$/);
  const grade = gm ? gm[1] : '';
  const schoolRaw = text
    .replace(/[/\s]*\d+\s*학년.*$/, '')
    .replace(/[/\s]+\d+\s*$/, '')
    .trim();
  const school = normalizeSchoolForLabel(schoolRaw);
  if (!school) return text;
  return `${school}${grade}`;
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
