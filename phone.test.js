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
