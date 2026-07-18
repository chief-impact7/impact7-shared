// enrollment ↔ status 정합성 (단일 소스). DB·DSC 등이 import.
// 재원 계열(enrollment 보유 가능): 재원/등원예정/실휴원/가휴원
// 비재원(enrollment 없어야): 상담/퇴원/종강

export const ENROLLABLE_STATUSES = new Set(['재원', '등원예정', '실휴원', '가휴원']);
export const NON_ENROLLABLE_STATUSES = new Set(['상담', '퇴원', '종강']);

// 휴원(일시정지) 상태 집합 — 재원 유지(ENROLLABLE) 중 '멈춤' 표시·현인원 산식 등에서
// 반복되던 부분집합. status==='실휴원'||status==='가휴원' 인라인 대체용 SSoT.
export const LEAVE_STATUSES = new Set(['실휴원', '가휴원']);

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
// - 7종 밖 status(오타·구 데이터·undefined): valid: false — 정합성 불명인 채 저장 차단
// 반환: { enrollments, valid, reason? }
export function reconcileEnrollments(status, enrollments) {
  const list = enrollments || [];
  if (NON_ENROLLABLE_STATUSES.has(status)) {
    return { enrollments: [], valid: true };
  }
  if (!ENROLLABLE_STATUSES.has(status)) {
    return {
      enrollments: list,
      valid: false,
      reason: `알 수 없는 상태(${status || '없음'})입니다. 재원·등원예정·실휴원·가휴원·상담·퇴원·종강 중 하나여야 합니다.`,
    };
  }
  if (!hasRealEnrollment(list)) {
    return {
      enrollments: list,
      valid: false,
      reason: '재원·등원예정·휴원 상태로 저장하려면 정규반 또는 특강을 최소 1개 입력하세요.',
    };
  }
  return { enrollments: list, valid: true };
}

// ─── 학생 2계층 분류 (대분류: 재원생/비원생, 세부: status) ───
export const STUDENT_STATUS_GROUPS = [
  { category: '재원생', statuses: ['등원예정', '재원', '실휴원', '가휴원'] },
  { category: '비원생', statuses: ['상담', '퇴원', '종강'] },
];

// status → 대분류('재원생' | '비원생')
export function studentCategory(status) {
  return ENROLLABLE_STATUSES.has(status) ? '재원생' : '비원생';
}

// status별 색상 tone (의미 기반, 각 앱이 CSS 클래스로 매핑)
export const STATUS_TONE = {
  '재원': 'active',
  '등원예정': 'scheduled',
  '실휴원': 'paused',
  '가휴원': 'paused',
  '상담': 'consult',
  '퇴원': 'ended-hard',
  '종강': 'ended-soft',
};

// ─── status 전이 규칙 ───
// 신규 등록 시 선택 가능 (휴원·퇴원·종강 제외; 상담은 진단평가 경로로만 등록)
export const INITIAL_STATUSES = ['등원예정', '재원'];

// 주어진 맥락에서 선택 가능한 status 목록.
// current: 편집 중인 학생의 현재 status (신규면 무시), isNew: 신규 등록 여부
// - 신규: 등원예정/재원만 (휴원 진입 차단)
// - 비원생(상담/퇴원/종강): 등원예정/재원으로만 재원생화 + 현 status 유지 (휴원 직접 진입 차단)
// - 재원생: 재원계열 전체(휴원은 여기서만 진입) + 퇴원/종강 (상담 제외 → 재원→상담 직접 전환 차단)
export function selectableStatuses(current, isNew) {
  if (isNew) return [...INITIAL_STATUSES];
  if (NON_ENROLLABLE_STATUSES.has(current)) {
    return [...new Set([current, ...INITIAL_STATUSES])];
  }
  return ['등원예정', '재원', '실휴원', '가휴원', '퇴원', '종강'];
}
