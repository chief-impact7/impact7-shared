import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatPhone } from './phone.js';

test('formatPhone: 11자리 하이픈 분할', () => {
    assert.equal(formatPhone('01012345678'), '010-1234-5678');
    assert.equal(formatPhone('010-1234-5678'), '010-1234-5678');
});

test('formatPhone: null/undefined → 빈 문자열', () => {
    assert.equal(formatPhone(null), '');
    assert.equal(formatPhone(undefined), '');
});

test('formatPhone: 11자리 아니면 원본 반환', () => {
    assert.equal(formatPhone('123'), '123');
    assert.equal(formatPhone('0212345678'), '0212345678');
    assert.equal(formatPhone('010123456789'), '010123456789');
});

// ─── 2026-07-05 적대적 리뷰 회귀 (C5) ───
test('formatPhone: 비문자열 입력도 항상 string 반환 (계약 → string)', () => {
    assert.equal(formatPhone(123), '123');
    assert.equal(typeof formatPhone(123), 'string');
    assert.equal(formatPhone(1012345678), '1012345678'); // 10자리 숫자 → 문자열화 원본
    assert.equal(formatPhone(1012345678), String(1012345678));
    assert.equal(formatPhone(11122223333), '111-2222-3333'); // 11자리 숫자는 하이픈 분할
});
