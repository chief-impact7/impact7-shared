// 테넌트 경로 SSoT (AcademION 2단계 산출물 02c의 구현, 3단계 3a의 유일한 경로 통로).
// legacy 모드는 오늘의 평면 경로를 그대로 돌려준다(동작 불변) — 컷오버(3b)는
// resolvePathMode의 환경값 하나로 전 앱이 tenant 경로로 전환된다.
// 컬렉션 배치의 정본: AcademION docs/02a-컬렉션-배치표.md (원장 확정 3축 반영).

// 테넌트 이동 — impact7db 51개 (배치표 그대로)
const SCOPED_IMPACT7DB = [
  // 학생·상담·성적
  'students', 'student_records', 'student_scores', 'contacts',
  'consultations', 'consultation_summaries', 'consultation_briefings',
  'consultation_trends', 'consultation_pins', 'student_status_summaries',
  // 출결·과제·수업운영
  'temp_class_overrides', 'daily_records', 'absence_notices', 'retake_schedule',
  'hw_fail_tasks', 'test_fail_tasks', 'class_next_hw', 'daily_checks',
  'postponed_tasks', 'absence_records', 'leave_requests', 'temp_attendance',
  'attendance_checkins', 'attendance_events', 'daily_stats',
  // 시험 실행·결과 (콘텐츠 카탈로그는 전역)
  'results', 'external_score_events', 'exam_notifications', 'exam_review_jobs',
  // 직원계 중 테넌트 운영 데이터
  'teachers', 'retention_attributions',
  // 결제 기록
  'payment_records',
  // 운영 설정
  'class_settings', 'automation_settings', 'user_settings', 'role_memos',
  'semester_settings', 'kiosk_devices', 'kiosk_settings', 'message_settings',
  'message_templates', 'promo_campaigns', 'departments',
  // 로그
  'history_logs', 'audit_logs', 'notification_logs', 'message_logs', 'class_teacher_history',
  // 업무 보드 (board_sections는 전역 콘텐츠)
  'board_cards', 'board_comment_reads', 'board_briefings',
];

// 테넌트 이동 — payments 프로젝트(impact7-payments) 소유 컬렉션.
// 파일럿(3a 순번 0)에서 확장: 수강료 청구·결제는 전부 학원 단위 데이터다.
const SCOPED_PAYMENTS = [
  'invoices', 'payments', 'businesses', 'notifications', 'enrollments', 'adjustments',
  'paymentClaims', 'chargeApplications', 'discounts', 'config', 'classes',
];

export const ACADEMY_SCOPED_COLLECTIONS = Object.freeze(
  new Set([...SCOPED_IMPACT7DB, ...SCOPED_PAYMENTS]),
);

// 전역 유지 36개 — HR·법인 축(결정 c), 콘텐츠 카탈로그(결정 b), 인증 소스, 단일 워커 큐
export const GLOBAL_COLLECTIONS = Object.freeze(new Set([
  'exams', 'examTypes', 'answer_keys', 'exam_templates', 'exam_sets', 'exam_analyses',
  'HR_users', 'staff', 'employees', 'shortTermStaff', 'staff_directory', 'assignments',
  'entities', 'buildings', 'teams',
  'onboardingTokens', 'hiringCases', 'contractSigningTokens', 'salaryAgreementTokens',
  'shortTermTokens', 'employeeOnboardingTokens', 'employeeContractSigningTokens',
  'contractTemplates', 'HR_config', 'HR_externalAccess', 'staff_attendance', 'settings',
  'payroll', 'expenses', 'vendors', 'taxReports', 'auditLog',
  'users', 'exam_users', 'board_sections', 'message_queue',
]));

const MODES = new Set(['legacy', 'tenant']);
const ACADEMY_ID = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;

function requiredMode(mode) {
  if (!MODES.has(mode)) throw new TypeError(`tenant-context mode must be legacy|tenant: ${mode}`);
  return mode;
}

// 미등록 이름은 모드와 무관하게 즉시 실패 — 배치표에 없는 컬렉션이 코드에
// 생기는 순간(오배치·오타) 테스트에서 드러나게 한다.
function requiredKnown(name) {
  if (ACADEMY_SCOPED_COLLECTIONS.has(name)) return 'scoped';
  if (GLOBAL_COLLECTIONS.has(name)) return 'global';
  throw new TypeError(`tenant-context에 등록되지 않은 컬렉션: ${name} — docs/02a 배치표와 tenant-context.js를 함께 갱신하라`);
}

export function requireAcademyId(source) {
  const academyId = typeof source === 'string' ? source : source?.academyId;
  if (typeof academyId !== 'string' || !ACADEMY_ID.test(academyId)) {
    throw new TypeError('academyId 클레임이 없거나 형식이 아니다');
  }
  return academyId;
}

export function collectionPath(name, { academyId, mode } = {}) {
  requiredMode(mode);
  const kind = requiredKnown(name);
  if (kind === 'global') {
    if (academyId !== undefined) {
      throw new TypeError(`전역 컬렉션 ${name}에 academyId를 줄 수 없다 — 배치표 확인`);
    }
    return name;
  }
  if (mode === 'legacy') return name;
  return `academies/${requireAcademyId(academyId)}/${name}`;
}

export function docPath(name, id, context) {
  if (typeof id !== 'string' || !id) throw new TypeError(`docPath id가 비었다: ${name}`);
  return `${collectionPath(name, context)}/${id}`;
}

// 컷오버 스위치 — 빌드타임(클라: VITE_TENANT_PATHS) 또는 런타임(서버: TENANT_PATHS).
// 값이 정확히 'tenant'일 때만 전환, 그 외 전부 legacy(안전 기본값).
export function resolvePathMode(env) {
  const value = env?.VITE_TENANT_PATHS ?? env?.TENANT_PATHS;
  return value === 'tenant' ? 'tenant' : 'legacy';
}
