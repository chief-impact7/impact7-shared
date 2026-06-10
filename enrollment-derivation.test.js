import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyNaesinFreeDerivation, enrollmentCode as sharedEnrollmentCode } from './enrollment-derivation.js';

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
