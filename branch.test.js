import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { branchFromClassNumber, branchFromStudent, branchesFromStudent } from './branch.js';

test('branchFromClassNumber: 정규 반번호 첫 숫자 파생', () => {
    assert.equal(branchFromClassNumber('101'), '2단지');
    assert.equal(branchFromClassNumber('201'), '10단지');
    assert.equal(branchFromClassNumber(''), '');
    assert.equal(branchFromClassNumber(null), '');
});

test("branchFromClassNumber: '10단지' 접두가 '2단지'·'1xx' 규칙보다 먼저", () => {
    // '10단지...'는 첫 글자가 '1'이지만 접두 검사가 우선이라 '10단지'
    assert.equal(branchFromClassNumber('10단지내신'), '10단지');
    assert.equal(branchFromClassNumber('2단지내신'), '2단지');
});

test('branchFromStudent: branch 필드 우선, 없으면 첫 enrollment 파생', () => {
    assert.equal(branchFromStudent({ branch: '10단지', enrollments: [{ class_number: '101' }] }), '10단지');
    assert.equal(branchFromStudent({ enrollments: [{ class_number: '201' }] }), '10단지');
    assert.equal(branchFromStudent({}), '');
});

test('branchesFromStudent: 모든 enrollment 합집합, 비면 branch fallback', () => {
    assert.deepEqual(
        branchesFromStudent({ enrollments: [{ class_number: '101' }, { class_number: '201' }] }),
        ['2단지', '10단지']
    );
    assert.deepEqual(branchesFromStudent({ branch: '2단지', enrollments: [] }), ['2단지']);
    assert.deepEqual(branchesFromStudent({}), []);
});
