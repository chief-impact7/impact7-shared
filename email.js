// 이메일 형식 검증 SSoT. HR 여러 화면이 각자 복제하던 정규식을 통일.
// 로컬·도메인·TLD 각 구간에 공백·@ 없이 최소 1자 + '.' 포함만 확인(느슨한 실무 기준).

/** @param {unknown} email */
export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
