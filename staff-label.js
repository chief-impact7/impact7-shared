import { defineAcademyConfig, IMPACT7_CONFIG } from './academy-config.js';

// impact7 공유 — 담당자/작성자 표시 라벨·Preferred Name (SSoT)
//
// 로그인 계정 이메일에서 도메인(@impact7.kr 등)을 떼고 아이디만 노출한다.
// 표시 전용이며 저장값 변환용이 아니다. 이미 아이디로 저장된 값(@ 없음)은
// 그대로 통과시켜 이중 처리에 안전하다. 빈값·비문자열은 빈 문자열.
/** @param {unknown} emailOrId */
export function staffLabel(emailOrId) {
  if (typeof emailOrId !== 'string') return '';
  const t = emailOrId.trim();
  return t.split('@')[0];
}

const ACADEMY_ACCOUNT_ID = /^[a-z0-9._-]+$/i;

export function academyAccountId(staff, config) {
  const academy = config ? defineAcademyConfig(config) : IMPACT7_CONFIG;
  const explicit = typeof staff?.academyAccountId === 'string'
    ? staff.academyAccountId.trim()
    : '';
  if (ACADEMY_ACCOUNT_ID.test(explicit)) return explicit;

  if (typeof staff?.email !== 'string') return '';
  const parts = staff.email.trim().split('@');
  const [local, domain] = parts;
  const domains = new Set([academy.primaryStaffDomain, ...academy.legacyStaffDomains]);
  return parts.length === 2 && local && domains.has(domain.toLowerCase()) ? local : '';
}

export function staffPreferredName(staff, config) {
  const academy = config ? defineAcademyConfig(config) : IMPACT7_CONFIG;
  const preferredName = typeof staff?.preferredName === 'string'
    ? staff.preferredName.trim()
    : '';
  return preferredName || academyAccountId(staff, academy);
}

export function staffDisplayName(staff, config) {
  const preferredName = staffPreferredName(staff, config);
  if (preferredName) return preferredName;
  return typeof staff?.name === 'string' ? staff.name.trim() : '';
}
