// impact7 공유 — 학기 해석 SSoT.
//
// 두 표기가 공존한다.
//   semester_settings 문서 키 : `${학부}-${연도}-${이름소문자}` (예: '중등-2026-summer')
//   enrollment.semester      : `${연도}-${이름대문자}`         (예: '2026-Summer')
// 표기 변환과 "이 날짜의 학기"를 여기서만 계산한다 — impact7DB·DSC·Demion이 같은 답을 쓴다.

import { addDays } from './datetime.js';
import { accountTypeOf } from './enrollment-status.js';
import { enrollmentCode } from './enrollment-derivation.js';

const isRegular = (e) =>
  accountTypeOf(e) === '정규' && (e.class_type || '정규') === '정규';

export function semesterFromSettingsKey(key) {
  const m = String(key || '').match(/^(?:[^-]+-)?(\d{4})-(.+)$/);
  if (!m) return '';
  const [, year, name] = m;
  return `${year}-${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

export function settingsKeyFromSemester(level, semester) {
  const m = String(semester || '').match(/^(\d{4})-(.+)$/);
  if (!m || !level) return '';
  return `${level}-${m[1]}-${m[2].toLowerCase()}`;
}

// 기준일에 유효한 학부 학기 = 시작일이 기준일 이하인 것 중 가장 늦게 시작한 것.
// 반환: { key, semester, startDate } | null
export function resolveSemesterAt(level, dateStr, semesterSettings) {
  if (!level || !dateStr) return null;
  const entries = Object.entries(semesterSettings || {})
    .filter(([key, value]) =>
      key.startsWith(`${level}-`) && value?.start_date && value.start_date <= dateStr)
    .sort((a, b) => a[1].start_date.localeCompare(b[1].start_date));
  const latest = entries[entries.length - 1];
  if (!latest) return null;
  return { key: latest[0], semester: semesterFromSettingsKey(latest[0]), startDate: latest[1].start_date };
}

// 학기 롤오버 SSoT — 학기 시작일이 지나면 다니던 학생도 새 학기를 부여받는다.
// 없으면 등록 시점에 박힌 학기가 그대로 남아 학기 필터에서 지난 학기에 갇힌다(2026-09-01 김예은 건).
// - 이번 학기 안에서 시작한 조각: semester만 교체
// - 지난 학기부터 이어지는 조각: 학기 시작 전날로 닫고 새 학기 조각을 연다(반이동과 같은 2단 구성 —
//   지난 학기 명단 조회가 옛 조각으로 보존된다)
// 대상은 정규수업(정규계열 + class_type 정규)뿐. 내신·자유학기·특강·기타는 학기 축이 다르다.
export function applySemesterRollover(enrollments, { semester, semesterStartDate, today }) {
  const list = Array.isArray(enrollments) ? enrollments : [];
  if (!semester || !semesterStartDate || !today) return { updatedEnrollments: list, changes: [] };

  const changes = [];
  const updated = list.flatMap((e, index) => {
    if (!isRegular(e) || (e.semester || '') === semester) return [e];
    const started = e.start_date || '';
    const ended = e.end_date || '';
    if (started && started > today) return [e];   // 미래 예약 — 활성이 되는 날 잡는다
    if (ended && ended < today) return [e];       // 이미 닫힌 조각 — 지난 학기 이력이라 보존
    const label = `#${index} ${enrollmentCode(e) || '(반없음)'} ${e.semester || '(없음)'}`;
    if (!started || started >= semesterStartDate) {
      changes.push(`${label}→${semester}`);
      return [{ ...e, semester }];
    }
    changes.push(`${label}→${semester} (${semesterStartDate} 분할)`);
    return [
      { ...e, end_date: addDays(semesterStartDate, -1) },
      { ...e, semester, start_date: semesterStartDate },
    ];
  });

  return { updatedEnrollments: changes.length ? updated : list, changes };
}
