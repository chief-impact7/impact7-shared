const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const CONFIG_KEYS = new Set(['brandName', 'primaryStaffDomain', 'legacyStaffDomains', 'formContact']);
const CONTACT_KEYS = new Set(['channelLabel', 'channelUrl', 'inquiryLabel', 'inquiryUrl']);

function requiredString(source, key) {
  if (!(key in source)) throw new TypeError(`academy config ${key} is required`);
  if (typeof source[key] !== 'string' || !source[key].trim()) {
    throw new TypeError(`academy config ${key} must be a non-empty string`);
  }
  return source[key].trim();
}

function domainValue(value, key) {
  const domain = value.toLowerCase();
  if (!DOMAIN.test(domain)) throw new TypeError(`academy config ${key} must be a domain`);
  return domain;
}

function httpsUrlValue(value, key) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`academy config ${key} must be an HTTPS URL`);
  }
  if (url.protocol !== 'https:') throw new TypeError(`academy config ${key} must be an HTTPS URL`);
  return value;
}

function assertKnownKeys(source, allowed, path) {
  const unknown = Object.keys(source).find((key) => !allowed.has(key));
  if (unknown) throw new TypeError(`unknown academy config key: ${path}${unknown}`);
}

// 배포 학원 설정 계약 — 2026-08-16부터 모든 키 필수(fail-fast).
// 이전의 "누락 키는 Impact7 값으로 조용히 보전" 동작은 상품화(AcademION) 관점에서
// 타 학원 화면에 임팩트7 브랜드가 렌더되는 사고 경로라 제거했다. 임팩트7 배포는
// 아래 IMPACT7_CONFIG를 명시적으로 주입한다 — 어느 학원의 배포인지 코드에 드러나게.
export function defineAcademyConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('academy config must be an object');
  }
  assertKnownKeys(value, CONFIG_KEYS, '');

  const brandName = requiredString(value, 'brandName');
  const primaryStaffDomain = domainValue(requiredString(value, 'primaryStaffDomain'), 'primaryStaffDomain');
  if (!('legacyStaffDomains' in value) || !Array.isArray(value.legacyStaffDomains)) {
    throw new TypeError('academy config legacyStaffDomains must be an array');
  }
  const legacyStaffDomains = [...new Set(value.legacyStaffDomains.map((domain) => {
    if (typeof domain !== 'string' || !domain.trim()) {
      throw new TypeError('academy config legacyStaffDomains must contain domains');
    }
    return domainValue(domain.trim(), 'legacyStaffDomains');
  }))].filter((domain) => domain !== primaryStaffDomain);

  if (!('formContact' in value) || !value.formContact || typeof value.formContact !== 'object' || Array.isArray(value.formContact)) {
    throw new TypeError('academy config formContact must be an object');
  }
  const contactSource = value.formContact;
  assertKnownKeys(contactSource, CONTACT_KEYS, 'formContact.');
  const formContact = {
    channelLabel: requiredString(contactSource, 'channelLabel'),
    channelUrl: httpsUrlValue(requiredString(contactSource, 'channelUrl'), 'formContact.channelUrl'),
    inquiryLabel: requiredString(contactSource, 'inquiryLabel'),
    inquiryUrl: httpsUrlValue(requiredString(contactSource, 'inquiryUrl'), 'formContact.inquiryUrl'),
  };

  return Object.freeze({
    brandName,
    primaryStaffDomain,
    legacyStaffDomains: Object.freeze(legacyStaffDomains),
    formContact: Object.freeze(formContact),
  });
}

// 임팩트7의 명시 설정 — "기본값"이 아니라 한 학원의 설정값이다.
// 테넌트 축 도입(3단계) 후에는 academies/{aid} 문서가 이 값의 런타임 정착지가 된다.
export const IMPACT7_CONFIG = defineAcademyConfig({
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
