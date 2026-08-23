import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    extractFormStudentCandidate,
    formStudentDocumentId,
    normalizeFormStudentMapping,
} from './form-student-candidate.js';

const mapping = {
    enabled: true,
    fields: {
        studentName: 'q_name',
        guardianPhone: 'q_guardian',
        studentPhone: 'q_student_phone',
        school: 'q_school',
        grade: 'q_grade',
        privacyConsent: 'q_privacy',
    },
};

test('formStudentDocumentId: 기존 학생 문서 ID 규칙과 같은 이름+보호자전화 키', () => {
    assert.equal(formStudentDocumentId(' 홍 길 동 ', '010-1234-5678'), '홍_길_동_1012345678');
    assert.equal(formStudentDocumentId('홍길동', '+82 10 1234 5678'), '홍길동_821012345678');
    assert.equal(formStudentDocumentId('홍길동', '1234-5678'), '홍길동_12345678');
    assert.equal(formStudentDocumentId('', '010-1234-5678'), '');
});

test('normalizeFormStudentMapping: enabled 매핑은 필수 키가 없으면 비활성 처리', () => {
    assert.deepEqual(
        normalizeFormStudentMapping({ enabled: true, fields: { studentName: 'q_name', guardianPhone: 'q_guardian' } }),
        { enabled: false, fields: {} }
    );
});

test('extractFormStudentCandidate: 동의·필수값이 있으면 상담 학생 후보를 만든다', () => {
    assert.deepEqual(
        extractFormStudentCandidate({
            q_name: ' 홍 길 동 ',
            q_guardian: '+82 10 1234 5678',
            q_student_phone: '1234-5678',
            q_school: '금옥중',
            q_grade: '중1',
            q_privacy: '동의',
        }, mapping),
        {
            docId: '홍_길_동_821012345678',
            name: '홍 길 동',
            guardianPhone: '01012345678',
            studentPhone: '01012345678',
            school: '금옥중',
            grade: '중1',
            privacyConsent: true,
        }
    );
});

test("extractFormStudentCandidate: Forms privacyConsent 저장값 '동의합니다'를 동의로 인정한다", () => {
    const result = extractFormStudentCandidate({
        q_name: '홍길동',
        q_guardian: '010-1234-5678',
        q_privacy: ['동의합니다'],
    }, mapping);
    assert.equal(result?.docId, '홍길동_1012345678');
    assert.equal(result?.privacyConsent, true);
});

test('extractFormStudentCandidate: 개인정보 동의가 없거나 false면 후보를 만들지 않는다', () => {
    assert.equal(extractFormStudentCandidate({ q_name: '홍길동', q_guardian: '01012345678' }, mapping), null);
    assert.equal(extractFormStudentCandidate({ q_name: '홍길동', q_guardian: '01012345678', q_privacy: false }, mapping), null);
    assert.equal(extractFormStudentCandidate({ q_name: '홍길동', q_guardian: '01012345678', q_privacy: '미동의' }, mapping), null);
});

test('extractFormStudentCandidate: enabled 매핑의 필수 키나 필수 답변이 빠지면 fail closed', () => {
    assert.equal(extractFormStudentCandidate({ q_name: '홍길동', q_guardian: '01012345678', q_privacy: true }, {
        enabled: true,
        fields: { studentName: 'q_name', privacyConsent: 'q_privacy' },
    }), null);
    assert.equal(extractFormStudentCandidate({ q_name: '홍길동', q_privacy: true }, mapping), null);
});
