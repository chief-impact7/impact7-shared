import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLOT_SETTINGS_DEFAULTS,
  normalizeSlotSettings,
  slotAvailability,
  firstBookableDate,
} from './booking-slots.js';

const WEEKDAY = ['3:00 ~ 4:20', '5:00 ~ 6:20', '7:00 ~ 8:20'];
const SATURDAY = ['12:30 ~ 1:50', '2:30 ~ 3:50', '4:30 ~ 5:50'];
const SETTINGS = normalizeSlotSettings({
  weekdayTimes: { 0: [], 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: SATURDAY },
  leadDays: 1,
  blockHolidays: true,
  blockedMessage: '{reason}은 별도로 문의해 주세요.',
  periods: [{ startDate: '2026-07-11', endDate: '2026-07-15', label: '여름학기 무료진단평가 기간' }],
});

describe('normalizeSlotSettings', () => {
  it('빈 입력은 기본값', () => {
    assert.deepEqual(normalizeSlotSettings(undefined), SLOT_SETTINGS_DEFAULTS);
  });

  it('요일 키를 문자열 0~6으로 통일하고 그 밖의 키는 버린다', () => {
    const s = normalizeSlotSettings({ weekdayTimes: { 1: ['3:00'], 9: ['x'], mon: ['y'] } });
    assert.deepEqual(Object.keys(s.weekdayTimes), ['1']);
  });

  it('시간 목록의 공백을 다듬고 빈 값과 중복을 버린다', () => {
    const s = normalizeSlotSettings({ weekdayTimes: { 6: ['  12:30 ~ 1:50 ', '', '12:30 ~ 1:50'] } });
    assert.deepEqual(s.weekdayTimes['6'], ['12:30 ~ 1:50']);
  });

  it('leadDays는 음수를 0으로 내린다', () => {
    assert.equal(normalizeSlotSettings({ leadDays: -3 }).leadDays, 0);
  });

  it('기간은 날짜 형식이 맞는 것만 남긴다', () => {
    const s = normalizeSlotSettings({ periods: [
      { startDate: '2026-07-11', endDate: '2026-07-15', label: 'ok' },
      { startDate: '엉망', endDate: '2026-07-15', label: 'no' },
    ]});
    assert.equal(s.periods.length, 1);
    assert.equal(s.periods[0].label, 'ok');
  });

  it('기간은 rollover되는 불가능한 날짜를 버린다', () => {
    const s = normalizeSlotSettings({ periods: [
      { startDate: '2026-07-11', endDate: '2026-07-15', label: 'ok' },
      { startDate: '2026-02-30', endDate: '2026-03-02', label: 'no' },
    ]});
    assert.equal(s.periods.length, 1);
    assert.equal(s.periods[0].label, 'ok');
  });

  it('멱등 — 자기 출력을 다시 넣어도 같다', () => {
    assert.deepEqual(normalizeSlotSettings(SETTINGS), SETTINGS);
  });
});

describe('slotAvailability 차단 순서', () => {
  it('날짜 형식이 아니면 차단하고 사유는 비운다', () => {
    const r = slotAvailability({ date: '2026-8-1', today: '2026-08-24', holidayName: '', settings: SETTINGS });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, '');
    assert.deepEqual(r.times, []);
  });

  it('rollover되는 불가능한 날짜면 차단하고 사유는 비운다', () => {
    const r = slotAvailability({ date: '2026-02-30', today: '2026-02-25', holidayName: '', settings: SETTINGS });
    assert.deepEqual(r, { blocked: true, times: [], reason: '', message: '', periodLabel: '' });
  });

  it('공휴일이 요일·리드타임보다 먼저다', () => {
    // 2026-09-25는 금요일이고 미래지만 추석이다
    const r = slotAvailability({ date: '2026-09-25', today: '2026-08-24', holidayName: '추석', settings: SETTINGS });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, '추석');
    assert.equal(r.message, '추석은 별도로 문의해 주세요.');
  });

  it('blockHolidays가 꺼져 있으면 공휴일도 연다', () => {
    const open = normalizeSlotSettings({ ...SETTINGS, blockHolidays: false });
    const r = slotAvailability({ date: '2026-09-25', today: '2026-08-24', holidayName: '추석', settings: open });
    assert.equal(r.blocked, false);
    assert.deepEqual(r.times, WEEKDAY);
  });

  it('시간 목록이 빈 요일은 요일 이름을 사유로 차단한다', () => {
    // 2026-08-30은 일요일
    const r = slotAvailability({ date: '2026-08-30', today: '2026-08-24', holidayName: '', settings: SETTINGS });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, '일요일');
    assert.equal(r.message, '일요일은 별도로 문의해 주세요.');
  });

  it('leadDays 1이면 당일은 막고 다음 날은 연다', () => {
    // 2026-08-25 화요일
    const same = slotAvailability({ date: '2026-08-25', today: '2026-08-25', holidayName: '', settings: SETTINGS });
    assert.equal(same.blocked, true);
    assert.equal(same.reason, '당일');
    const next = slotAvailability({ date: '2026-08-26', today: '2026-08-25', holidayName: '', settings: SETTINGS });
    assert.equal(next.blocked, false);
  });

  it('today 형식이 아니면 리드타임을 조용히 건너뛰지 않고 차단한다', () => {
    const r = slotAvailability({ date: '2026-08-26', today: '2026-8-25', holidayName: '', settings: SETTINGS });
    assert.deepEqual(r, { blocked: true, times: [], reason: '', message: '', periodLabel: '' });
  });

  it('today가 rollover되는 불가능한 날짜면 차단한다', () => {
    const r = slotAvailability({ date: '2026-03-04', today: '2026-02-30', holidayName: '', settings: SETTINGS });
    assert.deepEqual(r, { blocked: true, times: [], reason: '', message: '', periodLabel: '' });
  });

  it('지난 날짜도 리드타임으로 막힌다', () => {
    const r = slotAvailability({ date: '2026-08-20', today: '2026-08-25', holidayName: '', settings: SETTINGS });
    assert.equal(r.blocked, true);
    assert.equal(r.reason, '당일');
  });

  it('leadDays 3이면 사유가 3일 이내다', () => {
    const s = normalizeSlotSettings({ ...SETTINGS, leadDays: 3 });
    const r = slotAvailability({ date: '2026-08-26', today: '2026-08-25', holidayName: '', settings: s });
    assert.equal(r.reason, '3일 이내');
  });

  it('leadDays 0이면 당일도 연다', () => {
    const s = normalizeSlotSettings({ ...SETTINGS, leadDays: 0 });
    const r = slotAvailability({ date: '2026-08-25', today: '2026-08-25', holidayName: '', settings: s });
    assert.equal(r.blocked, false);
  });
});

describe('slotAvailability 통과', () => {
  it('평일은 평일 목록, 토요일은 토요일 목록', () => {
    // 2026-08-26 수요일, 2026-08-29 토요일
    assert.deepEqual(
      slotAvailability({ date: '2026-08-26', today: '2026-08-24', holidayName: '', settings: SETTINGS }).times,
      WEEKDAY,
    );
    assert.deepEqual(
      slotAvailability({ date: '2026-08-29', today: '2026-08-24', holidayName: '', settings: SETTINGS }).times,
      SATURDAY,
    );
  });

  it('기간에 들면 배지 라벨을 낸다', () => {
    // 2026-07-13 월요일 — 무료 기간 안. today를 그 전으로 둔다.
    const r = slotAvailability({ date: '2026-07-13', today: '2026-07-01', holidayName: '', settings: SETTINGS });
    assert.equal(r.periodLabel, '여름학기 무료진단평가 기간');
  });

  it('기간 밖이면 배지가 비어 있다', () => {
    const r = slotAvailability({ date: '2026-08-26', today: '2026-08-24', holidayName: '', settings: SETTINGS });
    assert.equal(r.periodLabel, '');
  });

  it('차단된 날짜는 배지를 내지 않는다', () => {
    const r = slotAvailability({ date: '2026-07-12', today: '2026-07-01', holidayName: '', settings: SETTINGS });
    assert.equal(r.blocked, true);   // 일요일
    assert.equal(r.periodLabel, '');
  });

  it('통과한 날의 message는 시간 목록을 담는다', () => {
    const r = slotAvailability({ date: '2026-08-29', today: '2026-08-24', holidayName: '', settings: SETTINGS });
    assert.ok(r.message.includes('12:30 ~ 1:50'));
  });
});

describe('firstBookableDate', () => {
  it('leadDays만큼 민 날짜를 낸다', () => {
    assert.equal(firstBookableDate('2026-08-25', SETTINGS), '2026-08-26');
  });

  it('월말을 넘긴다', () => {
    assert.equal(firstBookableDate('2026-08-31', SETTINGS), '2026-09-01');
  });

  it('leadDays 0이면 오늘', () => {
    assert.equal(firstBookableDate('2026-08-25', normalizeSlotSettings({ leadDays: 0 })), '2026-08-25');
  });

  it('today가 rollover되는 불가능한 날짜면 비운다', () => {
    assert.equal(firstBookableDate('2026-02-30', SETTINGS), '');
  });
});
