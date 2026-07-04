// impact7 공유 — 담임(교수) 규약 (SSoT)
//
// 담임 데이터의 원본은 impact7db의 HR 직원현황(staff)이다: 부서 '교수' + 재직('active')만
// 담임 후보. 표시는 영어이름 첫 토큰에 첫 글자만 대문자 — 'Edward Lee' → 'Edward',
// 'KEN' → 'Ken'. 이메일 로컬파트(edward@…)와 소문자 비교로 매칭한다.
// 소비처: impact7db(반 설정), impact7HR(직원현황), payments(미러 동기화 — CJS라 로직 사본 유지).

export function isActiveTeacher(staff) {
  return staff?.department === '교수' && staff?.status === 'active';
}

export function teacherDisplayName(englishName) {
  if (typeof englishName !== 'string') return '';
  const first = englishName.trim().split(/\s+/)[0];
  if (!first) return '';
  return first[0].toUpperCase() + first.slice(1).toLowerCase();
}
