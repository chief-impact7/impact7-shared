// nullish→'' 후 숫자만 추출. 아래 세 함수 공통 + 소비자(DSC 메시지센터 수신번호 정규화 등) 직접 사용.
/** @param {unknown} value */
export const digitsOf = (value) => String(value ?? '').replace(/\D/g, '');

/** @param {unknown} value */
export function normalizePhoneDigitsKR(value) {
  let digits = digitsOf(value);
  if (digits.startsWith('0082')) digits = digits.slice(2);

  if (digits.startsWith('82')) {
    const local = digits.slice(2);
    if (/^0\d{8,10}$/.test(local)) return local;
    if (/^\d{8,10}$/.test(local)) return `0${local}`;
  }

  if (digits.startsWith('81')) {
    const local = digits.slice(2);
    if (/^010\d{8}$/.test(local)) return local;
    if (/^10\d{8}$/.test(local)) return `0${local}`;
  }

  if (/^(?:15|16|18)\d{6}$/.test(digits)) return digits;
  if (/^[1-9]\d{7}$/.test(digits)) return `010${digits}`;
  if (/^(?:10|11|16|17|18|19)\d{7,8}$/.test(digits)) return `0${digits}`;
  if (/^2\d{8}$/.test(digits)) return `0${digits}`;
  if (/^(?:3[123]|4[1-4]|5[1-5]|6[1-4]|70|80)\d{7,8}$/.test(digits)) return `0${digits}`;
  return digits;
}

export function legacyStudentPhoneKeyKR(value) {
  const normalized = normalizePhoneDigitsKR(value);
  return normalized.length === 11 && normalized.startsWith('0') ? normalized.slice(1) : normalized;
}

/** @param {string} digits */
function formatDomesticPhoneDigits(digits) {
  if (/^(?:15|16|18)\d{6}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (/^02\d{7,8}$/.test(digits)) return `02-${digits.slice(2, -4)}-${digits.slice(-4)}`;
  if (/^0\d{9,10}$/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, -4)}-${digits.slice(-4)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return '';
}

// 전화번호 표시 포맷. 국내 번호·국가번호·앞자리 생략 표기를 국내 표준 하이픈 형식으로 통일.
// 정규화할 수 없는 값은 원본 string, null/undefined는 '' 반환.
/** @param {unknown} phone */
export function formatPhone(phone) {
  const formatted = formatDomesticPhoneDigits(normalizePhoneDigitsKR(phone));
  if (formatted) return formatted;
  return phone == null ? '' : String(phone);
}

// 휴대폰 번호 검증. 숫자만 추출 후 01[016789] + 7~8자리(총 10-11자리), 하이픈·공백 유무 무관.
// HR에 흩어져 있던 3종 정규식(11자리 고정·10-11자리·하이픈 허용) 중 가장 포용적인 기준으로 통일.
/** @param {unknown} value */
export function isValidPhoneKR(value) {
  return /^01[016789]\d{7,8}$/.test(normalizePhoneDigitsKR(value));
}

// 입력 중 자동 하이픈. 숫자만 추출(최대 11자리)해 점진 3-3~4-4로 분할, 결과는 최대 13자.
// 예: '0101234'→'010-1234', 11자리 '01012345678'→'010-1234-5678'.
/** @param {unknown} value */
export function formatPhoneInput(value) {
  const normalized = normalizePhoneDigitsKR(value);
  const formatted = formatDomesticPhoneDigits(normalized);
  if (formatted) return formatted;

  const digits = normalized.slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
