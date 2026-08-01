// 이메일 형식 검증 SSoT. HR 여러 화면이 각자 복제하던 정규식을 통일.
// 로컬·도메인·TLD 각 구간에 공백·@ 없이 최소 1자 + '.' 포함만 확인(느슨한 실무 기준).

/** @param {unknown} email */
export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 구 도메인(@gw.impact7.kr) 계정의 저장 표기를 정본(@impact7.kr)으로 통일.
// history_logs·updated_by 등 작성자 필드의 표기가 앱마다 갈리는 것을 막는다.
/** @param {unknown} email */
export function normalizeImpact7Email(email) {
  return String(email || '').replace(/@gw\.impact7\.kr$/i, '@impact7.kr');
}
