import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail, normalizeAcademyEmail, normalizeImpact7Email } from './email.js';

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

test('normalizeImpact7Email: 구 도메인만 정본으로 치환', () => {
  assert.equal(normalizeImpact7Email('edward@gw.impact7.kr'), 'edward@impact7.kr');
  assert.equal(normalizeImpact7Email('Edward@GW.IMPACT7.KR'), 'Edward@impact7.kr');
  assert.equal(normalizeImpact7Email('edward@impact7.kr'), 'edward@impact7.kr');
  assert.equal(normalizeImpact7Email('edward@gmail.com'), 'edward@gmail.com');
});

test('normalizeImpact7Email: 끝이 아닌 위치의 구 도메인은 그대로', () => {
  assert.equal(normalizeImpact7Email('a@gw.impact7.kr.example.com'), 'a@gw.impact7.kr.example.com');
});

test('normalizeImpact7Email: nullish·비문자열은 문자열로', () => {
  assert.equal(normalizeImpact7Email(null), '');
  assert.equal(normalizeImpact7Email(undefined), '');
  assert.equal(normalizeImpact7Email(''), '');
});

test('normalizeImpact7Email: 학원 설정을 주입하면 레거시 도메인을 해당 주 도메인으로 치환', () => {
  const config = {
    brandName: '샘플 학원',
    primaryStaffDomain: 'sample.edu',
    legacyStaffDomains: ['old.sample.edu', 'login.sample.edu'],
    formContact: { channelLabel: '채널 문의', channelUrl: 'https://sample.edu/channel', inquiryLabel: '상담 문의', inquiryUrl: 'https://sample.edu/contact' },
  };
  assert.equal(normalizeImpact7Email('teacher@old.sample.edu', config), 'teacher@sample.edu');
  assert.equal(normalizeImpact7Email('teacher@login.sample.edu', config), 'teacher@sample.edu');
  assert.equal(normalizeImpact7Email('teacher@impact7.kr', config), 'teacher@impact7.kr');
  assert.equal(normalizeAcademyEmail('teacher@old.sample.edu', config), 'teacher@sample.edu');
});

test('normalizeImpact7Email: 잘못된 학원 설정은 실패한다', () => {
  assert.throws(() => normalizeImpact7Email('teacher@old.sample.edu', { legacyStaffDomains: [''] }), TypeError);
});
