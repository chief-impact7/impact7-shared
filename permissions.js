// 에코시스템 전역 권한 카탈로그 (SSoT).
// - HR 권한설정 화면이 이 카탈로그를 렌더링 SSoT로 사용한다.
// - item.key 는 HR_users.permissions / staff.permissions 맵의 필드명이다.
// - 신규 키 추가 시 firestore.rules isSafeShortTermSelfCreate 화이트리스트도 함께 갱신할 것.
//
// enforced 값의 의미:
//   'rules'  — firestore.rules 서버 강제 (클라 우회 불가)
//   'client' — 앱 화면 제어만 (서버 강제 없음)
//   'none'   — 카탈로그만 (앱 미연동, 아직 미강제)

const STAFF_ROLE_RANK = Object.freeze({ member: 0, manager: 1, supervisor: 2, director: 3 });

export function canManageStaffPermissions(role) {
  return Object.hasOwn(STAFF_ROLE_RANK, role) && STAFF_ROLE_RANK[role] > 0;
}

export function canManageStaffRole(actorRole, targetRole) {
  return Object.hasOwn(STAFF_ROLE_RANK, actorRole)
    && Object.hasOwn(STAFF_ROLE_RANK, targetRole)
    && STAFF_ROLE_RANK[actorRole] > STAFF_ROLE_RANK[targetRole];
}

export const PERMISSION_GROUPS = [
  {
    key: 'app-access',
    title: '앱 접근',
    items: [
      { key: 'canAccessImpact7DB', label: '학생 DB', apps: ['DB'], enforced: 'client' },
      { key: 'canAccessImpact7DSC', label: 'DSC·로그북·메시지', apps: ['DSC'], enforced: 'client' },
      { key: 'canAccessImpact7HR', label: '인사·급여', apps: ['HR'], enforced: 'client' },
      { key: 'canAccessImpact7Exam', label: '시험·성적', apps: ['exam'], enforced: 'client' },
      { key: 'canAccessDashboard', label: '인원 현황', apps: ['대시보드'], enforced: 'client' },
      { key: 'canAccessImpact7Board', label: '업무 보드', apps: ['board'], enforced: 'client' },
      { key: 'canAccessImpact7Forms', label: '지원 폼', apps: ['forms'], enforced: 'client' },
      { key: 'canAccessPayments', label: '수납·결제', apps: ['수납'], enforced: 'client' },
      { key: 'canAccessImpact7Tablet', label: '태블릿 출결', apps: ['태블릿'], enforced: 'client' },
      { key: 'canAccessImpact7School', label: '학교정보', apps: ['school'], enforced: 'client' },
    ],
  },
  {
    key: 'sensitive',
    title: '민감 지표',
    items: [
      { key: 'canViewPopulationStats', label: '인원현황 보기 (전체)', apps: ['DB', 'DSC', 'exam', '대시보드'], enforced: 'rules' },
      { key: 'canViewClassCounts', label: '반별 인원 보기', apps: ['DB', 'DSC'], enforced: 'client' },
      { key: 'canViewDashboard', label: '대시보드 보기', apps: ['DB'], enforced: 'none' },
    ],
  },
  {
    key: 'students',
    title: '학생',
    items: [
      { key: 'canViewStudents', label: '학생 목록 보기', apps: ['DB', 'DSC'], enforced: 'none' },
      { key: 'canEditStudents', label: '학생 정보 수정', apps: ['DB', 'DSC'], enforced: 'none' },
      { key: 'canViewStudentPrivateInfo', label: '학생 개인정보 보기', apps: ['DB', 'DSC', 'exam'], enforced: 'none' },
      { key: 'canExportStudentData', label: '학생 데이터 내보내기', apps: ['DB'], enforced: 'none' },
      { key: 'canBulkEditStudents', label: '학생 일괄 편집·업로드', apps: ['DB'], enforced: 'none' },
    ],
  },
  {
    key: 'attendance',
    title: '출결/상담',
    items: [
      { key: 'canViewAttendance', label: '출결 보기', apps: ['DSC'], enforced: 'none' },
      { key: 'canEditAttendance', label: '출결 수정', apps: ['DSC'], enforced: 'none' },
      { key: 'canViewConsultations', label: '상담 보기', apps: ['DSC', '로그북'], enforced: 'none' },
      { key: 'canEditConsultations', label: '상담 수정', apps: ['DSC'], enforced: 'none' },
    ],
  },
  {
    key: 'academics',
    title: '학사·반 관리',
    items: [
      { key: 'canManageClasses', label: '반 편성·관리', apps: ['DSC'], enforced: 'none' },
      { key: 'canManageAcademicSettings', label: '학기·학년 승급 설정', apps: ['DB'], enforced: 'none' },
    ],
  },
  {
    key: 'requests',
    title: '요청서',
    items: [
      { key: 'canCreateLeaveRequests', label: '요청서작성', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canCreateLeaveRequestsOnBehalf', label: '요청서대리작성', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canApproveFacultyLeaveRequests', label: '교수부승인', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canApproveAdministrationLeaveRequests', label: '행정부승인', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canEditLeaveRequests', label: '요청서변경', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canEditLeaveRequestsOnBehalf', label: '요청서대리변경', apps: ['DB', 'DSC'], enforced: 'rules' },
    ],
  },
  {
    key: 'messaging',
    title: '메시지 발송',
    items: [
      { key: 'canSendMessages', label: '알림톡·문자 발송', apps: ['DSC', '로그북', '수납'], enforced: 'none' },
      { key: 'canSendPromoMessages', label: '광고성 캠페인 발송', apps: ['DB', 'DSC'], enforced: 'none' },
      { key: 'canSendEmail', label: '메일 발송', apps: ['HR'], enforced: 'none' },
    ],
  },
  {
    key: 'exams',
    title: '시험·성적',
    items: [
      { key: 'canViewExamResults', label: '성적 열람', apps: ['exam'], enforced: 'none' },
      { key: 'canEditExamScores', label: '채점·성적 수정', apps: ['exam'], enforced: 'client' },
      { key: 'canFinalizeExams', label: '시험 확정', apps: ['exam'], enforced: 'none' },
      { key: 'canSendReports', label: '성적표·성적 알림 발송', apps: ['exam'], enforced: 'none' },
      { key: 'canManageExamSettings', label: '시험 설정 관리', apps: ['exam'], enforced: 'client' },
    ],
  },
  {
    key: 'forms',
    title: '지원 폼',
    items: [
      { key: 'canPublishForms', label: '지원 폼 발행·삭제', apps: ['forms'], enforced: 'none' },
      { key: 'canViewFormSubmissions', label: '지원서 응답 열람', apps: ['forms'], enforced: 'none' },
    ],
  },
  {
    key: 'payments',
    title: '수납/급여',
    // 수납(payments) 앱 항목은 별도 Firebase 프로젝트라 현재 HR_users 연동 불가 — 카탈로그 표시만.
    items: [
      { key: 'canViewPayments', label: '수납 보기', apps: ['수납'], enforced: 'none' },
      { key: 'canManagePayments', label: '수납 처리', apps: ['수납'], enforced: 'none' },
      { key: 'canProcessRefunds', label: '환불 처리', apps: ['수납'], enforced: 'none' },
      { key: 'canViewSettlement', label: '정산·매출 열람', apps: ['수납'], enforced: 'none' },
      { key: 'canViewSalary', label: '급여 보기', apps: ['HR'], enforced: 'none' },
      { key: 'canManagePayroll', label: '급여 관리', apps: ['HR'], enforced: 'none' },
    ],
  },
  {
    key: 'hr',
    title: '채용',
    items: [
      { key: 'canManageOnboarding', label: '온보딩', apps: ['HR'], enforced: 'rules' },
      { key: 'canManageContracts', label: '계약서', apps: ['HR'], enforced: 'rules' },
      {
        id: 'salary-agreement',
        label: '급여약정서',
        children: [
          { key: 'canManageAdministrationSalaryAgreements', label: '행정', apps: ['HR'], enforced: 'rules' },
          { key: 'canManageFacultySalaryAgreements', label: '교수', apps: ['HR'], enforced: 'rules' },
        ],
      },
      { key: 'canViewEmployees', label: '직원 정보 열람', apps: ['HR'], enforced: 'none' },
      { key: 'canManageEmployees', label: '직원 관리', apps: ['HR'], enforced: 'rules' },
      { key: 'canViewStaffAttendance', label: '직원 근태 열람', apps: ['HR'], enforced: 'none' },
      { key: 'canManageStaffAttendance', label: '직원 근태 보정', apps: ['HR', 'DB'], enforced: 'none' },
      { key: 'canSignContract', label: '계약 서명', apps: ['HR'], enforced: 'client' },
      { key: 'canViewStaffDocuments', label: '서류함 열람', apps: ['HR'], enforced: 'none' },
    ],
  },
  {
    key: 'finance',
    title: '재무·운영',
    items: [
      { key: 'canManageExpenses', label: '비용·거래처 관리', apps: ['HR', '수납'], enforced: 'none' },
      { key: 'canManageTaxReports', label: '세무 관리', apps: ['HR'], enforced: 'none' },
      { key: 'canManageOrgSettings', label: '사업자·조직 설정', apps: ['HR'], enforced: 'none' },
      { key: 'canRunAiBatch', label: 'AI 일괄 생성 (비용 발생)', apps: ['DB', 'DSC'], enforced: 'rules' },
    ],
  },
  {
    key: 'admin',
    title: '관리',
    items: [
      { key: 'canManagePermissions', label: '권한 설정·위임', apps: ['HR'], enforced: 'rules' },
    ],
  },
];

/**
 * @param {Array<{ key: string } | { children: any[] }>} items
 * @returns {string[]}
 */
const permissionKeys = (items) => items.flatMap((item) => (
  'children' in item ? permissionKeys(item.children) : [item.key]
));

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) => permissionKeys(group.items));

export function hasPermission(user, permission) {
  return ['owner', 'principal'].includes(user?.role) || user?.permissions?.[permission] === true;
}

export function hasAppAccess(user, permission) {
  return hasPermission(user, permission);
}

export function hasRequestPermission(hrUser, permission) {
  return hasPermission(hrUser, permission);
}

export function canCreateLeaveRequest(hrUser) {
  return hasRequestPermission(hrUser, 'canCreateLeaveRequests')
    || hasRequestPermission(hrUser, 'canCreateLeaveRequestsOnBehalf');
}

export function canEditLeaveRequest(hrUser, isAuthor) {
  return hasRequestPermission(
    hrUser,
    isAuthor ? 'canEditLeaveRequests' : 'canEditLeaveRequestsOnBehalf',
  );
}

// 오너/원장만 부여·회수할 수 있는 민감 권한.
export const SENSITIVE_PERMISSION_KEYS = ['canViewPopulationStats', 'canViewClassCounts', 'canManagePermissions'];
