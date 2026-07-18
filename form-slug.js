// 공개 폼 주소(slug)로 쓸 수 없는 시스템 경로. firebase 라우팅·dev 프록시·검증이 공유한다.
export const RESERVED_PUBLIC_SLUGS = new Set([
  "forms-admin",
  "forms",
  "assets",
  "vendor",
  "src",
  "design",
  "index",
  "form",
  "favicon"
]);

// 응답 주소(slug)로 쓸 수 없는 예약 경로. `/{slug}/uploads`가 파일 업로드 경로라 응답용 금지.
export const RESERVED_RESPONSE_SLUGS = new Set(["uploads"]);

// 자유 텍스트 → slug: trim → 소문자 → 영숫자 외 구간을 '-'로 → 양끝 '-' 제거 → 최대 60자.
// 폼 스튜디오(클라)·Cloud Run(서버)이 동일 주소를 생성해야 하는 SSoT.
export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
