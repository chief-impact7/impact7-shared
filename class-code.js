// impact7 공유 — 반 코드 정규화 (SSoT)
//
// 반 코드는 수기 입력에서 대소문자가 섞인다(ks132 ≡ KS132). 저장·비교 전에
// 대문자로 정규화한다. 한글 코드(특강301 등)는 영향 없다.
// 소비처: impact7db(반 설정·enrollment 코드), payments(미러 동기화 — CJS라 로직 사본 유지).

import { ACCOUNT_TYPES } from './enrollment-status.js';

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

export function classSettingsAccountType(settings) {
  if (!settings) return null;
  if (ACCOUNT_TYPES.includes(settings.account_type)) return settings.account_type;
  if (settings.class_type === '특강') return '특강';
  if (settings.class_type === '기타') return '기타';
  if (!settings.class_type || settings.class_type === '정규') return '정규';
  return null;
}

export function isSelectableAccountClass(accountType, settings) {
  return ACCOUNT_TYPES.includes(accountType) && classSettingsAccountType(settings) === accountType;
}

export function selectableAccountClassCodes(classSettings, accountType) {
  return Object.entries(classSettings || {})
    .filter(([, settings]) => isSelectableAccountClass(accountType, settings))
    .map(([code]) => code)
    .sort((a, b) => a.localeCompare(b, 'ko'));
}

export function accountClassParts(accountType, classCode) {
  const code = normalizeClassCode(classCode);
  if (!code || !ACCOUNT_TYPES.includes(accountType)) return { levelSymbol: '', classNumber: '' };
  if (accountType !== '정규') return { levelSymbol: '', classNumber: code };

  const firstDigit = code.search(/\d/);
  if (firstDigit <= 0) return { levelSymbol: '', classNumber: '' };
  return {
    levelSymbol: code.slice(0, firstDigit),
    classNumber: code.slice(firstDigit),
  };
}

export function validateExistingAccountClass(classSettings, accountType, classCode) {
  if (!classCode) return '등록할 반을 선택하세요.';
  if (!isSelectableAccountClass(accountType, classSettingsGet(classSettings, classCode))) {
    return `"${classCode}"는 반 생성 마법사에서 생성된 ${accountType}반이 아닙니다.`;
  }
  const { levelSymbol, classNumber } = accountClassParts(accountType, classCode);
  if (!classNumber || (accountType === '정규' && !levelSymbol)) {
    return `"${classCode}" 반 코드를 enrollment 형식으로 변환할 수 없습니다.`;
  }
  return null;
}
