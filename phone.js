// nullish→'' 후 숫자만 추출. 아래 세 함수 공통 + 소비자(DSC 메시지센터 수신번호 정규화 등) 직접 사용.
export const digitsOf = (value) => String(value ?? '').replace(/\D/g, '');

// 전화번호 표시 포맷. 11자리만 하이픈 분할(010-1234-5678), 그 외는 원본 반환.
// null/undefined는 '' 반환. 반환은 항상 string(숫자 입력도 문자열화 — 계약 '→ string').
export function formatPhone(phone) {
  const cleaned = digitsOf(phone);
  if (cleaned.length === 11) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  return phone == null ? '' : String(phone);
}

// 휴대폰 번호 검증. 숫자만 추출 후 01[016789] + 7~8자리(총 10-11자리), 하이픈·공백 유무 무관.
// HR에 흩어져 있던 3종 정규식(11자리 고정·10-11자리·하이픈 허용) 중 가장 포용적인 기준으로 통일.
export function isValidPhoneKR(value) {
  return /^01[016789]\d{7,8}$/.test(digitsOf(value));
}

// 입력 중 자동 하이픈. 숫자만 추출(최대 11자리)해 점진 3-3~4-4로 분할, 결과는 최대 13자.
// 예: '0101234'→'010-1234', 11자리 '01012345678'→'010-1234-5678'.
export function formatPhoneInput(value) {
  const digits = digitsOf(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
