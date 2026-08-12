const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const CONFIG_KEYS = new Set(['brandName', 'primaryStaffDomain', 'legacyStaffDomains', 'formContact']);
const CONTACT_KEYS = new Set(['channelLabel', 'channelUrl', 'inquiryLabel', 'inquiryUrl']);

const IMPACT7_DEFAULTS = {
  brandName: '임팩트7 영어학원',
  primaryStaffDomain: 'impact7.kr',
  legacyStaffDomains: ['gw.impact7.kr'],
  formContact: {
    channelLabel: '▶ 카카오톡 채널 추가하고 학원 소식 받기',
    channelUrl: 'https://pf.kakao.com/_xjxfqbn',
    inquiryLabel: '카카오톡 1:1 문의',
    inquiryUrl: 'https://kakao.impact7.kr',
  },
};

function stringValue(source, key, fallback) {
  if (!(key in source)) return fallback;
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

export function defineAcademyConfig(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('academy config must be an object');
  }
  assertKnownKeys(value, CONFIG_KEYS, '');

  const brandName = stringValue(value, 'brandName', IMPACT7_DEFAULTS.brandName);
  const primaryStaffDomain = domainValue(
    stringValue(value, 'primaryStaffDomain', IMPACT7_DEFAULTS.primaryStaffDomain),
    'primaryStaffDomain'
  );
  const legacySource = 'legacyStaffDomains' in value
    ? value.legacyStaffDomains
    : IMPACT7_DEFAULTS.legacyStaffDomains;
  if (!Array.isArray(legacySource)) {
    throw new TypeError('academy config legacyStaffDomains must be an array');
  }
  const legacyStaffDomains = [...new Set(legacySource.map((domain) => {
    if (typeof domain !== 'string' || !domain.trim()) {
      throw new TypeError('academy config legacyStaffDomains must contain domains');
    }
    return domainValue(domain.trim(), 'legacyStaffDomains');
  }))].filter((domain) => domain !== primaryStaffDomain);

  const contactSource = 'formContact' in value ? value.formContact : {};
  if (!contactSource || typeof contactSource !== 'object' || Array.isArray(contactSource)) {
    throw new TypeError('academy config formContact must be an object');
  }
  assertKnownKeys(contactSource, CONTACT_KEYS, 'formContact.');
  const formContact = {
    channelLabel: stringValue(contactSource, 'channelLabel', IMPACT7_DEFAULTS.formContact.channelLabel),
    channelUrl: httpsUrlValue(
      stringValue(contactSource, 'channelUrl', IMPACT7_DEFAULTS.formContact.channelUrl),
      'formContact.channelUrl'
    ),
    inquiryLabel: stringValue(contactSource, 'inquiryLabel', IMPACT7_DEFAULTS.formContact.inquiryLabel),
    inquiryUrl: httpsUrlValue(
      stringValue(contactSource, 'inquiryUrl', IMPACT7_DEFAULTS.formContact.inquiryUrl),
      'formContact.inquiryUrl'
    ),
  };

  return Object.freeze({
    brandName,
    primaryStaffDomain,
    legacyStaffDomains: Object.freeze(legacyStaffDomains),
    formContact: Object.freeze(formContact),
  });
}

export const DEFAULT_ACADEMY_CONFIG = defineAcademyConfig();
