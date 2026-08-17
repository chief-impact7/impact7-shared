// 테넌트 경로 SSoT (AcademION 2단계 산출물 02c의 구현, 3단계 3a의 유일한 경로 통로).
// legacy 모드는 오늘의 평면 경로를 그대로 돌려준다(동작 불변) — 컷오버(3b)는
// resolvePathMode의 환경값 하나로 전 앱이 tenant 경로로 전환된다.
// 컬렉션 배치의 정본: AcademION docs/02a-컬렉션-배치표.md (원장 확정 3축 반영).

// 테넌트 이동 — impact7db 64개 (배치표 그대로)
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
  // 공개 폼 (forms 순번 4에서 검출 — 학원이 만드는 신청 폼과 제출)
  'custom_forms', 'custom_form_versions', 'custom_form_submissions',
  // AI 사용량 로그 — 테넌트별 사용량이 SaaS 과금의 기초 (exam 순번 10에서 검출)
  'ai_usage',
  // 메시지 발송 멱등·감사와 출결 알림 운영 (impact7-functions 심층 실측, 3b 준비에서 검출)
  'bulk_campaigns', 'direct_batches', 'message_request_batches', 'message_deletions',
  'message_opt_out_audit', 'template_audit', 'attendance_notification_gaps',
  // 재원생 학교 연결·학교별 인원 — 학원 데이터
  'school_mappings', 'school_headcount',
];

// 테넌트 이동 — payments 프로젝트(impact7-payments) 소유 컬렉션.
// 파일럿(3a 순번 0)에서 확장: 수강료 청구·결제는 전부 학원 단위 데이터다.
// payments의 impact7db 미러 읽기(students·teachers·staff 등)는 동명이라
// 위 SCOPED_IMPACT7DB/전역 등록을 그대로 공유한다 — 별도 등록 불요.
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
  // 본사 축 — Google Chat 동기화(admin 전용)와 나이스 공공정보 캐시(전 테넌트 공유 콘텐츠)
  'chat_messages', 'sync_state', 'schools', 'school_daily', 'school_collection',
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

// admin SDK 컬렉션 헬퍼 — receiver가 db.collection(path) 인터페이스인 서버 코드용.
// 3a 소비자 3곳(payments·impact7-functions·consultation)에서 승격한 정본. env는
// 명시 주입(클라 번들 안전·테스트 용이) — 앱 어댑터가 process.env를 바인딩한다.
// 전역 컬렉션은 tenant 모드에서도 academyId 없이(collectionPath가 전역+aid 조합 거부).
// 파일럿(단일 테넌트) 한정: academyId는 env 고정 — 다학원 요청 컨텍스트 주입은
// 3b 이후 설계 항목, AcademION docs/02c D3 참조.
export function col(db, name, env) {
  const mode = resolvePathMode(env);
  const academyId = mode === 'tenant' && ACADEMY_SCOPED_COLLECTIONS.has(name)
    ? (env?.ACADEMY_ID ?? 'impact7')
    : undefined;
  return db.collection(collectionPath(name, { academyId, mode }));
}

// 클라(경로 문자열) 헬퍼 — modular SDK는 ref가 아니라 경로 문자열을 받는다.
// 서버 col()과 대칭: tenant 모드에서 스코프 컬렉션만 academyId를 요구·접두하고
// (부재 시 requireAcademyId가 fail-fast), 전역 컬렉션과 legacy는 aid 없이 평면.
// env는 명시 주입 — 앱 어댑터가 빌드타임 env와 로그인 클레임(academyId)을 바인딩한다.
export function colPathFor(name, env, academyId) {
  const mode = resolvePathMode(env);
  const aid = mode === 'tenant' && ACADEMY_SCOPED_COLLECTIONS.has(name)
    ? requireAcademyId(academyId)
    : undefined;
  return collectionPath(name, { academyId: aid, mode });
}

export function docPathFor(name, id, env, academyId) {
  if (typeof id !== 'string' || !id) throw new TypeError(`docPathFor id가 비었다: ${name}`);
  return `${colPathFor(name, env, academyId)}/${id}`;
}
