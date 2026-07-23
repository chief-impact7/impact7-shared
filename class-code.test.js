import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeClassCode, classSettingsGet, classSettingsAccountType,
  isSelectableAccountClass, selectableAccountClassCodes,
  accountClassParts, validateExistingAccountClass,
} from './class-code.js';

test('소문자·혼용 코드는 대문자로', () => {
  assert.equal(normalizeClassCode('ks132'), 'KS132');
  assert.equal(normalizeClassCode('Ks132'), 'KS132');
  assert.equal(normalizeClassCode('KS132'), 'KS132');
});

test('한글 코드·공백·빈값', () => {
  assert.equal(normalizeClassCode('특강301'), '특강301');
  assert.equal(normalizeClassCode('  ha101  '), 'HA101');
  assert.equal(normalizeClassCode(''), '');
  assert.equal(normalizeClassCode(null), '');
  assert.equal(normalizeClassCode(undefined), '');
  assert.equal(normalizeClassCode(123), '');
});

test('classSettingsGet: 정확 일치 → 정규화 일치 → 설정 키 비정규 표기 순으로 흡수', () => {
  const cs = { HA101: { schedule: 'A' }, hb202: { schedule: 'B' } };
  assert.equal(classSettingsGet(cs, 'HA101')?.schedule, 'A'); // 정확 일치
  assert.equal(classSettingsGet(cs, 'ha101')?.schedule, 'A'); // 조회 키가 소문자
  assert.equal(classSettingsGet(cs, 'HB202')?.schedule, 'B'); // 설정 키가 소문자
  assert.equal(classSettingsGet(cs, '2단지내신'), undefined);  // 미존재
  assert.equal(classSettingsGet(cs, ''), undefined);
  assert.equal(classSettingsGet(null, 'HA101'), undefined);
});

const accountSettings = {
  HA101: { class_type: '정규' },
  I201: {},
  수요특강: { class_type: '특강' },
  기타A: { class_type: '기타' },
  명시기타: { account_type: '기타', class_type: '정규' },
  내신A: { class_type: '내신' },
};

test('classSettingsAccountType: 명시 계정 유형 우선, 레거시 기타 파생, 미지 유형 차단', () => {
  assert.equal(classSettingsAccountType(accountSettings.명시기타), '기타');
  assert.equal(classSettingsAccountType(accountSettings.수요특강), '특강');
  assert.equal(classSettingsAccountType(accountSettings.기타A), '기타');
  assert.equal(classSettingsAccountType(accountSettings.I201), '정규');
  assert.equal(classSettingsAccountType(accountSettings.내신A), null);
  assert.equal(classSettingsAccountType(null), null);
});

test('계정 유형과 같은 class_settings 코드만 정렬해 선택', () => {
  assert.equal(isSelectableAccountClass('기타', accountSettings.기타A), true);
  assert.equal(isSelectableAccountClass('정규', accountSettings.기타A), false);
  assert.deepEqual(selectableAccountClassCodes(accountSettings, '정규'), ['HA101', 'I201']);
  assert.deepEqual(selectableAccountClassCodes(accountSettings, '특강'), ['수요특강']);
  assert.deepEqual(selectableAccountClassCodes(accountSettings, '기타'), ['기타A', '명시기타']);
});

test('정규 코드는 문자+숫자로, 특강·기타는 전체 코드를 class_number로 분해', () => {
  assert.deepEqual(accountClassParts('정규', 'HA101'), { levelSymbol: 'HA', classNumber: '101' });
  assert.deepEqual(accountClassParts('정규', '  ha101  '), { levelSymbol: 'HA', classNumber: '101' });
  assert.deepEqual(accountClassParts('특강', '수요특강'), { levelSymbol: '', classNumber: '수요특강' });
  assert.deepEqual(accountClassParts('기타', '기타A'), { levelSymbol: '', classNumber: '기타A' });
  assert.deepEqual(accountClassParts('정규', '101'), { levelSymbol: '', classNumber: '' });
});

test('기존 반 검증은 미선택·유형 불일치·변환 불가를 한국어로 거부', () => {
  assert.equal(validateExistingAccountClass(accountSettings, '기타', '기타A'), null);
  assert.match(validateExistingAccountClass(accountSettings, '기타', ''), /선택하세요/);
  assert.match(validateExistingAccountClass(accountSettings, '기타', 'HA101'), /반 생성 마법사/);
  assert.match(validateExistingAccountClass({ HA: {} }, '정규', 'HA'), /변환할 수 없습니다/);
});
