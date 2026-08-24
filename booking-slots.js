const WEEKDAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const SLOT_SETTINGS_DEFAULTS = Object.freeze({
  weekdayTimes: Object.freeze({}),
  leadDays: 1,
  blockHolidays: true,
  blockedMessage: '{reason}은 별도로 문의해 주세요.',
  periods: Object.freeze([]),
});

const text = (value) => String(value ?? '').trim();

function normalizeTimes(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(text).filter(Boolean))];
}

// 호출자가 KST 오늘을 문자열로 넣으므로 모든 비교는 UTC 자정 문자열로 맞춘다.
function utcDate(dateText) {
  const [year, month, day] = dateText.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const isoOf = (date) => date.toISOString().slice(0, 10);

function isIsoDate(value) {
  return ISO_DATE.test(value) && isoOf(utcDate(value)) === value;
}

function normalizePeriod(value) {
  const startDate = text(value?.startDate);
  const endDate = text(value?.endDate);
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return null;
  if (endDate < startDate) return null;
  return { startDate, endDate, label: text(value?.label) };
}

export function normalizeSlotSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const weekdayTimes = {};
  for (let day = 0; day <= 6; day += 1) {
    const times = normalizeTimes(source.weekdayTimes?.[day] ?? source.weekdayTimes?.[String(day)]);
    if (times.length) weekdayTimes[String(day)] = times;
  }

  const leadDaysRaw = Number(source.leadDays);
  return {
    weekdayTimes,
    leadDays: Number.isFinite(leadDaysRaw) ? Math.max(0, Math.floor(leadDaysRaw)) : SLOT_SETTINGS_DEFAULTS.leadDays,
    blockHolidays: source.blockHolidays === undefined ? SLOT_SETTINGS_DEFAULTS.blockHolidays : Boolean(source.blockHolidays),
    blockedMessage: text(source.blockedMessage) || SLOT_SETTINGS_DEFAULTS.blockedMessage,
    periods: (Array.isArray(source.periods) ? source.periods : []).map(normalizePeriod).filter(Boolean),
  };
}

export function firstBookableDate(today, settings) {
  const normalized = normalizeSlotSettings(settings);
  const base = text(today);
  if (!isIsoDate(base)) return '';
  const date = utcDate(base);
  date.setUTCDate(date.getUTCDate() + normalized.leadDays);
  return isoOf(date);
}

function leadReason(leadDays) {
  return leadDays <= 1 ? '당일' : `${leadDays}일 이내`;
}

export function slotAvailability({ date, today, holidayName, settings } = {}) {
  const normalized = normalizeSlotSettings(settings);
  const blocked = (reason) => ({
    times: [],
    blocked: true,
    reason,
    message: reason ? normalized.blockedMessage.replace('{reason}', reason) : '',
    periodLabel: '',
  });

  const value = text(date);
  if (!isIsoDate(value)) return blocked('');

  if (normalized.blockHolidays && text(holidayName)) return blocked(text(holidayName));

  const day = utcDate(value).getUTCDay();
  const times = normalized.weekdayTimes[String(day)] ?? [];
  if (!times.length) return blocked(WEEKDAY_NAMES[day]);

  const todayValue = text(today);
  if (!isIsoDate(todayValue)) return blocked('');

  const earliest = firstBookableDate(todayValue, normalized);
  if (earliest && value < earliest) return blocked(leadReason(normalized.leadDays));

  const period = normalized.periods.find((p) => p.startDate <= value && value <= p.endDate);
  return {
    times,
    blocked: false,
    reason: '',
    message: times.join(', '),
    periodLabel: period?.label ?? '',
  };
}
