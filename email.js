import { defineAcademyConfig, IMPACT7_CONFIG } from './academy-config.js';

// 이메일 형식 검증 SSoT. HR 여러 화면이 각자 복제하던 정규식을 통일.
// 로컬·도메인·TLD 각 구간에 공백·@ 없이 최소 1자 + '.' 포함만 확인(느슨한 실무 기준).

/** @param {unknown} email */
export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** @param {unknown} email */
export function normalizeAcademyEmail(email, config) {
  const value = String(email || '');
  const academy = config ? defineAcademyConfig(config) : IMPACT7_CONFIG;
  const lower = value.toLowerCase();
  for (const legacyDomain of academy.legacyStaffDomains) {
    const suffix = `@${legacyDomain}`;
    if (lower.endsWith(suffix)) return `${value.slice(0, -suffix.length)}@${academy.primaryStaffDomain}`;
  }
  return value;
}

// 기존 소비자 API. 신규 공통 코드는 normalizeAcademyEmail을 사용한다.
export const normalizeImpact7Email = normalizeAcademyEmail;
