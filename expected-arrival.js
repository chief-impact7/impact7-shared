// expected-arrival.js — 학생 당일 등원 예정 시각 계산 (단일 소스).
// DSC(대시보드)와 태블릿 서버(지각 판정)가 동일 로직을 공유한다. 순수 함수 — Firestore 로드는 호출자 담당.
import { enrollmentCode, applyNaesinFreeDerivation } from './enrollment-derivation.js';

// 'YYYY-MM-DD' → 한글 요일. TZ 무관(getUTCDay). 서버(UTC)·브라우저(KST) 모두 동일 결과.
export function getDayName(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  if (!m) return '';
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return ['일', '월', '화', '수', '목', '금', '토'][dow];
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

const _validDate = (v) => !!v && /^\d{4}-/.test(v);

// enrollment 하나의 오늘(dayName) 시작 시각.
export function startTime(enrollment, dayName, classSettings) {
  const code = enrollmentCode(enrollment);
  const cs = classSettings || {};
  return enrollment?.schedule?.[dayName]
    || (enrollment?.class_type === '자유학기' ? cs[code]?.free_schedule?.[dayName] : '')
    || cs[code]?.schedule?.[dayName]
    || enrollment?.start_time
    || enrollment?.time
    || cs[code]?.default_time
    || '';
}

// 여러 소스(정규 시간표·재시/보충 task·daily action·추가방문·결석보충) 중 가장 이른 'HH:MM'.
// enrollments는 이미 파생·오늘요일 필터를 통과한 배열이어야 한다(computeExpectedArrival이 처리).
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
  return times.sort()[0] || '';
}

// 원본 student.enrollments + 데이터 소스 → 예정 시각. 날짜필터→내신/자유학기 파생→오늘요일 필터 후 earliest.
export function computeExpectedArrival({ enrollments, classSettings, rec, hwTasks, testTasks, absences, date }) {
  const dayName = getDayName(date);
  const cs = classSettings || {};
  const current = (enrollments || []).filter((e) => {
    if (_validDate(e.start_date) && e.start_date > date) return false;
    if (_validDate(e.end_date) && e.end_date < date) return false;
    return true;
  });
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
export function isLate(arrivalHHMM, expectedHHMM, graceMin = 5) {
  const a = toMinutes(arrivalHHMM);
  const e = toMinutes(expectedHHMM);
  if (a == null || e == null) return false;
  return a > e + graceMin;
}
