import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDays, normalizeClassTypes, normalizeEnrollments } from './enrollment-normalize.js';

test('normalizeDays — 문자열·배열·요일 접미사', () => {
    assert.deepEqual(normalizeDays(undefined), []);
    assert.deepEqual(normalizeDays('월요일 수요일'), ['월', '수']);
    assert.deepEqual(normalizeDays(['월요일', '수']), ['월', '수']);
    assert.deepEqual(normalizeDays('화,목'), ['화', '목']);
});

test('normalizeClassTypes — 기본값·분리', () => {
    assert.deepEqual(normalizeClassTypes(undefined), ['정규']);
    assert.deepEqual(normalizeClassTypes('정규'), ['정규']);
    assert.deepEqual(normalizeClassTypes('정규,특강'), ['정규', '특강']);
    assert.deepEqual(normalizeClassTypes(['정규', '특강']), ['정규', '특강']);
});

test('기존 enrollments가 있으면 그대로 반환한다', () => {
    const enrollments = [{ class_type: '정규', class_number: '101' }];
    assert.equal(normalizeEnrollments({ enrollments, class_number: '999' }), enrollments);
});

test('레거시 반 정보가 없으면 enrollment를 합성하지 않는다 (class_type만으로는 증거가 아니다)', () => {
    assert.deepEqual(normalizeEnrollments({}), []);
    assert.deepEqual(normalizeEnrollments({ class_type: '정규' }), []);
    assert.deepEqual(normalizeEnrollments({ class_type: '특강', status: '상담' }), []);
});

test('레거시 반 정보가 있으면 변환한다 — start_date만 있어도 증거다', () => {
    assert.deepEqual(normalizeEnrollments({ start_date: '2026-08-01' }), [{
        class_type: '정규', level_symbol: '', class_number: '', day: [], start_date: '2026-08-01',
    }]);
    assert.deepEqual(normalizeEnrollments({
        class_type: '정규', level_code: 'HA', class_number: '101', day: '월요일 수요일', start_date: '2026-08-01',
    }), [{
        class_type: '정규', level_symbol: 'HA', class_number: '101', day: ['월', '수'], start_date: '2026-08-01',
    }]);
});

test('숫자뿐인 level_symbol은 class_number로 이동한다', () => {
    assert.deepEqual(normalizeEnrollments({ level_symbol: '101' }), [{
        class_type: '정규', level_symbol: '', class_number: '101', day: [], start_date: '',
    }]);
});

test('특강은 special_start_date·special_end_date를 우선한다', () => {
    assert.deepEqual(normalizeEnrollments({
        class_type: '특강', class_number: '수요특강', special_start_date: '2026-08-05', special_end_date: '2026-08-26',
    }), [{
        class_type: '특강', level_symbol: '', class_number: '수요특강', day: [],
        start_date: '2026-08-05', end_date: '2026-08-26',
    }]);
    assert.equal(normalizeEnrollments({ class_type: '특강', class_number: 'X', start_date: '2026-08-01' })[0].start_date, '2026-08-01');
});

test('복수 class_type은 항목으로 분리한다', () => {
    const result = normalizeEnrollments({ class_type: '정규,특강', class_number: '101', start_date: '2026-08-01' });
    assert.equal(result.length, 2);
    assert.equal(result[0].class_type, '정규');
    assert.equal(result[0].start_date, '2026-08-01');
    assert.equal(result[1].class_type, '특강');
    assert.equal(result[1].start_date, '');
    assert.equal(result[1].end_date, '');
});
