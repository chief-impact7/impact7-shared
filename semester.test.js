import test from 'node:test';
import assert from 'node:assert/strict';
import {
  semesterFromSettingsKey, settingsKeyFromSemester, resolveSemesterAt,
  semesterRange, enrollmentInSemester, semestersForEnrollment, semesterPool,
} from './semester.js';

const SETTINGS = {
  '중등-2026-spring': { start_date: '2026-03-02' },
  '중등-2026-summer': { start_date: '2026-07-20' },
  '고등-2026-autumn': { start_date: '2026-07-20' },
};

test('설정 키 ↔ enrollment 표기 변환', () => {
  assert.equal(semesterFromSettingsKey('중등-2026-summer'), '2026-Summer');
  assert.equal(semesterFromSettingsKey('2026-spring1'), '2026-Spring1');
  assert.equal(semesterFromSettingsKey(''), '');
  assert.equal(settingsKeyFromSemester('초등', '2026-Spring1'), '초등-2026-spring1');
  assert.equal(settingsKeyFromSemester('', '2026-Spring1'), '');
});

test('기준일의 학기는 시작일이 지난 것 중 가장 늦은 것', () => {
  assert.equal(resolveSemesterAt('중등', '2026-09-01', SETTINGS).semester, '2026-Summer');
  assert.equal(resolveSemesterAt('중등', '2026-07-19', SETTINGS).semester, '2026-Spring');
  assert.equal(resolveSemesterAt('중등', '2026-07-20', SETTINGS).startDate, '2026-07-20');
  assert.equal(resolveSemesterAt('중등', '2026-01-01', SETTINGS), null);
  assert.equal(resolveSemesterAt('고등', '2026-09-01', SETTINGS).semester, '2026-Autumn');
});

test('학기 범위는 시작일 당일부터 다음 학기 시작 전날까지다', () => {
  assert.deepEqual(semesterRange('중등', '2026-Spring', SETTINGS), {
    start: '2026-03-02', end: '2026-07-19',
  });
  assert.deepEqual(semesterRange('중등', '2026-Summer', SETTINGS), {
    start: '2026-07-20', end: null,
  });
  assert.equal(semesterRange('초등', '2026-Summer', SETTINGS), null);
});

test('enrollment와 학기 기간은 양끝을 포함해 겹침을 판정한다', () => {
  const options = { level: '중등', semester: '2026-Spring', semesterSettings: SETTINGS };
  assert.equal(enrollmentInSemester({ end_date: '2026-03-01' }, options), false);
  assert.equal(enrollmentInSemester({ end_date: '2026-03-02' }, options), true);
  assert.equal(enrollmentInSemester({ start_date: '2026-07-19' }, options), true);
  assert.equal(enrollmentInSemester({ start_date: '2026-07-20' }, options), false);
  assert.equal(enrollmentInSemester({}, options), true);
  assert.equal(enrollmentInSemester({}, { ...options, level: '초등' }), false);
});

test('enrollment가 걸친 학기와 학부 학기 풀은 시작일 순서로 반환한다', () => {
  assert.deepEqual(semesterPool('중등', SETTINGS), ['2026-Spring', '2026-Summer']);
  assert.deepEqual(semestersForEnrollment(
    { start_date: '2026-07-19', end_date: '2026-07-20' },
    { level: '중등', semesterSettings: SETTINGS },
  ), ['2026-Spring', '2026-Summer']);
  assert.deepEqual(semesterPool('초등', SETTINGS), []);
});
