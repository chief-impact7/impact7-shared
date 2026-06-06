// impact7 공유 — KST 날짜·시간 표시 포맷 (SSoT)
//
// 타임존은 항상 대한민국 서울(Asia/Seoul), 시간은 12시간제(오전/오후) 고정.
// 입력은 Date·Firestore Timestamp(toDate)·epoch ms·ISO 문자열을 받는다.
// 값이 없거나 잘못되면 빈 문자열.
const TZ = 'Asia/Seoul';

function toDate(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (value && typeof value.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// 시간만: "오후 3:05"
export function formatTimeKST(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleTimeString('ko-KR', {
    timeZone: TZ, hour12: true, hour: 'numeric', minute: '2-digit',
  });
}

// 월·일 + 시간: "6월 7일 오후 3:05" (withYear=true면 연도 포함)
export function formatDateTimeKST(value, options) {
  const { withYear = false } = options ?? {};
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleString('ko-KR', {
    timeZone: TZ, hour12: true,
    ...(withYear ? { year: 'numeric' } : {}),
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// 날짜만: "2026-06-07" (en-CA가 YYYY-MM-DD를 보장)
export function formatDateKST(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  });
}
