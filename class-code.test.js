import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClassCode } from './class-code.js';

test('소문자·혼용 코드는 대문자로', () => {
  assert.equal(normalizeClassCode('ks132'), 'KS132');
  assert.equal(normalizeClassCode('Ks132'), 'KS132');
  assert.equal(normalizeClassCode('KS132'), 'KS132');
});

test('한글 코드·공백·빈값', () => {
  assert.equal(normalizeClassCode('특강301'), '특강301');
  assert.equal(normalizeClassCode('  ha101  '), 'HA101');
  assert.equal(normalizeClassCode(''), '');
  assert.equal(normalizeClassCode(null), '');
  assert.equal(normalizeClassCode(undefined), '');
  assert.equal(normalizeClassCode(123), '');
});
