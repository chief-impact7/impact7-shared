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

test('normalizeRegistrationNo: 11자리 010 → 파생 규칙과 동일한 6자리 키', () => {
    // 2026-07-05 P2: 8자리로 남기지 않고 deriveFromSource와 같은 앞 6자리로 축약 —
    // 전화 원본과 파생 학생번호가 같은 비교 키를 갖게 한다.
    assert.equal(normalizeRegistrationNo('010-1234-5678'), '123456');
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

// ─── 2026-07-05 적대적 리뷰 회귀 (C14) ───
test('같은 전화의 다른 표기(+82·앞 0 소실 숫자)도 동일 학생번호 파생', () => {
    assert.equal(deriveFromSource({ student_phone: '010-1234-5678' }, 'student_phone'), '123456');
    assert.equal(deriveFromSource({ student_phone: 1012345678 }, 'student_phone'), '123456');
    assert.equal(deriveFromSource({ student_phone: '+82-10-1234-5678' }, 'student_phone'), '123456');
    assert.equal(deriveFromSource({ student_phone: '+82 10 1234 5678' }, 'student_phone'), '123456');
});

// ─── 2026-07-05 리뷰 P2 회귀 ───
test('normalizeRegistrationNo: 같은 전화의 모든 표기가 동일 비교 키', () => {
    const key = normalizeRegistrationNo('010-1234-5678');
    assert.equal(key, '123456');
    assert.equal(normalizeRegistrationNo('01012345678'), key);
    assert.equal(normalizeRegistrationNo('+82-10-1234-5678'), key);
    assert.equal(normalizeRegistrationNo(1012345678), key);   // 앞 0 소실 숫자
    assert.equal(normalizeRegistrationNo('12345678'), key);   // 8자리 잔여 표기
    assert.equal(normalizeRegistrationNo('12345600'), '123456'); // 기존 '00' 패딩 규칙 유지
    assert.equal(normalizeRegistrationNo('123456'), key);     // 파생 6자리
});

test("0이 유지된 13자리 '+82 010-…' 표기도 동일 번호·키", () => {
    assert.equal(deriveFromSource({ student_phone: '+82 010-1234-5678' }, 'student_phone'), '123456');
    assert.equal(normalizeRegistrationNo('+82 010-1234-5678'), '123456');
});
