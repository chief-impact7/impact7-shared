// impact7 공유 — KST 날짜·시간 표시 포맷 (SSoT)
//
// 타임존은 항상 대한민국 서울(Asia/Seoul), 시간은 12시간제(오전/오후) 고정.
// 입력은 Date·Firestore Timestamp(toDate)·직렬화 POJO({seconds}/{_seconds})·epoch ms·ISO 문자열.
// 값이 없거나 잘못되면 빈 문자열.
const TZ = 'Asia/Seoul';

// 모든 입력 형태(Date·Timestamp·직렬화 POJO·epoch·ISO) → Date | null.
// 이 파일의 포맷터들과 leave-cycles 정렬키가 공유하는 파싱 SSoT.
export function toDate(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (value && typeof value.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  // JSON 직렬화 경유(캐시·API 응답) Timestamp POJO — client는 seconds/nanoseconds,
  // admin은 _seconds/_nanoseconds. 쌍이 모두 있어야 인정 — {seconds}만 있는 duration류 객체 오분류 방지.
  if (value) {
    const sec = typeof value.seconds === 'number' && typeof value.nanoseconds === 'number' ? value.seconds
      : typeof value._seconds === 'number' && typeof value._nanoseconds === 'number' ? value._seconds
      : null;
    if (sec != null) {
      const ns = value.nanoseconds ?? value._nanoseconds;
      const d = new Date(sec * 1000 + Math.floor(ns / 1e6));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Intl.DateTimeFormat 생성은 비싸다(실측 ~180µs) — 렌더 루프 대량 호출 대비 모듈 레벨 캐시.
const _timeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ, hour12: true, hour: 'numeric', minute: '2-digit',
});
const _dateTimeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ, hour12: true, month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
});
const _dateTimeYearFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ, hour12: true, year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
});
const _dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const _hourFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hour12: false, hour: '2-digit',
});

// 시간만: "오후 3:05"
export function formatTimeKST(value) {
  const d = toDate(value);
  if (!d) return '';
  return _timeFmt.format(d);
}

// 월·일 + 시간: "6월 7일 오후 3:05" (withYear=true면 연도 포함)
export function formatDateTimeKST(value, options) {
  const { withYear = false } = options ?? {};
  const d = toDate(value);
  if (!d) return '';
  return (withYear ? _dateTimeYearFmt : _dateTimeFmt).format(d);
}

// 날짜만: "2026-06-07" (en-CA가 YYYY-MM-DD를 보장)
export function formatDateKST(value) {
  const d = toDate(value);
  if (!d) return '';
  return _dateFmt.format(d);
}

// KST 기준 오늘 날짜: "YYYY-MM-DD"
export function todayKST() {
  return formatDateKST(new Date());
}

// "YYYY-MM-DD" 날짜를 ±days 이동: addDays('2026-08-01', -1) → '2026-07-31'.
// 월·년 경계는 UTC 산술로 처리(타임존·DST 무관). 형식이 잘못되면 "".
export function addDays(dateStr, days) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return isNaN(shifted.getTime()) ? '' : shifted.toISOString().slice(0, 10);
}

// KST 근무일(영업일) 날짜: 하루 경계를 06:00으로 본다(당일 06:00 ~ 익일 06:00).
// 익일 00:00~05:59(KST)는 전날 근무일로 귀속한다. 반환 "YYYY-MM-DD", 잘못된 값이면 "".
// 오후 늦게 시작해 자정을 넘겨 근무하는 운영에서 하루가 자정에 쪼개지지 않게 한다.
export function businessDayKST(value = new Date(), cutoffHour = 6) {
  const d = toDate(value);
  if (!d) return '';
  const dateStr = formatDateKST(d); // KST 벽시계 날짜
  const hour = parseInt(_hourFmt.format(d), 10) % 24;
  if (hour >= cutoffHour) return dateStr;
  return addDays(dateStr, -1); // cutoff 이전 → 전날
}
