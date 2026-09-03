// 학생 1명의 특정 기간 정규 enrollment를 다른 반으로 이동한 새 배열을 반환한다 (순수 함수, in-place 아님).
// override·start_date·day는 보존. 대상 정규가 없으면 skipped.

import {
  assignEnrollmentScheduleRoles, enrollmentCode, ENROLLMENT_WEEKDAYS, enrollmentWeekdayRank,
} from './enrollment-derivation.js';
import { accountTypeOf, groupEnrollmentAccounts } from './enrollment-status.js';
import { addDays } from './datetime.js';
import { normalizedDays } from './expected-arrival.js';

const isRegular = (e) =>
  accountTypeOf(e) === '정규' && (e.class_type || '정규') === '정규';
const overlapsPeriod = (enrollment, period) => period
  && (!enrollment.start_date || !period.end || enrollment.start_date <= period.end)
  && (!enrollment.end_date || enrollment.end_date >= period.start);
const lastDigit = (n) => {
  const m = String(n ?? '').match(/(\d)\D*$/);
  return m ? Number(m[1]) : null;
};

export function moveClass(student, { period, targetLevelSymbol, targetClassNumber, accountId }) {
  const enrollments = student.enrollments || [];
  const idx = enrollments.findIndex((e) =>
    isRegular(e)
    && overlapsPeriod(e, period)
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
  const activeItems = regularItems.filter(activeAt);
  const moveCandidates = activeItems.length
    ? activeItems
    : regularItems.filter(e => e.start_date && e.start_date > today);
  if (!moveCandidates.length) return skipped('이동할 정규수업반을 찾지 못했습니다.');
  const earliestRank = Math.min(...moveCandidates.map(enrollmentWeekdayRank));
  const earliestCandidates = moveCandidates.filter(e => enrollmentWeekdayRank(e) === earliestRank);
  const current = earliestCandidates.find(e => e.schedule_role === 'base') || earliestCandidates[0];

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
    if (isRegularItem(e) && e.schedule_role !== 'alternate' && e.start_date && e.start_date > today) return [];
    return [e];
  });
  const sameRegularAccountAtMove = (e) =>
    isRegular(e)
    && (current.account_id ? e.account_id === current.account_id : !e.account_id)
    && (!e.start_date || e.start_date <= moveDate)
    && (!e.end_date || e.end_date >= moveDate);
  const normalizedSchedules = assignEnrollmentScheduleRoles(updatedEnrollments.filter(sameRegularAccountAtMove));
  let scheduleIndex = 0;
  const normalizedEnrollments = updatedEnrollments.map(e =>
    sameRegularAccountAtMove(e) ? normalizedSchedules[scheduleIndex++] : e);

  return {
    updatedEnrollments: normalizedEnrollments, before, after, skipped: false,
    warning: naesinParityWarning(student.name, current, targetClassNumber),
  };
}

export function changeRegularClassWeekdays(student, { changes, effectiveDate, today }) {
  const enrollments = student.enrollments || [];
  const skipped = (warning) => ({
    updatedEnrollments: enrollments, changes: [], skipped: true, warning,
  });
  if (!effectiveDate || !today) return skipped('적용일과 기준일이 필요합니다.');
  if (effectiveDate < today) return skipped('적용일은 오늘 이후여야 합니다.');
  if (!Array.isArray(changes) || !changes.length) return skipped('변경할 요일이 필요합니다.');

  const seen = new Set();
  for (const change of changes) {
    if (!ENROLLMENT_WEEKDAYS.includes(change?.weekday)) return skipped('변경 요일이 올바르지 않습니다.');
    if (seen.has(change.weekday)) return skipped('변경 요일이 중복되었습니다.');
    if (!change.targetLevelSymbol || !change.targetClassNumber) return skipped('대상 정규반이 필요합니다.');
    seen.add(change.weekday);
  }

  const regularAccounts = groupEnrollmentAccounts(enrollments)
    .filter(account => account.accountType === '정규');
  if (regularAccounts.length !== 1) {
    return skipped(regularAccounts.length
      ? '정규 계정이 2개 이상이라 자동 변경할 수 없습니다.'
      : '정규 계정이 없습니다. 반 배정은 반생성마법사로 하세요.');
  }
  const account = regularAccounts[0];
  const accountItems = new Set(account.items);
  const isRegularItem = (enrollment) => accountItems.has(enrollment) && isRegular(enrollment);
  const activeAtDate = (enrollment) => (!enrollment.start_date || enrollment.start_date <= effectiveDate)
    && (!enrollment.end_date || enrollment.end_date >= effectiveDate);
  const active = enrollments.filter(enrollment => isRegularItem(enrollment) && activeAtDate(enrollment));
  const selected = [];

  for (const change of changes) {
    const candidates = active.filter(enrollment => normalizedDays(enrollment.day).includes(change.weekday));
    if (candidates.length !== 1) {
      return skipped(candidates.length
        ? `${change.weekday}요일 정규반이 여러 개라 자동 변경할 수 없습니다.`
        : `${change.weekday}요일 정규반을 찾지 못했습니다.`);
    }
    const source = candidates[0];
    const before = enrollmentCode(source);
    const after = `${change.targetLevelSymbol}${change.targetClassNumber}`;
    if (before === after) return skipped(`${change.weekday}요일은 이미 ${after}반입니다.`);
    selected.push({ ...change, source, before, after });
  }

  const selectedBySource = new Map();
  for (const change of selected) {
    const sourceChanges = selectedBySource.get(change.source) || [];
    sourceChanges.push(change);
    selectedBySource.set(change.source, sourceChanges);
  }
  const updatedEnrollments = enrollments.flatMap((enrollment) => {
    const sourceChanges = selectedBySource.get(enrollment);
    if (!sourceChanges) return [enrollment];
    const changedDays = new Set(sourceChanges.map(change => change.weekday));
    const remainingDays = normalizedDays(enrollment.day).filter(day => !changedDays.has(day));
    const replacements = [
      ...(remainingDays.length ? [{ ...enrollment, day: remainingDays, start_date: effectiveDate }] : []),
      ...sourceChanges.map(change => ({
        ...enrollment,
        level_symbol: change.targetLevelSymbol,
        class_number: change.targetClassNumber,
        day: [change.weekday],
        start_date: effectiveDate,
      })),
    ];
    if (enrollment.start_date && enrollment.start_date >= effectiveDate) return replacements;
    return [{ ...enrollment, end_date: addDays(effectiveDate, -1) }, ...replacements];
  });
  const sameAccountAtDate = (enrollment) => isRegular(enrollment)
    && (account.accountId === null ? !enrollment.account_id : enrollment.account_id === account.accountId)
    && activeAtDate(enrollment);
  const normalized = assignEnrollmentScheduleRoles(updatedEnrollments.filter(sameAccountAtDate));
  let scheduleIndex = 0;

  return {
    updatedEnrollments: updatedEnrollments.map(enrollment => (
      sameAccountAtDate(enrollment) ? normalized[scheduleIndex++] : enrollment
    )),
    changes: selected.map(({ weekday, before, after }) => ({ weekday, before, after })),
    skipped: false,
    warning: selected.map(change => naesinParityWarning(
      student.name, change.source, change.targetClassNumber,
    )).find(Boolean) || null,
  };
}
