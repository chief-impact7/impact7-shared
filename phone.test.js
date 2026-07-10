import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatPhone, isValidPhoneKR, formatPhoneInput } from './phone.js';

test('formatPhone: 11자리 하이픈 분할', () => {
    assert.equal(formatPhone('01012345678'), '010-1234-5678');
    assert.equal(formatPhone('010-1234-5678'), '010-1234-5678');
});

test('formatPhone: null/undefined → 빈 문자열', () => {
    assert.equal(formatPhone(null), '');
    assert.equal(formatPhone(undefined), '');
});

test('formatPhone: 11자리 아니면 원본 반환', () => {
    assert.equal(formatPhone('123'), '123');
    assert.equal(formatPhone('0212345678'), '0212345678');
    assert.equal(formatPhone('010123456789'), '010123456789');
});

// ─── 2026-07-05 적대적 리뷰 회귀 (C5) ───
test('formatPhone: 비문자열 입력도 항상 string 반환 (계약 → string)', () => {
    assert.equal(formatPhone(123), '123');
    assert.equal(typeof formatPhone(123), 'string');
    assert.equal(formatPhone(1012345678), '1012345678'); // 10자리 숫자 → 문자열화 원본
    assert.equal(formatPhone(1012345678), String(1012345678));
    assert.equal(formatPhone(11122223333), '111-2222-3333'); // 11자리 숫자는 하이픈 분할
});

// ─── isValidPhoneKR: 휴대폰 검증 (10-11자리, 하이픈 무관) ───
test('isValidPhoneKR: 유효한 휴대폰 번호', () => {
    assert.equal(isValidPhoneKR('01012345678'), true); // 11자리 010
    assert.equal(isValidPhoneKR('010-1234-5678'), true); // 하이픈 있어도 동일
    assert.equal(isValidPhoneKR('010 1234 5678'), true); // 공백도 무관
    assert.equal(isValidPhoneKR('0111234567'), true); // 10자리 011
    assert.equal(isValidPhoneKR('016-123-4567'), true); // 10자리 016
    assert.equal(isValidPhoneKR('01712345678'), true); // 017
    assert.equal(isValidPhoneKR('01812345678'), true); // 018
    assert.equal(isValidPhoneKR('01912345678'), true); // 019
    assert.equal(isValidPhoneKR('0101234567'), true); // 10자리 010도 관대하게 허용(의도)
});

test('isValidPhoneKR: 무효한 번호', () => {
    assert.equal(isValidPhoneKR('0212345678'), false); // 02 지역번호
    assert.equal(isValidPhoneKR('01212345678'), false); // 012 (2는 허용 접두 아님)
    assert.equal(isValidPhoneKR('0101234'), false); // 너무 짧음(총 7자리)
    assert.equal(isValidPhoneKR('010123456789'), false); // 너무 김(총 12자리)
    assert.equal(isValidPhoneKR('821012345678'), false); // +82 국가코드 형태는 미허용
    assert.equal(isValidPhoneKR(''), false);
    assert.equal(isValidPhoneKR(null), false);
    assert.equal(isValidPhoneKR(undefined), false);
});

// ─── formatPhoneInput: 입력 중 자동 하이픈 (점진 3-3~4-4) ───
test('formatPhoneInput: 점진 포맷', () => {
    assert.equal(formatPhoneInput('0'), '0');
    assert.equal(formatPhoneInput('010'), '010');
    assert.equal(formatPhoneInput('0101'), '010-1');
    assert.equal(formatPhoneInput('0101234'), '010-1234'); // 7자리
    assert.equal(formatPhoneInput('01012345'), '010-123-45'); // 8자리(3-3-rest 하한)
    assert.equal(formatPhoneInput('010123456'), '010-123-456'); // 9자리 중간
    assert.equal(formatPhoneInput('0111234567'), '011-123-4567'); // 10자리 → 3-3-4
    assert.equal(formatPhoneInput('01012345678'), '010-1234-5678'); // 11자리 → 3-4-4
});

test('formatPhoneInput: 하이픈 idempotent · 13자 초과 절단', () => {
    assert.equal(formatPhoneInput('010-1234-5678'), '010-1234-5678'); // 이미 포맷된 값 재적용
    assert.equal(formatPhoneInput('01012345678999'), '010-1234-5678'); // 11자리 초과분 절단
    assert.equal(formatPhoneInput('010-1234-5678').length, 13);
});

test('formatPhoneInput: nullish · 비문자열 → 항상 string', () => {
    assert.equal(formatPhoneInput(null), '');
    assert.equal(formatPhoneInput(undefined), '');
    assert.equal(formatPhoneInput(''), '');
    assert.equal(formatPhoneInput(1012345678), '101-234-5678'); // 숫자 입력도 문자열화 후 포맷
    assert.equal(typeof formatPhoneInput(1012345678), 'string');
});
