import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ACADEMY_CONFIG, defineAcademyConfig } from './academy-config.js';

test('기본 설정은 기존 Impact7 도메인과 공개 폼 연락처를 보존한다', () => {
  assert.deepEqual(DEFAULT_ACADEMY_CONFIG, {
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

test('다른 학원은 브랜드, 주 도메인, 복수 레거시 도메인, 폼 연락처를 바꿀 수 있다', () => {
  const config = defineAcademyConfig({
    brandName: '샘플 학원',
    primaryStaffDomain: 'sample.academy',
    legacyStaffDomains: ['old.sample.academy', 'login.sample.academy'],
    formContact: {
      channelLabel: '채널 문의',
      channelUrl: 'https://sample.academy/channel',
      inquiryLabel: '상담 문의',
      inquiryUrl: 'https://sample.academy/contact',
    },
  });

  assert.equal(config.brandName, '샘플 학원');
  assert.equal(config.primaryStaffDomain, 'sample.academy');
  assert.deepEqual(config.legacyStaffDomains, ['old.sample.academy', 'login.sample.academy']);
  assert.equal(config.formContact.inquiryUrl, 'https://sample.academy/contact');
});

test('부분 설정은 기존 Impact7 기본값을 유지하고 도메인은 소문자 중복 제거한다', () => {
  const config = defineAcademyConfig({
    primaryStaffDomain: 'STAFF.SAMPLE.EDU',
    legacyStaffDomains: ['OLD.SAMPLE.EDU', 'old.sample.edu', 'staff.sample.edu'],
  });

  assert.equal(config.brandName, DEFAULT_ACADEMY_CONFIG.brandName);
  assert.equal(config.primaryStaffDomain, 'staff.sample.edu');
  assert.deepEqual(config.legacyStaffDomains, ['old.sample.edu']);
  assert.equal(config.formContact.channelUrl, DEFAULT_ACADEMY_CONFIG.formContact.channelUrl);
});

test('잘못된 설정은 Impact7 기본값으로 묵살하지 않고 실패한다', () => {
  for (const invalid of [
    null,
    { brandName: '' },
    { primaryStaffDomain: 'https://sample.edu' },
    { legacyStaffDomains: 'old.sample.edu' },
    { legacyStaffDomains: [''] },
    { formContact: { inquiryUrl: 'javascript:alert(1)' } },
    { primaryStaffDomian: 'sample.edu' },
    { formContact: { inquiryURL: 'https://sample.edu/contact' } },
  ]) {
    assert.throws(() => defineAcademyConfig(invalid), TypeError);
  }
});

test('설정 결과는 소비자가 런타임에 바꿀 수 없다', () => {
  const config = defineAcademyConfig({ primaryStaffDomain: 'sample.edu' });
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.legacyStaffDomains), true);
  assert.equal(Object.isFrozen(config.formContact), true);
});
