// 전화번호 표시 포맷. 11자리만 하이픈 분할(010-1234-5678), 그 외는 원본 반환.
// null/undefined는 '' 반환. 반환은 항상 string(숫자 입력도 문자열화 — 계약 '→ string').
export function formatPhone(phone) {
  const cleaned = String(phone ?? '').replace(/\D/g, '');
  if (cleaned.length === 11) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  return phone == null ? '' : String(phone);
}
