import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staffLabel } from './staff-label.js';

test('이메일 → @ 앞부분만', () => {
  assert.equal(staffLabel('hong@impact7.kr'), 'hong');
});
test('다른 도메인도 @ 앞부분만', () => {
  assert.equal(staffLabel('kim.teacher@gmail.com'), 'kim.teacher');
});
test('이미 아이디(@ 없음)면 그대로 통과', () => {
  assert.equal(staffLabel('hong'), 'hong');
});
test('앞뒤 공백 제거', () => {
  assert.equal(staffLabel('  hong@impact7.kr  '), 'hong');
});
test('빈 문자열 → 빈 문자열', () => {
  assert.equal(staffLabel(''), '');
});
test('비문자열(null/undefined/숫자) → 빈 문자열', () => {
  assert.equal(staffLabel(null), '');
  assert.equal(staffLabel(undefined), '');
  assert.equal(staffLabel(123), '');
});
