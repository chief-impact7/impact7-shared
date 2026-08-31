import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    digitsOf,
    formatPhone,
    formatPhoneInput,
    guardianPhoneDigitsOf,
    guardianPhoneOf,
    isValidPhoneKR,
    legacyStudentPhoneKeyKR,
    normalizePhoneDigitsKR,
} from './phone.js';

test('formatPhone: 휴대폰 번호를 국내 표준 형식으로 정규화', () => {
    assert.equal(formatPhone('01012345678'), '010-1234-5678');
    assert.equal(formatPhone('010-1234-5678'), '010-1234-5678');
    assert.equal(formatPhone('12345678'), '010-1234-5678');
    assert.equal(formatPhone('1012345678'), '010-1234-5678');
    assert.equal(formatPhone('82 10 12345678'), '010-1234-5678');
    assert.equal(formatPhone('+82 010 1234 5678'), '010-1234-5678');
    assert.equal(formatPhone('0082 10 1234 5678'), '010-1234-5678');
    assert.equal(formatPhone('81 10 12345678'), '010-1234-5678');
});

test('formatPhone: 지역번호를 보존해 분할', () => {
    assert.equal(formatPhone('0212345678'), '02-1234-5678');
    assert.equal(formatPhone('021234567'), '02-123-4567');
    assert.equal(formatPhone('+82 2 1234 5678'), '02-1234-5678');
    assert.equal(formatPhone('03112345678'), '031-1234-5678');
    assert.equal(formatPhone('15881234'), '1588-1234');
});

test('formatPhone: null/undefined → 빈 문자열', () => {
    assert.equal(formatPhone(null), '');
    assert.equal(formatPhone(undefined), '');
});

test('formatPhone: 전화번호로 정규화할 수 없으면 원본 반환', () => {
    assert.equal(formatPhone('123'), '123');
    assert.equal(formatPhone('010123456789'), '010123456789');
});

// ─── 2026-07-05 적대적 리뷰 회귀 (C5) ───
test('formatPhone: 비문자열 입력도 항상 string 반환 (계약 → string)', () => {
    assert.equal(formatPhone(123), '123');
    assert.equal(typeof formatPhone(123), 'string');
    assert.equal(formatPhone(1012345678), '010-1234-5678');
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
    assert.equal(isValidPhoneKR('12345678'), true); // 010 생략
    assert.equal(isValidPhoneKR('82 10 12345678'), true); // 국가번호
    assert.equal(isValidPhoneKR('81 10 12345678'), true); // 운영 데이터의 국가번호 오기
});

test('isValidPhoneKR: 무효한 번호', () => {
    assert.equal(isValidPhoneKR('01212345678'), false); // 012 (2는 허용 접두 아님)
    assert.equal(isValidPhoneKR('0101234'), false); // 너무 짧음(총 7자리)
    assert.equal(isValidPhoneKR('010123456789'), false); // 너무 김(총 12자리)
    assert.equal(isValidPhoneKR('0212345678'), false); // 지역번호는 휴대폰 검증 대상 아님
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
    assert.equal(formatPhoneInput('12345678'), '010-1234-5678');
    assert.equal(formatPhoneInput('82 10 12345678'), '010-1234-5678');
    assert.equal(formatPhoneInput('0212345678'), '02-1234-5678');
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
    assert.equal(formatPhoneInput(1012345678), '010-1234-5678');
    assert.equal(typeof formatPhoneInput(1012345678), 'string');
});

test('digitsOf: 숫자만 추출, nullish → 빈 문자열', () => {
    assert.equal(digitsOf('010-1234-5678'), '01012345678');
    assert.equal(digitsOf(' 010 1234 5678 '), '01012345678');
    assert.equal(digitsOf(1012345678), '1012345678');
    assert.equal(digitsOf(null), '');
    assert.equal(digitsOf(undefined), '');
});

test('normalizePhoneDigitsKR: 발송용 국내 번호로 정규화', () => {
    assert.equal(normalizePhoneDigitsKR('82 10 12345678'), '01012345678');
    assert.equal(normalizePhoneDigitsKR('81 10 12345678'), '01012345678');
    assert.equal(normalizePhoneDigitsKR('12345678'), '01012345678');
    assert.equal(normalizePhoneDigitsKR('0212345678'), '0212345678');
    assert.equal(normalizePhoneDigitsKR('15881234'), '15881234');
});

test('legacyStudentPhoneKeyKR: 학생 문서 ID용 선행 0 제거 규칙을 공유', () => {
    for (const phone of ['010-1234-5678', '+82 10-1234-5678', '10-1234-5678', '1234-5678']) {
        assert.equal(legacyStudentPhoneKeyKR(phone), '1012345678');
    }
    assert.equal(legacyStudentPhoneKeyKR('02-123-4567'), '021234567');
    assert.equal(legacyStudentPhoneKeyKR(null), '');
});

test('guardianPhoneOf: guardian 정식 필드를 우선하고 레거시 parent 필드를 읽는다', () => {
    assert.equal(guardianPhoneOf({ guardianPhone: '010-1111-2222', parentPhone: '010-9999-9999' }), '010-1111-2222');
    assert.equal(guardianPhoneOf({ guardianPhoneDigits: '01011112222' }), '01011112222');
    assert.equal(guardianPhoneOf({ parentPhone: '010-2222-3333' }), '010-2222-3333');
    assert.equal(guardianPhoneOf({ parent1Phone: '010-3333-4444' }), '010-3333-4444');
    assert.equal(guardianPhoneOf({ additionalGuardianPhone: '010-3333-5555' }), '010-3333-5555');
    assert.equal(guardianPhoneOf({ parent_phone_1: '', parent_phone_2: '010-4444-5555' }), '010-4444-5555');
    assert.equal(guardianPhoneOf(null), '');
});

test('guardianPhoneDigitsOf: 폼·결제·학생 저장 형태를 같은 숫자열로 정규화한다', () => {
    assert.equal(guardianPhoneDigitsOf({ guardianPhone: '+82 10-1234-5678' }), '01012345678');
    assert.equal(guardianPhoneDigitsOf({ parent1Phone: '1234-5678' }), '01012345678');
    assert.equal(guardianPhoneDigitsOf({ parent_phone_1: '010-1234-5678' }), '01012345678');
});
