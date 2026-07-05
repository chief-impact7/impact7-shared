// impact7 공유 — IME-aware inline 이벤트 어트리뷰트 생성 (표시 전용 SSoT)
//
// HTML 템플릿 문자열로 렌더링하는 학생 상세 패널의 텍스트 입력 문제:
// onchange는 onSnapshot 재렌더가 blur 전 입력을 날리고, oninput은 한국어 IME
// 조합 중(ㅂ→보→보ㅊ→보충) 부분 조합 문자를 저장한다.
// → compositionstart/end로 조합 플래그를 DOM 요소(this._c)에 두고, oninput은
//   조합 중이 아닐 때만 핸들러를 호출한다.

/**
 * IME 조합 중 부분 문자 저장을 막는 inline 이벤트 어트리뷰트 문자열을 만든다.
 * `${imeInputAttrs(...)}` 형태로 HTML 템플릿 리터럴에 그대로 삽입한다.
 *
 * @param {string} handlerCall - 입력 확정 시 실행할 JS 표현식. 이미 escAttr 처리된
 *   값으로 가정하며 추가 escape 하지 않는다. 예: `"save('id',this.value)"`
 *
 *   보안: escAttr는 HTML 계층만 보호한다 — 어트리뷰트 값은 JS 실행 전에 HTML 디코드되므로
 *   JS 문자열 리터럴 안에 사용자 자유 텍스트(이름·메모 등)를 삽입하면 따옴표 breakout이
 *   가능하다. handlerCall에는 Firestore ID·고정 함수명 같은 통제된 값만 삽입할 것.
 * @returns {string} 공백으로 연결된 한 줄 어트리뷰트 문자열
 *   (oncompositionstart / oncompositionend / oninput)
 */
export function imeInputAttrs(handlerCall) {
  // compositionend가 마지막 input 뒤에 오는 브라우저가 있어 end에서도 핸들러를
  // 호출해 조합 확정값을 반영한다.
  // oninput 가드는 블록({})으로 — 다중 문장 handlerCall도 전체가 조합 가드를 받게.
  return [
    `oncompositionstart="this._c=1"`,
    `oncompositionend="this._c=0;${handlerCall}"`,
    `oninput="if(!this._c){${handlerCall}}"`,
  ].join(' ');
}
