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

// ─── 2026-07-05 리뷰 P3 회귀 ───
import { classSettingsGet } from './class-code.js';

test('classSettingsGet: 정확 일치 → 정규화 일치 → 설정 키 비정규 표기 순으로 흡수', () => {
  const cs = { HA101: { schedule: 'A' }, hb202: { schedule: 'B' } };
  assert.equal(classSettingsGet(cs, 'HA101')?.schedule, 'A'); // 정확 일치
  assert.equal(classSettingsGet(cs, 'ha101')?.schedule, 'A'); // 조회 키가 소문자
  assert.equal(classSettingsGet(cs, 'HB202')?.schedule, 'B'); // 설정 키가 소문자
  assert.equal(classSettingsGet(cs, '2단지내신'), undefined);  // 미존재
  assert.equal(classSettingsGet(cs, ''), undefined);
  assert.equal(classSettingsGet(null, 'HA101'), undefined);
});
