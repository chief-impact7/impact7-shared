// 학생 1명의 특정 학기 정규 enrollment를 다른 반으로 이동한 새 배열을 반환한다 (순수 함수, in-place 아님).
// override·start_date·day·semester는 보존. 대상 정규가 없으면 skipped.

import { enrollmentCode } from './enrollment-derivation.js';
import { accountTypeOf, groupEnrollmentAccounts } from './enrollment-status.js';
import { addDays } from './datetime.js';

const isRegular = (e) =>
  accountTypeOf(e) === '정규' && (e.class_type || '정규') === '정규';
const lastDigit = (n) => {
  const m = String(n ?? '').match(/(\d)\D*$/);
  return m ? Number(m[1]) : null;
};

export function moveClass(student, { semester, targetLevelSymbol, targetClassNumber, accountId }) {
  const enrollments = student.enrollments || [];
  const idx = enrollments.findIndex((e) =>
    isRegular(e)
    && e.semester === semester
    && (accountId === undefined || e.account_id === accountId));
  if (idx < 0) {
    return { updatedEnrollments: enrollments, before: null, after: null, skipped: true, warning: null };
  }
  const target = enrollments[idx];
  const before = enrollmentCode(target);
  const after = `${targetLevelSymbol || ''}${targetClassNumber || ''}`;
  const updatedEnrollments = enrollments.map((e, i) =>
    i === idx ? { ...e, level_symbol: targetLevelSymbol, class_number: targetClassNumber } : e
  );

  return {
    updatedEnrollments, before, after, skipped: false,
    warning: naesinParityWarning(student.name, target, targetClassNumber),
  };
}

function naesinParityWarning(studentName, sourceItem, targetClassNumber) {
  const hasOverride =
    typeof sourceItem.naesin_class_override === 'string' && sourceItem.naesin_class_override !== '';
  const oldP = lastDigit(sourceItem.class_number);
  const newP = lastDigit(targetClassNumber);
  if (!hasOverride && oldP != null && newP != null && oldP % 2 !== newP % 2) {
    return `${studentName || ''}: 반번호 끝자리 홀짝(A/B)이 바뀌어 내신 자동매핑이 달라질 수 있음`;
  }
  return null;
}

// 정규 반이동 SSoT — 이동일 기준으로 옛 반을 전날까지 유지하고 새 반을 이동일부터 시작하는
// 같은 계정의 2단 구성을 만든다. 예약(미래) 이동과 즉시 이동을 한 모델로 처리해
// "미래 시작만 남는 공백"(2026-08-16 강등 사고)을 만들지 않는다.
// - 이동일 전부터 다니던 활성 반은 end_date를 이동일 전날로 닫고 새 항목을 추가
// - 아직 시작 전(예약) 반이거나 이동일에 시작한 반은 제자리 교체
// - 기존 다른 예약 조각은 새 예약으로 대체(제거)
// - 정규 계정이 없거나 2개 이상이면 skipped (배정·정리는 반생성마법사 경로)
export function moveRegularClass(student, {
  targetLevelSymbol, targetClassNumber, targetDay, moveDate, today,
}) {
  const enrollments = student.enrollments || [];
  const skipped = (warning) =>
    ({ updatedEnrollments: enrollments, before: null, after: null, skipped: true, warning });
  if (!moveDate || !today) return skipped('이동일과 기준일이 필요합니다.');
  if (moveDate < today) return skipped('이동일은 오늘 이후여야 합니다.');

  const regularAccounts = groupEnrollmentAccounts(enrollments)
    .filter(account => account.accountType === '정규');
  if (regularAccounts.length !== 1) {
    return skipped(regularAccounts.length
      ? '정규 계정이 2개 이상이라 자동 이동할 수 없습니다.'
      : '정규 계정이 없습니다. 반 배정은 반생성마법사로 하세요.');
  }
  const accountItems = new Set(regularAccounts[0].items);
  const isRegularItem = (e) => accountItems.has(e) && (e.class_type || '정규') === '정규';
  const regularItems = enrollments.filter(isRegularItem);

  const activeAt = (e) =>
    (!e.start_date || e.start_date <= today) && (!e.end_date || e.end_date >= today);
  const current = regularItems.find(activeAt)
    || regularItems.find(e => e.start_date && e.start_date > today);
  if (!current) return skipped('이동할 정규수업반을 찾지 못했습니다.');

  const before = enrollmentCode(current);
  const after = `${targetLevelSymbol || ''}${targetClassNumber || ''}`;
  const moved = {
    ...current,
    level_symbol: targetLevelSymbol,
    class_number: targetClassNumber,
    ...(targetDay?.length ? { day: targetDay } : {}),
    start_date: moveDate,
  };
  delete moved.end_date;
  delete moved.end_reason;

  const keepCurrentUntil = activeAt(current)
    && (!current.start_date || current.start_date < moveDate);
  const updatedEnrollments = enrollments.flatMap(e => {
    if (e === current) {
      return keepCurrentUntil ? [{ ...e, end_date: addDays(moveDate, -1) }, moved] : [moved];
    }
    if (isRegularItem(e) && e.start_date && e.start_date > today) return [];
    return [e];
  });

  return {
    updatedEnrollments, before, after, skipped: false,
    warning: naesinParityWarning(student.name, current, targetClassNumber),
  };
}
