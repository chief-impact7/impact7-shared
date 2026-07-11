// HTML escape (순수 문자열). DOM 없이 innerHTML/속성 삽입 안전화.
// & < > " ' 5종 모두 escape — DSC 5종 버전 채택(DB의 3종보다 안전).
const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// innerHTML 텍스트 삽입용. null/undefined → ''.
export function esc(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

// HTML 속성용 — esc와 동일 5종 escape로 통일.
export { esc as escAttr };
