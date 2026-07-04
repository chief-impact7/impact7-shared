// impact7 공유 — 반 코드 정규화 (SSoT)
//
// 반 코드는 수기 입력에서 대소문자가 섞인다(ks132 ≡ KS132). 저장·비교 전에
// 대문자로 정규화한다. 한글 코드(특강301 등)는 영향 없다.
// 소비처: impact7db(반 설정·enrollment 코드), payments(미러 동기화 — CJS라 로직 사본 유지).

export function normalizeClassCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}
