// 학생 1명의 특정 학기 정규 enrollment를 다른 반으로 이동한 새 배열을 반환한다 (순수 함수, in-place 아님).
// override·start_date·day·semester는 보존. 대상 정규가 없으면 skipped.

import { enrollmentCode } from './enrollment-derivation.js';

const isRegular = (e) => (e.class_type || '정규') === '정규';
const lastDigit = (n) => {
  const m = String(n ?? '').match(/(\d)\D*$/);
  return m ? Number(m[1]) : null;
};

export function moveClass(student, { semester, targetLevelSymbol, targetClassNumber }) {
  const enrollments = student.enrollments || [];
  const idx = enrollments.findIndex((e) => isRegular(e) && e.semester === semester);
  if (idx < 0) {
    return { updatedEnrollments: enrollments, before: null, after: null, skipped: true, warning: null };
  }
  const target = enrollments[idx];
  const before = enrollmentCode(target);
  const after = `${targetLevelSymbol || ''}${targetClassNumber || ''}`;
  const updatedEnrollments = enrollments.map((e, i) =>
    i === idx ? { ...e, level_symbol: targetLevelSymbol, class_number: targetClassNumber } : e
  );

  let warning = null;
  const hasOverride =
    typeof target.naesin_class_override === 'string' && target.naesin_class_override !== '';
  const oldP = lastDigit(target.class_number);
  const newP = lastDigit(targetClassNumber);
  if (!hasOverride && oldP != null && newP != null && oldP % 2 !== newP % 2) {
    warning = `${student.name || ''}: 반번호 끝자리 홀짝(A/B)이 바뀌어 내신 자동매핑이 달라질 수 있음`;
  }

  return { updatedEnrollments, before, after, skipped: false, warning };
}
