import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrimaryStaffEmail, staffAuthParams } from './staff-domain.js';

const SAMPLE = {
  brandName: '샘플 학원',
  primaryStaffDomain: 'sample.academy',
  legacyStaffDomains: ['old.sample.academy'],
  formContact: {
    channelLabel: '채널 문의',
    channelUrl: 'https://sample.academy/channel',
    inquiryLabel: '상담 문의',
    inquiryUrl: 'https://sample.academy/contact',
  },
};

test('staffAuthParams: 주 도메인으로 hd를 만든다 (생략 시 임팩트7 명시 설정)', () => {
  assert.deepEqual(staffAuthParams(), { hd: 'impact7.kr' });
  assert.deepEqual(staffAuthParams(SAMPLE), { hd: 'sample.academy' });
  assert.equal(Object.isFrozen(staffAuthParams()), true);
});

test('isPrimaryStaffEmail: 주 도메인만 인정, 레거시·외부·접미사 오탐 거부', () => {
  assert.equal(isPrimaryStaffEmail('teacher@impact7.kr'), true);
  assert.equal(isPrimaryStaffEmail('Teacher@IMPACT7.KR '), true);
  assert.equal(isPrimaryStaffEmail('teacher@gw.impact7.kr'), false);
  assert.equal(isPrimaryStaffEmail('teacher@gmail.com'), false);
  assert.equal(isPrimaryStaffEmail('teacher@fakeimpact7.kr'), false);
  assert.equal(isPrimaryStaffEmail(null), false);
  assert.equal(isPrimaryStaffEmail('teacher@sample.academy', SAMPLE), true);
  assert.equal(isPrimaryStaffEmail('teacher@impact7.kr', SAMPLE), false);
});
