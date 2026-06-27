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
