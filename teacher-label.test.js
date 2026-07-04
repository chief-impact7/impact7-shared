import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isActiveTeacher, teacherDisplayName } from './teacher-label.js';

test('교수부 재직자만 담임 후보', () => {
  assert.equal(isActiveTeacher({ department: '교수', status: 'active' }), true);
  assert.equal(isActiveTeacher({ department: '행정', status: 'active' }), false);
  assert.equal(isActiveTeacher({ department: '교수', status: 'terminated' }), false);
  assert.equal(isActiveTeacher(null), false);
  assert.equal(isActiveTeacher(undefined), false);
});

test('영어이름 첫 토큰, 첫 글자만 대문자', () => {
  assert.equal(teacherDisplayName('Edward Lee'), 'Edward');
  assert.equal(teacherDisplayName('KEN LEE'), 'Ken');
  assert.equal(teacherDisplayName('nami lee'), 'Nami');
  assert.equal(teacherDisplayName('Rachel'), 'Rachel');
  assert.equal(teacherDisplayName('Edward   Lee'), 'Edward');
});

test('공백·빈값·비문자열은 빈 문자열', () => {
  assert.equal(teacherDisplayName('  Sierra  '), 'Sierra');
  assert.equal(teacherDisplayName(''), '');
  assert.equal(teacherDisplayName('   '), '');
  assert.equal(teacherDisplayName(null), '');
  assert.equal(teacherDisplayName(42), '');
});
