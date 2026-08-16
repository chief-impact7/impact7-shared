import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMPACT7_CONFIG, defineAcademyConfig } from './academy-config.js';

const FULL = {
  brandName: '샘플 학원',
  primaryStaffDomain: 'sample.academy',
  legacyStaffDomains: ['old.sample.academy', 'login.sample.academy'],
  formContact: {
    channelLabel: '채널 문의',
    channelUrl: 'https://sample.academy/channel',
    inquiryLabel: '상담 문의',
    inquiryUrl: 'https://sample.academy/contact',
  },
};

test('IMPACT7_CONFIG는 임팩트7의 명시 설정을 보존한다', () => {
  assert.deepEqual(IMPACT7_CONFIG, {
    brandName: '임팩트7 영어학원',
    primaryStaffDomain: 'impact7.kr',
    legacyStaffDomains: ['gw.impact7.kr'],
    formContact: {
      channelLabel: '▶ 카카오톡 채널 추가하고 학원 소식 받기',
      channelUrl: 'https://pf.kakao.com/_xjxfqbn',
      inquiryLabel: '카카오톡 1:1 문의',
      inquiryUrl: 'https://kakao.impact7.kr',
    },
  });
});

test('완전한 설정은 도메인 소문자 정규화·레거시 중복 제거와 함께 정의된다', () => {
  const config = defineAcademyConfig({
    ...FULL,
    primaryStaffDomain: 'STAFF.SAMPLE.EDU',
    legacyStaffDomains: ['OLD.SAMPLE.EDU', 'old.sample.edu', 'staff.sample.edu'],
  });
  assert.equal(config.brandName, '샘플 학원');
  assert.equal(config.primaryStaffDomain, 'staff.sample.edu');
  assert.deepEqual(config.legacyStaffDomains, ['old.sample.edu']);
  assert.equal(config.formContact.inquiryUrl, 'https://sample.academy/contact');
});

test('누락은 조용한 임팩트7 fallback이 아니라 즉시 실패다 (2026-08-16 계약 변경)', () => {
  const { formContact, ...noContact } = FULL;
  const { brandName, ...noBrand } = FULL;
  const { primaryStaffDomain, ...noDomain } = FULL;
  const { legacyStaffDomains, ...noLegacy } = FULL;
  const { channelUrl, ...contactMissing } = FULL.formContact;
  for (const invalid of [
    undefined,
    {},
    noContact,
    noBrand,
    noDomain,
    noLegacy,
    { ...FULL, formContact: contactMissing },
  ]) {
    assert.throws(() => defineAcademyConfig(invalid), TypeError);
  }
});

test('잘못된 값은 기본값으로 묵살하지 않고 실패한다', () => {
  for (const invalid of [
    null,
    { ...FULL, brandName: '' },
    { ...FULL, primaryStaffDomain: 'https://sample.edu' },
    { ...FULL, legacyStaffDomains: 'old.sample.edu' },
    { ...FULL, legacyStaffDomains: [''] },
    { ...FULL, formContact: { ...FULL.formContact, inquiryUrl: 'javascript:alert(1)' } },
    { ...FULL, primaryStaffDomian: 'sample.edu' },
    { ...FULL, formContact: { ...FULL.formContact, inquiryURL: 'https://sample.edu/x' } },
  ]) {
    assert.throws(() => defineAcademyConfig(invalid), TypeError);
  }
});

test('설정 결과는 소비자가 런타임에 바꿀 수 없다', () => {
  const config = defineAcademyConfig(FULL);
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.legacyStaffDomains), true);
  assert.equal(Object.isFrozen(config.formContact), true);
  assert.equal(Object.isFrozen(IMPACT7_CONFIG), true);
});
