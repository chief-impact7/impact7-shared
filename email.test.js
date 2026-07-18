import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail } from './email.js';

test('isValidEmail: 유효 형식', () => {
  assert.equal(isValidEmail('a@b.com'), true);
  assert.equal(isValidEmail('user.name@impact7.kr'), true);
});

test('isValidEmail: 무효 형식', () => {
  for (const bad of ['', 'a@b', 'a b@c.com', '@b.com', 'a@.com', 'a@b.', 'nope', 'a@@b.com']) {
    assert.equal(isValidEmail(bad), false, `${bad}는 무효`);
  }
});

test('isValidEmail: 비문자열은 false', () => {
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail(undefined), false);
  assert.equal(isValidEmail(123), false);
});
