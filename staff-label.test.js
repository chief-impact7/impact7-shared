import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as staffName from './staff-label.js';

const { academyAccountId, staffDisplayName, staffLabel, staffPreferredName } = staffName;

test('Preferred Name 해석 API를 제공한다', () => {
  assert.equal(typeof academyAccountId, 'function');
  assert.equal(typeof staffPreferredName, 'function');
  assert.equal(typeof staffDisplayName, 'function');
});

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

test('Preferred Name은 수동값이 학원 계정 아이디보다 우선한다', () => {
  const staff = {
    name: '김원장',
    preferredName: 'Alice',
    academyAccountId: 'owner',
    email: 'owner@impact7.kr',
  };
  assert.equal(staffPreferredName(staff), 'Alice');
  assert.equal(staffDisplayName(staff), 'Alice');
});

test('수동값이 없으면 학원 계정 아이디가 기본 Preferred Name이다', () => {
  assert.equal(staffPreferredName({ academyAccountId: 'owner' }), 'owner');
  assert.equal(staffPreferredName({ email: 'teacher@gw.impact7.kr' }), 'teacher');
  assert.equal(academyAccountId({ email: 'teacher@impact7.kr' }), 'teacher');
});

test('개인 이메일은 학원 계정 아이디로 사용하지 않는다', () => {
  assert.equal(academyAccountId({ email: 'teacher@gmail.com' }), '');
  assert.equal(staffPreferredName({ email: 'teacher@gmail.com' }), '');
});

test('학원 계정 아이디 형식이 아니면 식별자로 사용하지 않는다', () => {
  assert.equal(academyAccountId({ academyAccountId: 'teacher@outside.com' }), '');
  assert.equal(academyAccountId({ academyAccountId: 'teacher,other' }), '');
});

test('Preferred Name과 학원 계정이 없으면 표시 이름은 실명이다', () => {
  const staff = { name: '김선생', email: 'teacher@gmail.com' };
  assert.equal(staffPreferredName(staff), '');
  assert.equal(staffDisplayName(staff), '김선생');
});

test('사용자 지정 학원 도메인만 학원 계정으로 인정한다', () => {
  const config = {
    brandName: '샘플 학원',
    primaryStaffDomain: 'sample.edu',
    legacyStaffDomains: ['old.sample.edu'],
    formContact: { channelLabel: '채널 문의', channelUrl: 'https://sample.edu/channel', inquiryLabel: '상담 문의', inquiryUrl: 'https://sample.edu/contact' },
  };
  assert.equal(academyAccountId({ email: 'teacher@sample.edu' }, config), 'teacher');
  assert.equal(academyAccountId({ email: 'teacher@old.sample.edu' }, config), 'teacher');
  assert.equal(academyAccountId({ email: 'teacher@impact7.kr' }, config), '');
  assert.equal(staffPreferredName({ email: 'teacher@old.sample.edu' }, config), 'teacher');
  assert.equal(staffDisplayName({ name: '김선생', email: 'teacher@old.sample.edu' }, config), 'teacher');
});
