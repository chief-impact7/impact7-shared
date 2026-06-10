import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imeInputAttrs } from './ime-input.js';

const H = "save('id',this.value)";

test('3개 어트리뷰트가 모두 포함된다', () => {
  const out = imeInputAttrs(H);
  assert.ok(out.includes('oncompositionstart='));
  assert.ok(out.includes('oncompositionend='));
  assert.ok(out.includes('oninput='));
});

test('oncompositionstart는 this._c=1 설정', () => {
  assert.ok(imeInputAttrs(H).includes('oncompositionstart="this._c=1"'));
});

test('oncompositionend는 this._c=0 후 handlerCall 호출', () => {
  assert.ok(imeInputAttrs(H).includes(`oncompositionend="this._c=0;${H}"`));
});

test('oninput은 if(!this._c) 가드 뒤 handlerCall 호출', () => {
  assert.ok(imeInputAttrs(H).includes(`oninput="if(!this._c)${H}"`));
});

test('handlerCall은 추가 escape 없이 그대로 삽입된다', () => {
  // 이미 escAttr 처리된 &quot; 엔티티가 변형되지 않아야 한다
  const escaped = 'save(&quot;id&quot;,this.value)';
  const out = imeInputAttrs(escaped);
  assert.ok(out.includes(`oncompositionend="this._c=0;${escaped}"`));
  assert.ok(out.includes(`oninput="if(!this._c)${escaped}"`));
  assert.ok(!out.includes('&amp;quot;'));
});

test('반환값은 개행 없는 한 줄이며 어트리뷰트 사이는 공백', () => {
  const out = imeInputAttrs(H);
  assert.ok(!out.includes('\n'));
  assert.equal(out.split('" ').length, 3);
});

test('예시 입력 전체 반환값 스냅샷', () => {
  assert.equal(
    imeInputAttrs("saveExtraVisit('abc','reason',this.value)"),
    `oncompositionstart="this._c=1" oncompositionend="this._c=0;saveExtraVisit('abc','reason',this.value)" oninput="if(!this._c)saveExtraVisit('abc','reason',this.value)"`
  );
});
