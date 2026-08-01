// enrollments 배열 전수 계약 검증. 정본은 루트 AGENTS.md 「수업계열 도메인 계약」.
// firestore.rules가 index 0~4로 펼쳐 검사하던 것(상한 5)을 대체하므로 상한이 없다 —
// 특강·기타 다중 보유가 계약대로 허용된다. 서버(callable)와 클라(저장 전)가 같은 함수를 쓴다.

import { ACCOUNT_TYPES, ENROLLABLE_STATUSES, isValidEnrollmentClassType } from './enrollment-status.js';

const REGULAR_OVERRIDE_CLASS_TYPES = new Set(['내신', '자유학기']);

function hasRegularBase(enrollments, accountId) {
  return enrollments.some(item =>
    item?.account_type === '정규'
    && item?.class_type === '정규'
    && item?.account_id === accountId);
}

// 항목당 첫 위반만 반환한다. 뒤 축은 앞 축이 유효해야 의미가 있고,
// 소비자(callable)는 학생당 code 하나를 사용자에게 보여 준다.
function itemError(enrollment, index, status, enrollments) {
  const accountType = enrollment?.account_type;
  const classType = enrollment?.class_type;

  if (!ACCOUNT_TYPES.includes(accountType)) {
    return { code: 'E_ACCOUNT_TYPE', index, message: '수업계열이 정규·특강·기타 중 하나여야 합니다.' };
  }
  if (!isValidEnrollmentClassType(accountType, classType)) {
    return {
      code: 'E_CLASS_TYPE',
      index,
      message: `수업계열(${accountType})과 소분류(${classType || '없음'})의 조합이 올바르지 않습니다.`,
    };
  }
  if (typeof enrollment.account_id !== 'string' || !enrollment.account_id) {
    return { code: 'E_ACCOUNT_ID', index, message: '수강계정이 지정되지 않은 수업이 있습니다.' };
  }
  if (!ENROLLABLE_STATUSES.has(status) && accountType !== '기타') {
    return { code: 'E_STATUS', index, message: `${status} 상태에서는 기타수업만 보유할 수 있습니다.` };
  }
  if (REGULAR_OVERRIDE_CLASS_TYPES.has(classType) && !hasRegularBase(enrollments, enrollment.account_id)) {
    return { code: 'E_REGULAR_BASE', index, message: `${classType} 수업을 연결할 정규 수강계정이 없습니다.` };
  }
  return null;
}

// (enrollments, { status }) → { valid, errors: [{ code, index, message }] }
// enrollment_account_types는 서버 파생값이라 입력으로 받지 않는다.
export function validateEnrollmentContract(enrollments, { status } = {}) {
  const list = Array.isArray(enrollments) ? enrollments : [];
  const errors = list
    .map((enrollment, index) => itemError(enrollment, index, status, list))
    .filter(Boolean);
  return { valid: errors.length === 0, errors };
}
