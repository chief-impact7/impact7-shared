import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { esc, escAttr } from './html-escape.js';

test('esc: 5종 엔티티 모두 변환', () => {
    assert.equal(esc(`<a href="x" data='y'>&</a>`), '&lt;a href=&quot;x&quot; data=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

test('esc: null/undefined/숫자 처리', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
    assert.equal(esc(0), '0');
    assert.equal(esc(''), '');
});

test('esc: escape 대상 없으면 원문 유지', () => {
    assert.equal(esc('홍길동 abc 123'), '홍길동 abc 123');
});

test('escAttr: esc와 동일하게 5종 escape', () => {
    assert.equal(escAttr(`"x"&'y'<z>`), '&quot;x&quot;&amp;&#39;y&#39;&lt;z&gt;');
    assert.equal(escAttr(null), '');
});
