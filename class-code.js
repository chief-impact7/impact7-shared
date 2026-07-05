// impact7 공유 — 반 코드 정규화 (SSoT)
//
// 반 코드는 수기 입력에서 대소문자가 섞인다(ks132 ≡ KS132). 저장·비교 전에
// 대문자로 정규화한다. 한글 코드(특강301 등)는 영향 없다.
// 소비처: impact7db(반 설정·enrollment 코드), payments(미러 동기화 — CJS라 로직 사본 유지).

export function normalizeClassCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

// classSettings에서 반코드로 설정을 찾는다 — 표기 차이(ks132 ≡ KS132)를 양방향 흡수.
// 정확 일치 → 정규화 키 일치 → 설정 키 쪽이 비정규 표기인 경우 순으로 조회. 못 찾으면 undefined.
export function classSettingsGet(classSettings, code) {
  const cs = classSettings || {};
  const key = String(code ?? '');
  if (!key) return undefined;
  if (cs[key] !== undefined) return cs[key];
  const norm = normalizeClassCode(key);
  if (norm !== key && cs[norm] !== undefined) return cs[norm];
  for (const k of Object.keys(cs)) {
    if (normalizeClassCode(k) === norm) return cs[k];
  }
  return undefined;
}
