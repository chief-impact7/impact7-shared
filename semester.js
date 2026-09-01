// impact7 공유 — 학기 해석 SSoT.
//
// semester_settings 문서 키는 `${학부}-${연도}-${이름소문자}` 형식이다.
// 표기 변환과 기간 겹침을 여기서만 계산한다 — impact7DB·DSC·Demion이 같은 답을 쓴다.

import { addDays } from './datetime.js';

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

export function semesterPool(level, semesterSettings) {
  if (!level) return [];
  return Object.entries(semesterSettings || {})
    .filter(([key, value]) => key.startsWith(`${level}-`) && value?.start_date)
    .sort((a, b) => a[1].start_date.localeCompare(b[1].start_date))
    .map(([key]) => semesterFromSettingsKey(key));
}

export function semesterRange(level, semester, semesterSettings) {
  const semesters = semesterPool(level, semesterSettings);
  const index = semesters.indexOf(semester);
  if (index < 0) return null;
  const start = semesterSettings[settingsKeyFromSemester(level, semester)]?.start_date;
  if (!start) return null;
  const next = semesters[index + 1];
  const nextStart = next && semesterSettings[settingsKeyFromSemester(level, next)]?.start_date;
  return { start, end: nextStart ? addDays(nextStart, -1) : null };
}

export function enrollmentInSemester(enrollment, { level, semester, semesterSettings }) {
  const range = semesterRange(level, semester, semesterSettings);
  if (!range) return false;
  return (!enrollment?.start_date || !range.end || enrollment.start_date <= range.end)
    && (!enrollment?.end_date || enrollment.end_date >= range.start);
}

export function semestersForEnrollment(enrollment, { level, semesterSettings }) {
  return semesterPool(level, semesterSettings)
    .filter(semester => enrollmentInSemester(enrollment, { level, semester, semesterSettings }));
}
