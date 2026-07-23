// expected-arrival.js — 학생 당일 등원 예정 시각 계산 (단일 소스).
// DSC(대시보드)와 태블릿 서버(지각 판정)가 동일 로직을 공유한다. 순수 함수 — Firestore 로드는 호출자 담당.
import { enrollmentCode, applyNaesinFreeDerivation } from './enrollment-derivation.js';
import { classSettingsGet } from './class-code.js';
import { activeEnrollmentsAt } from './enrollment-status.js';

// 'YYYY-MM-DD' → 한글 요일. TZ 무관(getUTCDay). 서버(UTC)·브라우저(KST) 모두 동일 결과.
// 실존하지 않는 날짜('2026-02-30')는 rollover하지 않고 '' 반환.
export function getDayName(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  if (!m) return '';
  const [y, mo, day] = m.slice(1).map(Number);
  const d = new Date(Date.UTC(y, mo - 1, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== day) return '';
  return ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
}

// enrollment.day(문자열/배열) → 요일 배열. '요일' 접미·구분자(, · 공백) 제거.
export function normalizedDays(day) {
  if (!day) return [];
  const arr = Array.isArray(day) ? day.map(String) : String(day).split(/[,·\s]+/);
  return arr.map((d) => d.replace('요일', '').trim()).filter(Boolean);
}

// 내신 csKey: naesin_class_override(빈 문자열이면 제외). 순수 — student 불필요.
export function resolveNaesinCsKey(regularEnroll) {
  const override = regularEnroll?.naesin_class_override;
  if (typeof override !== 'string' || override === '') return null;
  return override;
}

// enrollment 하나의 오늘(dayName) 시작 시각. 반코드 표기 차이는 classSettingsGet이 흡수.
export function startTime(enrollment, dayName, classSettings) {
  const c = classSettingsGet(classSettings, enrollmentCode(enrollment));
  const scheduledTime = enrollment?.schedule?.[dayName];
  const classTime = enrollment?.class_type === '자유학기'
    ? c?.free_schedule?.[dayName]
    : c?.schedule?.[dayName];
  if (enrollment?.class_type === '자유학기') {
    return classTime || scheduledTime || enrollment?.start_time || enrollment?.time || c?.default_time || '';
  }
  if (enrollment?.class_type === '정규') {
    return scheduledTime || enrollment?.start_time || enrollment?.time || c?.default_time || classTime || '';
  }
  return scheduledTime || classTime || enrollment?.start_time || enrollment?.time || c?.default_time || '';
}

// 여러 소스(정규 시간표·재시/보충 task·daily action·추가방문·결석보충) 중 가장 이른 'HH:MM'.
// enrollments는 이미 파생·오늘요일 필터를 통과한 배열이어야 한다(computeExpectedArrival이 처리).
// 비교는 분 단위 — '9:30'(한 자리 시)과 '10:00'이 섞여도 사전순이 아닌 시각순으로 고른다.
export function earliestExpectedTime({ enrollments, dayName, classSettings, rec, hwTasks, testTasks, absences, date }) {
  const times = [];
  (enrollments || []).forEach((e) => { const t = startTime(e, dayName, classSettings); if (t) times.push(t); });
  const pushTask = (task) => {
    if (task?.type === '등원' && task.scheduled_date === date && task.scheduled_time) times.push(task.scheduled_time);
  };
  (hwTasks || []).forEach(pushTask);
  (testTasks || []).forEach(pushTask);
  [rec?.hw_fail_action, rec?.test_fail_action].forEach((actionMap) => {
    Object.values(actionMap || {}).forEach(pushTask);
  });
  if (rec?.extra_visit?.date === date && rec.extra_visit.time) times.push(rec.extra_visit.time);
  (absences || []).forEach((a) => {
    if (a?.resolution === '보충' && a.makeup_date === date && a.status !== 'closed'
      && a.makeup_status !== '미등원' && a.makeup_time) times.push(a.makeup_time);
  });
  const byMinutes = (t) => toMinutes(t) ?? Infinity; // 시각 형식이 아닌 값은 뒤로
  return times.sort((a, b) => byMinutes(a) - byMinutes(b))[0] || '';
}

// 원본 student.enrollments + 데이터 소스 → 예정 시각. 날짜필터→내신/자유학기 파생→오늘요일 필터 후 earliest.
export function computeExpectedArrival({ enrollments, classSettings, rec, hwTasks, testTasks, absences, date }) {
  const dayName = getDayName(date);
  const cs = classSettings || {};
  const current = activeEnrollmentsAt((enrollments || []).filter(Boolean), date);
  const derived = applyNaesinFreeDerivation(current, {
    classSettings: cs, dateStr: date, resolveNaesinCsKey, enrollmentCode,
  });
  const todayEnrolls = derived.filter((e) => normalizedDays(e.day).includes(dayName));
  return earliestExpectedTime({
    enrollments: todayEnrolls, dayName, classSettings: cs, rec: rec || {},
    hwTasks: hwTasks || [], testTasks: testTasks || [], absences: absences || [], date,
  });
}

// 'HH:MM' → 분. 파싱 실패 시 null.
function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// 등원 시각이 예정+유예(기본 5분)를 초과하면 지각. 예정 없으면 false.
// 계약: 두 시각은 같은 날로 비교한다. 자정 넘김 판정은 시각만으로 방향 구분이 불가능하고
// (DSC는 isLate(현재시각, 예정)로도 호출) 호출자가 businessDay 기준으로 날짜를 짝지어야 한다.
export function isLate(arrivalHHMM, expectedHHMM, graceMin = 5) {
  const a = toMinutes(arrivalHHMM);
  const e = toMinutes(expectedHHMM);
  if (a == null || e == null) return false;
  return a > e + graceMin;
}
