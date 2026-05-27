// enrollment ↔ status 정합성 (단일 소스). DB·DSC 등이 import.
// 재원 계열(enrollment 보유 가능): 재원/등원예정/실휴원/가휴원
// 비재원(enrollment 없어야): 상담/퇴원/종강

export const ENROLLABLE_STATUSES = new Set(['재원', '등원예정', '실휴원', '가휴원']);
export const NON_ENROLLABLE_STATUSES = new Set(['상담', '퇴원', '종강']);

// 반배정(enrollment)을 가질 수 있는 status인가 (재원 계열).
export function isEnrollableStatus(status) {
  return ENROLLABLE_STATUSES.has(status);
}

// enrollment 중 실질 반코드를 가진 것이 있는지 (빈 placeholder 제외).
export function hasRealEnrollment(enrollments) {
  return (enrollments || []).some(e => e && (e.level_symbol || e.class_number));
}

// 저장 직전 status↔enrollment 정합성 검사/정리.
// - 비재원(상담/퇴원/종강): enrollments를 빈 배열로 강제 (valid: true)
// - 재원 계열: 실질 enrollment ≥1 필요 (없으면 valid: false + reason)
// 반환: { enrollments, valid, reason? }
export function reconcileEnrollments(status, enrollments) {
  const list = enrollments || [];
  if (NON_ENROLLABLE_STATUSES.has(status)) {
    return { enrollments: [], valid: true };
  }
  if (ENROLLABLE_STATUSES.has(status) && !hasRealEnrollment(list)) {
    return {
      enrollments: list,
      valid: false,
      reason: '재원·등원예정·휴원 상태로 저장하려면 정규반 또는 특강을 최소 1개 입력하세요.',
    };
  }
  return { enrollments: list, valid: true };
}
