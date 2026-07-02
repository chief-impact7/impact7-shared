import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    deriveStudentNumber,
    studentNumberIdentityKey,
    studentNumberNameKey,
    normalizeRegistrationNo,
    deriveFromSource,
    isValidStudentNumber,
    detectStudentNumberUpgrade,
    STUDENT_NUMBER_SOURCES,
} from './student-number.js';

test('deriveStudentNumber: student_phone 우선, 010 제거 후 앞 6자리', () => {
    assert.deepEqual(
        deriveStudentNumber({
            student_phone: '010-1234-5678',
            parent_phone_1: '010-9999-0000',
        }),
        { studentNumber: '123456', source: 'student_phone' }
    );
});

test('deriveStudentNumber: student_phone 없으면 parent_phone_1 사용', () => {
    assert.deepEqual(
        deriveStudentNumber({
            parent_phone_1: '010-2345-6789',
        }),
        { studentNumber: '234567', source: 'parent_phone_1' }
    );
});

test('studentNumberNameKey: 이름 공백 제거', () => {
    assert.equal(studentNumberNameKey('홍 길 동'), '홍길동');
});

test('studentNumberIdentityKey: OCR 매칭용 이름+학생번호 키', () => {
    assert.equal(studentNumberIdentityKey('홍 길 동', '123456'), '홍길동|123456');
});

test('studentNumberIdentityKey: 이름 또는 번호 없으면 빈 문자열', () => {
    assert.equal(studentNumberIdentityKey('', '123456'), '');
    assert.equal(studentNumberIdentityKey('홍길동', ''), '');
});

test('normalizeRegistrationNo: 11자리 010 → 앞 3자리 제거', () => {
    assert.equal(normalizeRegistrationNo('010-1234-5678'), '12345678');
});

test('normalizeRegistrationNo: 8자리 00 패딩 → 뒤 2자리 제거', () => {
    assert.equal(normalizeRegistrationNo('12345600'), '123456');
});

test('normalizeRegistrationNo: falsy/숫자없음 → 빈 문자열', () => {
    assert.equal(normalizeRegistrationNo(''), '');
    assert.equal(normalizeRegistrationNo(null), '');
    assert.equal(normalizeRegistrationNo(undefined), '');
    assert.equal(normalizeRegistrationNo('abc-def'), '');
});

test('normalizeRegistrationNo: 그 외 자리수는 숫자만 추출', () => {
    assert.equal(normalizeRegistrationNo('123-456'), '123456');
});

test('deriveFromSource: 지정 소스에서만 파생, 010 제거 후 앞 6자리', () => {
    const s = { student_phone: '010-9876-5432', parent_phone_1: '010-1111-2222' };
    assert.equal(deriveFromSource(s, 'student_phone'), '987654');
    assert.equal(deriveFromSource(s, 'parent_phone_1'), '111122');
    assert.equal(deriveFromSource(s, 'parent_phone_2'), '');
    assert.equal(deriveFromSource(null, 'student_phone'), '');
});

test('deriveStudentNumber: deriveFromSource와 동일 결과(우선순위 fallback)', () => {
    const s = { parent_phone_1: '010-1111-2222' };
    assert.deepEqual(deriveStudentNumber(s), { studentNumber: '111122', source: 'parent_phone_1' });
});

test('isValidStudentNumber: 정확히 6자리 숫자만 true', () => {
    assert.equal(isValidStudentNumber('123456'), true);
    assert.equal(isValidStudentNumber(' 123456 '), true);
    assert.equal(isValidStudentNumber('12345'), false);
    assert.equal(isValidStudentNumber('1234567'), false);
    assert.equal(isValidStudentNumber('12345a'), false);
    assert.equal(isValidStudentNumber(''), false);
    assert.equal(isValidStudentNumber(null), false);
});

test('detectStudentNumberUpgrade: 본인 폰이 생기면 상위소스 번호 제안', () => {
    const s = {
        studentNumber: '111122',
        studentNumberSource: 'parent_phone_1',
        student_phone: '010-9876-5432',
        parent_phone_1: '010-1111-2222',
    };
    assert.deepEqual(detectStudentNumberUpgrade(s, 'parent_phone_1'), { studentNumber: '987654', source: 'student_phone' });
});

test('detectStudentNumberUpgrade: 이미 최상위(student_phone) 소스면 null', () => {
    const s = { studentNumber: '987654', student_phone: '010-9876-5432' };
    assert.equal(detectStudentNumberUpgrade(s, 'student_phone'), null);
});

test('detectStudentNumberUpgrade: 소스 불명이면 null', () => {
    assert.equal(detectStudentNumberUpgrade({ student_phone: '010-9876-5432' }, ''), null);
    assert.equal(detectStudentNumberUpgrade({ student_phone: '010-9876-5432' }, undefined), null);
});

test('detectStudentNumberUpgrade: 상위소스 번호가 현재와 같으면 null', () => {
    const s = {
        studentNumber: '987654',
        student_phone: '010-9876-5432',
        parent_phone_1: '010-9876-5432',
    };
    assert.equal(detectStudentNumberUpgrade(s, 'parent_phone_1'), null);
});

test('STUDENT_NUMBER_SOURCES: 우선순위 순서 고정', () => {
    assert.deepEqual(STUDENT_NUMBER_SOURCES, ['student_phone', 'parent_phone_1', 'parent_phone_2']);
});
