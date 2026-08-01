import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnrollmentContract } from './enrollment-contract.js';

const regular = (accountId, extra = {}) => ({
  account_id: accountId, account_type: '정규', class_type: '정규',
  level_symbol: 'A', class_number: '101', ...extra,
});
const override = (accountId, classType) => ({
  account_id: accountId, account_type: '정규', class_type: classType,
  level_symbol: 'A', class_number: '101',
});
const special = (accountId) => ({
  account_id: accountId, account_type: '특강', class_type: '특강', level_symbol: 'SP', class_number: '1',
});
const other = (accountId) => ({
  account_id: accountId, account_type: '기타', class_type: '기타', level_symbol: 'ET', class_number: '1',
});

const codes = (result) => result.errors.map(e => e.code);

test('정규 base 없는 내신 단독 → E_REGULAR_BASE', () => {
  const result = validateEnrollmentContract([override('acc1', '내신')], { status: '재원' });
  assert.equal(result.valid, false);
  assert.deepEqual(codes(result), ['E_REGULAR_BASE']);
  assert.equal(result.errors[0].index, 0);
  assert.equal(result.errors[0].message, '내신 수업을 연결할 정규 수강계정이 없습니다.');
});

test('정규 base가 있어도 account_id가 다르면 E_REGULAR_BASE', () => {
  const result = validateEnrollmentContract(
    [regular('acc1'), override('acc2', '내신')],
    { status: '재원' },
  );
  assert.equal(result.valid, false);
  assert.deepEqual(codes(result), ['E_REGULAR_BASE']);
  assert.equal(result.errors[0].index, 1);
});

test('자유학기 + 같은 account_id 정규 base → valid', () => {
  const result = validateEnrollmentContract(
    [regular('acc1'), override('acc1', '자유학기')],
    { status: '재원' },
  );
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('특강 계열에 정규 소분류 → E_CLASS_TYPE', () => {
  const result = validateEnrollmentContract(
    [{ account_id: 'acc1', account_type: '특강', class_type: '정규' }],
    { status: '재원' },
  );
  assert.deepEqual(codes(result), ['E_CLASS_TYPE']);
  assert.equal(result.errors[0].message, '수업계열(특강)과 소분류(정규)의 조합이 올바르지 않습니다.');
});

test('account_type 누락 → E_ACCOUNT_TYPE (내신 시간표 일괄 적용이 만드는 형태)', () => {
  const result = validateEnrollmentContract(
    [{ account_id: 'acc1', class_type: '내신', level_symbol: 'A', class_number: '101' }],
    { status: '재원' },
  );
  assert.deepEqual(codes(result), ['E_ACCOUNT_TYPE']);
});

test('account_id 누락·빈 문자열 → E_ACCOUNT_ID', () => {
  const missing = validateEnrollmentContract(
    [{ account_type: '정규', class_type: '정규' }],
    { status: '재원' },
  );
  assert.deepEqual(codes(missing), ['E_ACCOUNT_ID']);
  const empty = validateEnrollmentContract([regular('')], { status: '재원' });
  assert.deepEqual(codes(empty), ['E_ACCOUNT_ID']);
});

test('특강 3개 동시 보유 → valid (상한 없음)', () => {
  const result = validateEnrollmentContract(
    [special('sp1'), special('sp2'), special('sp3')],
    { status: '재원' },
  );
  assert.equal(result.valid, true);
});

test('기타 4개 동시 보유 → valid (상한 없음)', () => {
  const result = validateEnrollmentContract(
    [other('et1'), other('et2'), other('et3'), other('et4')],
    { status: '재원' },
  );
  assert.equal(result.valid, true);
});

test('7개 조합(정규+내신+자유학기+특강2+기타2) → valid — rules 상한 5에서 거부되던 조합', () => {
  const result = validateEnrollmentContract([
    regular('acc1'),
    override('acc1', '내신'),
    override('acc1', '자유학기'),
    special('sp1'),
    special('sp2'),
    other('et1'),
    other('et2'),
  ], { status: '재원' });
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('퇴원 학생이 정규 enrollment 보유 → E_STATUS', () => {
  const result = validateEnrollmentContract([regular('acc1')], { status: '퇴원' });
  assert.deepEqual(codes(result), ['E_STATUS']);
  assert.equal(result.errors[0].message, '퇴원 상태에서는 기타수업만 보유할 수 있습니다.');
});

test('status 누락 + 정규 enrollment → E_STATUS', () => {
  const result = validateEnrollmentContract([regular('acc1')]);
  assert.deepEqual(codes(result), ['E_STATUS']);
});

test("status '' + 정규 enrollment → E_STATUS", () => {
  const result = validateEnrollmentContract([regular('acc1')], { status: '' });
  assert.deepEqual(codes(result), ['E_STATUS']);
});

test("status '휴원' + 정규 enrollment → E_STATUS", () => {
  const result = validateEnrollmentContract([regular('acc1')], { status: '휴원' });
  assert.deepEqual(codes(result), ['E_STATUS']);
});

test('status 누락 + 기타 enrollment만 → valid', () => {
  const result = validateEnrollmentContract([other('et1')]);
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('class_type 누락 단독 → E_CLASS_TYPE', () => {
  const result = validateEnrollmentContract(
    [{ account_id: 'acc1', account_type: '정규' }],
    { status: '재원' },
  );
  assert.deepEqual(codes(result), ['E_CLASS_TYPE']);
});

test('상담 학생 + 기타 enrollment만 → valid', () => {
  const result = validateEnrollmentContract([other('et1'), other('et2')], { status: '상담' });
  assert.equal(result.valid, true);
});

test('상담 학생 + 빈 배열 → valid', () => {
  assert.deepEqual(validateEnrollmentContract([], { status: '상담' }), { valid: true, errors: [] });
});

test('종강 학생이 특강 보유 → E_STATUS', () => {
  const result = validateEnrollmentContract([special('sp1')], { status: '종강' });
  assert.deepEqual(codes(result), ['E_STATUS']);
});

test('위반 항목마다 index와 함께 누적 보고', () => {
  const result = validateEnrollmentContract([
    regular('acc1'),
    { account_id: 'sp1', account_type: '특강', class_type: '기타' },
    override('acc9', '내신'),
  ], { status: '재원' });
  assert.deepEqual(result.errors.map(e => [e.index, e.code]), [[1, 'E_CLASS_TYPE'], [2, 'E_REGULAR_BASE']]);
});

test('배열 아닌 입력·옵션 생략은 빈 배열로 취급 (배열 여부는 호출자 스키마 검증 책임)', () => {
  assert.equal(validateEnrollmentContract(null, { status: '재원' }).valid, true);
  assert.equal(validateEnrollmentContract(undefined).valid, true);
  assert.equal(validateEnrollmentContract([]).valid, true);
});
