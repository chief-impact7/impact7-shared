import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeTeacherEmails, isActiveTeacher, isSameTeacher, teacherDisplayName } from './teacher-label.js';

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

test('isSameTeacher — 구·신 메일은 같은 사람, 다른 로컬파트는 다른 사람', () => {
  assert.equal(isSameTeacher('edward@gw.impact7.kr', 'edward@impact7.kr'), true);
  assert.equal(isSameTeacher('Edward@impact7.kr', 'edward@impact7.kr'), true);
  assert.equal(isSameTeacher('edward@impact7.kr', 'iris@impact7.kr'), false);
  assert.equal(isSameTeacher('', 'edward@impact7.kr'), false);
  assert.equal(isSameTeacher(null, 'edward@impact7.kr'), false);
});

test('구·신 메일 중복은 신메일(@impact7.kr) 우선으로 사람당 1건', () => {
  assert.deepEqual(
    canonicalizeTeacherEmails(['edward@gw.impact7.kr', 'edward@impact7.kr', 'iris@gw.impact7.kr']),
    ['edward@impact7.kr', 'iris@gw.impact7.kr']
  );
  // 순서 무관하게 신메일로 수렴, 첫 등장 순서 보존
  assert.deepEqual(
    canonicalizeTeacherEmails(['ken@impact7.kr', 'ken@gw.impact7.kr']),
    ['ken@impact7.kr']
  );
});

test('canonicalizeTeacherEmails — 빈값·비문자열·null 입력 안전', () => {
  assert.deepEqual(canonicalizeTeacherEmails([]), []);
  assert.deepEqual(canonicalizeTeacherEmails(null), []);
  assert.deepEqual(canonicalizeTeacherEmails(['', null, 42, 'sr@impact7.kr']), ['sr@impact7.kr']);
});

test('공백·빈값·비문자열은 빈 문자열', () => {
  assert.equal(teacherDisplayName('  Sierra  '), 'Sierra');
  assert.equal(teacherDisplayName(''), '');
  assert.equal(teacherDisplayName('   '), '');
  assert.equal(teacherDisplayName(null), '');
  assert.equal(teacherDisplayName(42), '');
});
