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

// 내부 도메인 — 구(@gw.impact7.kr)·신(@impact7.kr)만 같은 사람으로 로컬파트 병합.
// 외부 도메인(gmail 등)의 같은 로컬파트를 오병합하지 않기 위한 경계.
const INTERNAL_DOMAINS = new Set(['impact7.kr', 'gw.impact7.kr']);
const _isInternal = (domain) => !domain || INTERNAL_DOMAINS.has(domain); // 도메인 없는 ID는 내부로 간주

// 같은 사람인지 — 구·신 내부 메일(또는 도메인 없는 ID)은 로컬파트 비교,
// 외부 도메인은 도메인까지 일치해야 같은 사람.
export function isSameTeacher(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const [la, da = ''] = a.toLowerCase().split('@');
  const [lb, db = ''] = b.toLowerCase().split('@');
  if (la !== lb) return false;
  return (_isInternal(da) && _isInternal(db)) || da === db;
}

// 구(@gw.impact7.kr)·신(@impact7.kr) 메일이 공존하는 teachers 목록을 사람당 1건으로 정규화.
// 같은 로컬파트는 신메일(@impact7.kr)을 우선하고, 순서는 첫 등장 위치를 보존한다.
// 외부 도메인 메일은 내부와 병합하지 않고 자체 키(로컬@도메인)로 dedup만 한다.
export function canonicalizeTeacherEmails(emails) {
  const byPerson = new Map();
  for (const email of emails ?? []) {
    if (typeof email !== 'string' || !email) continue;
    const [local, domain = ''] = email.toLowerCase().split('@');
    const key = _isInternal(domain) ? local : `${local}@${domain}`;
    const prev = byPerson.get(key);
    if (!prev || domain === 'impact7.kr') byPerson.set(key, email);
  }
  return [...byPerson.values()];
}
