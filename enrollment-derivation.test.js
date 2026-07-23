import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNaesinFreeDerivation, deriveActiveNaesinEnrollment,
  isNaesinActiveAt, enrollmentCode as sharedEnrollmentCode,
} from './enrollment-derivation.js';

test('enrollmentCode: level_symbol+class_number 결합', () => {
  assert.equal(sharedEnrollmentCode({ level_symbol: 'HA', class_number: '101' }), 'HA101');
  assert.equal(sharedEnrollmentCode({ class_number: '101' }), '101');
  assert.equal(sharedEnrollmentCode({}), '');
});

test('enrollmentCode 옵션 생략 시 기본 export로 자유학기 파생', () => {
  const cs = { HA101: { free_start: '2026-05-01', free_end: '2026-12-31', free_schedule: { 월: [] } } };
  const current = [{ class_type: '정규', level_symbol: 'HA', class_number: '101' }];
  const out = applyNaesinFreeDerivation(current, {
    classSettings: cs, dateStr: '2026-05-28', resolveNaesinCsKey: () => null,
  });
  assert.equal(out[0].class_type, '자유학기');
});

const enrollmentCode = (e) => `${e.level_symbol || ''}${e.class_number || ''}`;
// override-only resolver (DB식). 빈 문자열('')은 명시적 배제 → null.
const resolveOverride = (re) =>
  typeof re.naesin_class_override === 'string' ? (re.naesin_class_override || null) : null;

const deps = (classSettings, dateStr = '2026-05-28') => ({
  classSettings, dateStr, resolveNaesinCsKey: resolveOverride, enrollmentCode,
});

const reg = (over) => ({ class_type: '정규', level_symbol: 'HX', class_number: '104', day: ['화', '목'], start_date: '2026-05-20', naesin_class_override: over });

test('정규+override + 활성 내신기간 → 내신으로 파생, 정규 숨김', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-05-14', naesin_end: '2026-07-03', schedule: { '화': '17:00', '목': '17:00' } } };
  const out = applyNaesinFreeDerivation([reg('2단지선유고2B')], deps(cs));
  assert.equal(out.length, 1);
  assert.equal(out[0].class_type, '내신');
  assert.equal(out[0].class_number, '2단지선유고2B');
  assert.deepEqual(out[0].day, ['화', '목']);
});

test('학생 개별 naesin_days → 합성 내신 day가 반 스케줄 대신 개별 요일', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-05-14', naesin_end: '2026-07-03', schedule: { '화': '17:00', '목': '17:00' } } };
  const regular = { ...reg('2단지선유고2B'), naesin_days: ['월', '수', '토'] };
  const out = applyNaesinFreeDerivation([regular], deps(cs));
  assert.deepEqual(out[0].day, ['월', '수', '토']);
});

test('학생 개별 naesin_schedule → 합성 내신 schedule이 반 기본 위에 병합', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-05-14', naesin_end: '2026-07-03', schedule: { '화': '17:00', '목': '17:00' } } };
  const regular = { ...reg('2단지선유고2B'), naesin_days: ['화', '토'], naesin_schedule: { '토': '14:00' } };
  const out = applyNaesinFreeDerivation([regular], deps(cs));
  assert.deepEqual(out[0].schedule, { '화': '17:00', '목': '17:00', '토': '14:00' });
  assert.deepEqual(out[0].day, ['화', '토']);
});

test('naesin_days 빈 배열 → 반 스케줄 요일 유지 (개별 미설정 취급)', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-05-14', naesin_end: '2026-07-03', schedule: { '화': '17:00' } } };
  const out = applyNaesinFreeDerivation([{ ...reg('2단지선유고2B'), naesin_days: [] }], deps(cs));
  assert.deepEqual(out[0].day, ['화']);
});

test('명시적 내신 enrollment → 그대로 내신, 정규 숨김', () => {
  const naesin = { class_type: '내신', class_number: '', day: ['목', '월'], start_date: '2026-05-15', end_date: '2026-07-03' };
  const out = applyNaesinFreeDerivation([reg(undefined), naesin], deps({}));
  assert.equal(out.length, 1);
  assert.equal(out[0].class_type, '내신');
});

test('override 있으나 내신기간 비활성 → 정규 그대로 (파생 안 함)', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-08-01', naesin_end: '2026-08-31', schedule: {} } };
  const out = applyNaesinFreeDerivation([reg('2단지선유고2B')], deps(cs));
  assert.equal(out.length, 1);
  assert.equal(out[0].class_type, '정규');
});

test('class_settings에 내신기간 없음 → 정규 그대로', () => {
  const out = applyNaesinFreeDerivation([reg('2단지선유고2B')], deps({ '2단지선유고2B': {} }));
  assert.equal(out[0].class_type, '정규');
});

test('override가 빈 문자열(명시적 배제) → 정규 그대로', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-05-14', naesin_end: '2026-07-03', schedule: {} } };
  const out = applyNaesinFreeDerivation([reg('')], deps(cs));
  assert.equal(out[0].class_type, '정규');
});

test('자유학기 활성기간 → 자유학기로 파생, 정규 숨김', () => {
  const cs = { 'HX104': { free_start: '2026-05-01', free_end: '2026-06-30', free_schedule: { '월': '16:00' } } };
  const out = applyNaesinFreeDerivation([reg(undefined)], deps(cs));
  assert.equal(out.length, 1);
  assert.equal(out[0].class_type, '자유학기');
  assert.equal(out[0].class_number, '104');
});

test('계정별 내신·자유학기 파생은 다른 정규 계정을 숨기지 않고 계정 필드를 복사', () => {
  const current = [
    {
      ...reg('NAESIN-A'), account_id: 'regular-a', account_type: '정규',
    },
    {
      class_type: '정규', level_symbol: 'KS', class_number: '132',
      account_id: 'regular-b', account_type: '정규',
    },
  ];
  const cs = {
    'NAESIN-A': {
      naesin_start: '2026-05-01', naesin_end: '2026-06-30', schedule: { 화: '17:00' },
    },
    'KS132': {
      free_start: '2026-05-01', free_end: '2026-06-30', free_schedule: { 수: '16:00' },
    },
  };

  const activeNaesin = deriveActiveNaesinEnrollment([current[0]], deps(cs));
  assert.equal(activeNaesin.account_id, 'regular-a');
  assert.equal(activeNaesin.account_type, '정규');

  const out = applyNaesinFreeDerivation(current, deps(cs));
  assert.deepEqual(
    out.map(e => [e.class_type, e.account_id, e.account_type]),
    [['내신', 'regular-a', '정규'], ['자유학기', 'regular-b', '정규']],
  );
});

test('파생이 없으면 계정 그룹이 교차해도 입력 순서를 보존', () => {
  const current = [
    { account_id: 'a', account_type: '정규', class_type: '정규', class_number: '101' },
    { account_id: 'b', account_type: '정규', class_type: '정규', class_number: '201' },
    { account_id: 'a', account_type: '정규', class_type: '내신', class_number: '내신A' },
  ];
  assert.deepEqual(applyNaesinFreeDerivation(current, deps({})), current);
});

test('내신이 자유학기보다 우선', () => {
  const cs = {
    '2단지선유고2B': { naesin_start: '2026-05-14', naesin_end: '2026-07-03', schedule: { '화': '17:00' } },
    'HX104': { free_start: '2026-05-01', free_end: '2026-06-30', free_schedule: { '월': '16:00' } },
  };
  const out = applyNaesinFreeDerivation([reg('2단지선유고2B')], deps(cs));
  assert.equal(out[0].class_type, '내신');
});

test('정규 없음 → 입력 그대로', () => {
  const special = { class_type: '특강', class_number: 'S1', day: ['토'] };
  const out = applyNaesinFreeDerivation([special], deps({}));
  assert.deepEqual(out, [special]);
});

import { deriveClassPeriodHistory } from './enrollment-derivation.js';
const ec = (e) => `${e.level_symbol || ''}${e.class_number || ''}`;

test('deriveClassPeriodHistory 옵션 생략 시 기본 export로 자유학기 기간 파생', () => {
  const cs = { HA101: { free_start: '2026-05-01', free_end: '2026-12-31' } };
  const entries = deriveClassPeriodHistory(
    [{ class_type: '정규', level_symbol: 'HA', class_number: '101' }], cs);
  assert.deepEqual(entries, [{ class_type: '자유학기', code: 'HA101', start_date: '2026-05-01', end_date: '2026-12-31' }]);
});

test('수업이력 파생: 정규+override(명시적 내신 없음) → 내신 항목', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-05-14', naesin_end: '2026-07-03' } };
  const enr = [{ class_type: '정규', level_symbol: 'HX', class_number: '104', naesin_class_override: '2단지선유고2B' }];
  const out = deriveClassPeriodHistory(enr, cs, { enrollmentCode: ec });
  assert.equal(out.length, 1);
  assert.equal(out[0].class_type, '내신');
  assert.equal(out[0].code, '2단지선유고2B');
  assert.equal(out[0].start_date, '2026-05-14');
});

test('수업이력 파생: 명시적 내신 enrollment 있으면 override 파생 안 함 (중복 방지)', () => {
  const cs = { '2단지선유고1B': { naesin_start: '2026-05-14', naesin_end: '2026-07-03' } };
  const enr = [
    { class_type: '정규', level_symbol: 'HX', class_number: '101', naesin_class_override: '2단지선유고1B' },
    { class_type: '내신', class_number: '', start_date: '2026-05-15' },
  ];
  const out = deriveClassPeriodHistory(enr, cs, { enrollmentCode: ec });
  assert.equal(out.length, 0);
});

test('수업이력 파생: override 빈 문자열/내신기간 없음 → 파생 안 함', () => {
  const enr = [{ class_type: '정규', level_symbol: 'HX', class_number: '104', naesin_class_override: '' }];
  assert.equal(deriveClassPeriodHistory(enr, {}, { enrollmentCode: ec }).length, 0);
});

test('수업이력 파생: 정규 반에 자유학기 기간 → 자유학기 항목', () => {
  const cs = { 'HX104': { free_start: '2026-05-01', free_end: '2026-06-30' } };
  const enr = [{ class_type: '정규', level_symbol: 'HX', class_number: '104' }];
  const out = deriveClassPeriodHistory(enr, cs, { enrollmentCode: ec });
  assert.equal(out.length, 1);
  assert.equal(out[0].class_type, '자유학기');
  assert.equal(out[0].code, 'HX104');
});

test('수업이력 파생은 명시 기간을 계정별 판정하고 파생 항목에 계정 필드를 전파', () => {
  const enrollments = [
    {
      account_id: 'a', account_type: '정규', class_type: '정규',
      level_symbol: 'HA', class_number: '101', naesin_class_override: '내신A',
    },
    {
      account_id: 'a', account_type: '정규', class_type: '내신',
      class_number: '내신A', start_date: '2026-05-01',
    },
    {
      account_id: 'b', account_type: '정규', class_type: '정규',
      level_symbol: 'HB', class_number: '201', naesin_class_override: '내신B',
    },
  ];
  const classSettings = {
    내신A: { naesin_start: '2026-05-01', naesin_end: '2026-06-30' },
    내신B: { naesin_start: '2026-07-01', naesin_end: '2026-08-31' },
  };
  assert.deepEqual(deriveClassPeriodHistory(enrollments, classSettings), [{
    class_type: '내신',
    code: '내신B',
    start_date: '2026-07-01',
    end_date: '2026-08-31',
    account_id: 'b',
    account_type: '정규',
  }]);
});

// ─── isNaesinActiveAt (boolean predicate, applyNaesinFreeDerivation과 SSoT 공유) ───
test('isNaesinActiveAt: 정규+override + 활성 내신기간 → true', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-05-01', naesin_end: '2026-06-30', schedule: { 화: [], 목: [] } } };
  assert.equal(isNaesinActiveAt([reg('2단지선유고2B')], deps(cs)), true);
});

test('isNaesinActiveAt: 명시적 내신 enrollment → true', () => {
  const naesin = { class_type: '내신', start_date: '2026-05-01', level_symbol: '', class_number: 'X' };
  assert.equal(isNaesinActiveAt([reg(undefined), naesin], deps({})), true);
});

test('isNaesinActiveAt: override 있으나 내신기간 비활성 → false', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-07-01', naesin_end: '2026-08-31', schedule: {} } };
  assert.equal(isNaesinActiveAt([reg('2단지선유고2B')], deps(cs)), false);
});

test('isNaesinActiveAt: override 빈 문자열(명시적 배제) → false', () => {
  const cs = { '': { naesin_start: '2026-05-01', naesin_end: '2026-06-30' } };
  assert.equal(isNaesinActiveAt([reg('')], deps(cs)), false);
});

test('isNaesinActiveAt: override 없는 정규만 → false', () => {
  assert.equal(isNaesinActiveAt([reg(undefined)], deps({})), false);
});

test('isNaesinActiveAt가 applyNaesinFreeDerivation 내신 파생과 항상 일치', () => {
  const cs = { '2단지선유고2B': { naesin_start: '2026-05-01', naesin_end: '2026-06-30', schedule: { 화: [], 목: [] } } };
  const active = isNaesinActiveAt([reg('2단지선유고2B')], deps(cs));
  const derived = applyNaesinFreeDerivation([reg('2단지선유고2B')], deps(cs));
  assert.equal(active, derived[0].class_type === '내신');
});

// ─── 2026-07-05 적대적 리뷰 회귀 (C4) — deriveLevelPeriod 신설 테스트 ───
import { deriveLevelPeriod } from './enrollment-derivation.js';

test('deriveLevelPeriod: 시작 일(day) 미도달 달은 미완료 — 1일 경과는 1개월이 아님', () => {
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2026-01-31' }], '2026-02-01'), { start: '2026-01-31', label: '1일' });
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2026-06-20' }], '2026-07-05'), { start: '2026-06-20', label: '15일' });
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2025-07-31' }], '2026-07-01'), { start: '2025-07-31', label: '11개월' });
});

test('deriveLevelPeriod: 개월·년 라벨 경계', () => {
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2026-01-15' }], '2026-02-15'), { start: '2026-01-15', label: '1개월' });
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2025-07-05' }], '2026-07-05'), { start: '2025-07-05', label: '1년' });
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2025-05-05' }], '2026-07-05'), { start: '2025-05-05', label: '1년 2개월' });
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2024-02-29' }], '2026-02-28'), { start: '2024-02-29', label: '1년 11개월' }); // 윤년 말일
});

test('deriveLevelPeriod: 등원예정·무효 입력', () => {
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2026-08-01' }], '2026-07-05'), { start: '2026-08-01', label: '등원예정' });
  assert.deepEqual(deriveLevelPeriod([], '2026-07-05'), { start: null, label: '—' });
  assert.deepEqual(deriveLevelPeriod([{ start_date: '?' }], '2026-07-05'), { start: null, label: '—' });
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2026-01-01' }], ''), { start: '2026-01-01', label: '—' });
  assert.deepEqual(deriveLevelPeriod([{ start_date: '2026-01-01' }], undefined), { start: '2026-01-01', label: '—' });
});

test('deriveLevelPeriod: 가장 이른 유효 start_date 기준, 2020 이전·형식 불량 제외', () => {
  assert.deepEqual(
    deriveLevelPeriod([{ start_date: '2026-03-01' }, { start_date: '2026-01-15' }, { start_date: '2019-01-01' }, null], '2026-07-05'),
    { start: '2026-01-15', label: '5개월' }
  );
});

// ─── 2026-07-05 리뷰 P3·P4 회귀 ───
test('소문자 반코드 enrollment도 내신·자유학기 파생 성공 (표기 차이 흡수)', () => {
  const cs = { HX104: { free_start: '2026-05-01', free_end: '2026-12-31', free_schedule: { 월: [] } } };
  const current = [{ class_type: '정규', level_symbol: 'hx', class_number: '104' }];
  const out = applyNaesinFreeDerivation(current, {
    classSettings: cs, dateStr: '2026-05-28', resolveNaesinCsKey: () => null,
  });
  assert.equal(out[0].class_type, '자유학기');
});

test('명시적 자유학기의 반코드가 정규와 달라도 정규를 숨김 (헤더 계약)', () => {
  const current = [
    { class_type: '정규', level_symbol: 'HA', class_number: '101' },
    { class_type: '자유학기', level_symbol: 'FR', class_number: '901', start_date: '2026-01-01' },
    { class_type: '특강', class_number: '112' },
  ];
  const out = applyNaesinFreeDerivation(current, {
    classSettings: {}, dateStr: '2026-07-01', resolveNaesinCsKey: () => null,
  });
  assert.deepEqual(out.map(e => e.class_type), ['자유학기', '특강']);
});

test('정규 2개 보유 학생도 자유학기 활성이면 둘 다 숨김 (전량 숨김 계약 고정)', () => {
  const cs = { HX104: { free_start: '2026-05-01', free_end: '2026-12-31', free_schedule: { 월: [] } } };
  const current = [
    { class_type: '정규', level_symbol: 'HX', class_number: '104' },
    { class_type: '정규', level_symbol: 'KS', class_number: '132' },
  ];
  const out = applyNaesinFreeDerivation(current, {
    classSettings: cs, dateStr: '2026-07-01', resolveNaesinCsKey: () => null,
  });
  assert.deepEqual(out.map(e => `${e.class_type}:${e.level_symbol}${e.class_number}`), ['자유학기:HX104']);
});
