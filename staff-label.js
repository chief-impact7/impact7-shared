// impact7 공유 — 담당자/작성자 표시 라벨 (SSoT)
//
// 로그인 계정 이메일에서 도메인(@impact7.kr 등)을 떼고 아이디만 노출한다.
// 표시 전용이며 저장값 변환용이 아니다. 이미 아이디로 저장된 값(@ 없음)은
// 그대로 통과시켜 이중 처리에 안전하다. 빈값·비문자열은 빈 문자열.
export function staffLabel(emailOrId) {
  if (typeof emailOrId !== 'string') return '';
  const t = emailOrId.trim();
  return t.includes('@') ? t.split('@')[0] : t;
}
