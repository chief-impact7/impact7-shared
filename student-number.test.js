import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    deriveStudentNumber,
    studentNumberIdentityKey,
    studentNumberNameKey,
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
