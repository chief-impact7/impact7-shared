// enrollment ↔ status 정합성 (단일 소스). DB·DSC 등이 import.
// 재원 계열(enrollment 보유 가능): 재원/등원예정/실휴원/가휴원
// 비재원(enrollment 없어야): 상담/퇴원/종강

export const ENROLLABLE_STATUSES = new Set(['재원', '등원예정', '실휴원', '가휴원']);
export const NON_ENROLLABLE_STATUSES = new Set(['상담', '퇴원', '종강']);
export const ACCOUNT_TYPES = ['정규', '특강', '기타'];
export const CLASS_TYPES = ['정규', '내신', '자유학기', '특강', '기타'];

// 휴원(일시정지) 상태 집합 — 재원 유지(ENROLLABLE) 중 '멈춤' 표시·현인원 산식 등에서
// 반복되던 부분집합. status==='실휴원'||status==='가휴원' 인라인 대체용 SSoT.
export const LEAVE_STATUSES = new Set(['실휴원', '가휴원']);

// 반배정(enrollment)을 가질 수 있는 status인가 (재원 계열).
export function isEnrollableStatus(status) {
  return ENROLLABLE_STATUSES.has(status);
}

export function canRegisterStudentInClass(status, classType) {
  return classType === '특강'
    || classType === '기타'
    || (isValidEnrollmentClassType('정규', classType) && isEnrollableStatus(status));
}

// enrollment 중 실질 반코드를 가진 것이 있는지 (빈 placeholder 제외).
export function hasRealEnrollment(enrollments) {
  return (enrollments || []).some(e => e && (e.level_symbol || e.class_number));
}

export function hasRegularOrSpecialEnrollment(enrollments) {
  return hasRealEnrollment((enrollments || []).filter(item =>
    ['정규', '특강'].includes(accountTypeOf(item))
  ));
}

const _validDate = (d) => !!d && /^\d{4}-/.test(d);
const _isDateActive = (e, dateStr) =>
  !_validDate(dateStr)
  || ((!_validDate(e?.start_date) || e.start_date <= dateStr)
    && (!_validDate(e?.end_date) || e.end_date >= dateStr));
const _isPauseActive = (e, dateStr) =>
  _validDate(e?.pause_start_date) && e.pause_start_date <= dateStr
  && (!_validDate(e.pause_end_date) || e.pause_end_date >= dateStr);

export function accountTypeOf(enrollment) {
  if (ACCOUNT_TYPES.includes(enrollment?.account_type)) return enrollment.account_type;
  if (enrollment?.class_type === '특강') return '특강';
  if (enrollment?.class_type === '기타') return '기타';
  return '정규';
}

const ACCOUNT_CLASS_TYPES = {
  '정규': new Set(['정규', '내신', '자유학기']),
  '특강': new Set(['특강']),
  '기타': new Set(['기타']),
};

export function isValidEnrollmentClassType(accountType, classType) {
  return ACCOUNT_CLASS_TYPES[accountType]?.has(classType) || false;
}

function legacyAccountKey(account) {
  const representative = account.accountType === '정규'
    ? account.items.find(item => (item.class_type || '정규') === '정규') || account.items[0]
    : account.items[0];
  return `legacy:${account.accountType}:${representative.level_symbol || ''}${representative.class_number || ''}`;
}

export function groupEnrollmentAccounts(enrollments) {
  const groups = [];
  const byId = new Map();
  let legacyRegular = null;

  for (const item of enrollments || []) {
    if (!item || typeof item !== 'object' || (!item.level_symbol && !item.class_number)) continue;
    const accountId = item?.account_id || null;
    const accountType = accountTypeOf(item);

    if (accountId) {
      let group = byId.get(accountId);
      if (!group) {
        group = { accountId, accountType, items: [], typeConflict: false };
        byId.set(accountId, group);
        groups.push(group);
      } else if (group.accountType !== accountType) {
        group.typeConflict = true;
      }
      group.items.push(item);
    } else if (accountType === '정규') {
      if (!legacyRegular) {
        legacyRegular = { accountId: null, accountType, items: [], typeConflict: false };
        groups.push(legacyRegular);
      }
      legacyRegular.items.push(item);
    } else {
      groups.push({ accountId: null, accountType, items: [item], typeConflict: false });
    }
  }
  return groups.map(account => ({
    ...account,
    key: account.accountId || legacyAccountKey(account),
  }));
}

export function deriveEnrollmentAccountTypes(enrollments) {
  const present = new Set(
    groupEnrollmentAccounts(enrollments).flatMap(account => account.items).map(accountTypeOf)
  );
  return ACCOUNT_TYPES.filter(accountType => present.has(accountType));
}

export function accountStateAt(account, dateStr) {
  const items = account?.items || [];
  if (!items.length) return '종료';
  // YYYY- 접두 관례 밖 dateStr는 형식 오류만으로 활성 계정을 제외하지 않는다.
  if (!_validDate(dateStr)) return '활성';
  if (items.every(e => _validDate(e?.end_date) && e.end_date < dateStr)) return '종료';
  if (items.some(e => _isPauseActive(e, dateStr))) return '휴원';
  if (items.some(e => _isDateActive(e, dateStr))) return '활성';
  if (items.some(e => _validDate(e?.start_date) && e.start_date > dateStr)) return '예정';
  return '종료';
}

export function openAccounts(enrollments, dateStr) {
  return groupEnrollmentAccounts(enrollments).filter(account => accountStateAt(account, dateStr) !== '종료');
}

export function openAccountIds(enrollments, dateStr) {
  return openAccounts(enrollments, dateStr)
    .map(account => account.accountId)
    .filter(accountId => accountId !== null);
}

const LEAVE_TYPE_CHANGE_SOURCE = { 실휴원: '가휴원', 가휴원: '실휴원' };

export function leaveTypeChangeSource(targetType) {
  return LEAVE_TYPE_CHANGE_SOURCE[targetType] || '';
}

export function leaveTypeChangeAccounts(enrollments, targetType, dateStr) {
  const sourceType = leaveTypeChangeSource(targetType);
  if (!sourceType) return [];
  return groupEnrollmentAccounts(enrollments).flatMap(account => {
    const pausedItems = account.items.filter(item => _isPauseActive(item, dateStr));
    return pausedItems.length > 0
      && pausedItems.every(item => (item.leave_sub_type || '실휴원') === sourceType)
      ? [{ ...account, pausedItems }]
      : [];
  });
}

export function activeEnrollmentsAt(enrollments, dateStr) {
  const list = enrollments || [];
  const activeItems = new Set(
    groupEnrollmentAccounts(list)
      .filter(account => accountStateAt(account, dateStr) === '활성')
      .flatMap(account => account.items.filter(item => _isDateActive(item, dateStr)))
  );
  return list.filter(item => activeItems.has(item));
}

export function activeRegularBases(enrollments, dateStr) {
  return activeEnrollmentsAt(enrollments, dateStr)
    .filter(enrollment => (enrollment.class_type || '정규') === '정규' && enrollment.day?.length);
}

export function findActiveRegularBase(enrollments, dateStr) {
  return activeRegularBases(enrollments, dateStr)[0] || null;
}

export function hasActiveRegularAccount(enrollments, dateStr) {
  return groupEnrollmentAccounts(enrollments)
    .some(account => account.accountType === '정규' && accountStateAt(account, dateStr) === '활성');
}

function accountItemsBySelector(enrollments, selector) {
  if (!selector) return null;
  return groupEnrollmentAccounts(enrollments)
    .find(account => account.accountId === selector || account.key === selector)?.items || null;
}

export function pauseAccount(enrollments, accountId, {
  pauseStart, pauseEnd, leaveSubType,
} = {}) {
  const list = enrollments || [];
  const items = accountItemsBySelector(list, accountId);
  if (!items) return { updatedEnrollments: list, skipped: true };
  const target = new Set(items);
  return {
    updatedEnrollments: list.map(item => {
      if (!target.has(item)) return item;
      const { pause_end_date, ...withoutPauseEnd } = item;
      return {
        ...withoutPauseEnd,
        pause_start_date: pauseStart,
        ...(pauseEnd === undefined ? {} : { pause_end_date: pauseEnd }),
        leave_sub_type: leaveSubType,
      };
    }),
    skipped: false,
  };
}

export function resumeAccount(enrollments, accountId) {
  const list = enrollments || [];
  const items = accountItemsBySelector(list, accountId);
  if (!items) return { updatedEnrollments: list, skipped: true };
  const target = new Set(items);
  return {
    updatedEnrollments: list.map(item => {
      if (!target.has(item)) return item;
      const {
        pause_start_date, pause_end_date, leave_sub_type, ...resumed
      } = item;
      return resumed;
    }),
    skipped: false,
  };
}

export function closeAccount(enrollments, accountId, { endDate, endReason } = {}) {
  const list = enrollments || [];
  const items = accountItemsBySelector(list, accountId);
  if (!items) return { updatedEnrollments: list, removed: [], skipped: true };
  const target = new Set(items);
  return {
    updatedEnrollments: list.filter(item => !target.has(item)),
    removed: list
      .filter(item => target.has(item))
      .map(item => ({ ...item, end_date: endDate, end_reason: endReason })),
    skipped: false,
  };
}

export function deriveStudentStatusAfterAccountChange(enrollments, dateStr, {
  fallbackReason, currentStatus, changedAccountType,
} = {}) {
  if (changedAccountType === '기타' && currentStatus !== undefined) return currentStatus;

  const accounts = groupEnrollmentAccounts(enrollments)
    .filter(account => account.accountType !== '기타');
  if (!accounts.length && currentStatus !== undefined && !fallbackReason) return currentStatus;

  const states = accounts.map(account => [account, accountStateAt(account, dateStr)]);
  if (states.some(([, state]) => state === '활성')) {
    return ENROLLABLE_STATUSES.has(currentStatus) ? currentStatus : '재원';
  }

  const paused = states.filter(([, state]) => state === '휴원').map(([account]) => account);
  if (paused.length) {
    return paused.some(account => account.items.some(item => item?.leave_sub_type === '실휴원'))
      ? '실휴원'
      : '가휴원';
  }
  if (states.some(([, state]) => state === '예정')) return '등원예정';
  return fallbackReason === '퇴원' ? '퇴원' : '종강';
}

// 저장 직전 status↔enrollment 정합성 검사/정리.
// - 비재원(상담/퇴원/종강): 기타 enrollment만 보존 (valid: true)
// - 재원 계열: 실질 enrollment ≥1 필요 (없으면 valid: false + reason)
// - 7종 밖 status(오타·구 데이터·undefined): valid: false — 정합성 불명인 채 저장 차단
// 반환: { enrollments, valid, reason? }
export function reconcileEnrollments(status, enrollments, opts) {
  const list = enrollments || [];
  if (!ENROLLABLE_STATUSES.has(status) && !NON_ENROLLABLE_STATUSES.has(status)) {
    return {
      enrollments: list,
      valid: false,
      reason: `알 수 없는 상태(${status || '없음'})입니다. 재원·등원예정·실휴원·가휴원·상담·퇴원·종강 중 하나여야 합니다.`,
    };
  }
  const invalidEnrollment = list.find(item => item && (
    (item.account_type != null && !ACCOUNT_TYPES.includes(item.account_type))
    || !isValidEnrollmentClassType(accountTypeOf(item), item.class_type || '정규')
  ));
  if (invalidEnrollment) {
    return {
      enrollments: list,
      valid: false,
      reason: `수업계열(${invalidEnrollment.account_type || accountTypeOf(invalidEnrollment)})과 소분류(${invalidEnrollment.class_type || '정규'}) 조합이 올바르지 않습니다.`,
    };
  }
  if (NON_ENROLLABLE_STATUSES.has(status)) {
    return { enrollments: list.filter(item => accountTypeOf(item) === '기타'), valid: true };
  }
  if (!hasRegularOrSpecialEnrollment(list)) {
    return {
      enrollments: list,
      valid: false,
      reason: '재원·등원예정·휴원 상태로 저장하려면 정규반 또는 특강을 최소 1개 입력하세요.',
    };
  }
  const regularOverrideWithoutBase = groupEnrollmentAccounts(list).find(account =>
    account.accountType === '정규'
    && (!opts?.dateStr || accountStateAt(account, opts.dateStr) !== '종료')
    && account.items.some(item => ['내신', '자유학기'].includes(item.class_type))
    && !account.items.some(item => (item.class_type || '정규') === '정규')
  );
  if (regularOverrideWithoutBase) {
    return {
      enrollments: list,
      valid: false,
      reason: '내신·자유학기수업은 같은 정규계정의 정규수업반을 먼저 배정해야 합니다.',
    };
  }
  if (
    status === '재원'
    && (LEAVE_STATUSES.has(opts?.previousStatus) || opts?.previousStatus === '퇴원')
    && (!opts?.dateStr || !hasActiveRegularAccount(list, opts.dateStr))
  ) {
    return {
      enrollments: list,
      valid: false,
      reason: '휴원·퇴원 학생을 재원으로 변경하려면 활성 정규반을 먼저 배정하세요.',
    };
  }
  if (opts?.dateStr) {
    const accounts = groupEnrollmentAccounts(list);
    if (accounts.some(account => account.typeConflict)) {
      return {
        enrollments: list,
        valid: false,
        reason: '같은 수강계정에 서로 다른 계정 유형이 섞여 있습니다.',
      };
    }
    if (accounts.every(account => accountStateAt(account, opts.dateStr) === '종료')) {
      return {
        enrollments: list,
        valid: false,
        reason: '재원·등원예정·휴원 상태로 저장하려면 열린 수강계정이 최소 1개 있어야 합니다.',
      };
    }
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
