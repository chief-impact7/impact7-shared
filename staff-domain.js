import { defineAcademyConfig, IMPACT7_CONFIG } from './academy-config.js';

// 직원 도메인 게이트 SSoT — 앱마다 복붙돼 있던 hd 파라미터와
// endsWith('@impact7.kr') 리터럴 게이트의 통합 정본 (AcademION 1단계 W4).
// firestore.rules의 도메인 정규식은 여기 소관이 아니다 — 2단계 테넌트 축에서
// academyId 클레임 판정으로 대체된다.

function academyOf(config) {
  return config ? defineAcademyConfig(config) : IMPACT7_CONFIG;
}

// Google 로그인 hd 파라미터 — 주 도메인 계정 선택 화면 제한(보조 UX 게이트).
export function staffAuthParams(config) {
  return Object.freeze({ hd: academyOf(config).primaryStaffDomain });
}

// 주 도메인 직원 이메일 판정 — 기존 앱 게이트와 동일하게 레거시 도메인은 제외한다.
// '@'를 포함해 도메인 전체를 대조한다(fakeimpact7.kr 류 접미사 오탐 차단).
export function isPrimaryStaffEmail(email, config) {
  if (typeof email !== 'string') return false;
  return email.trim().toLowerCase().endsWith(`@${academyOf(config).primaryStaffDomain}`);
}
