import test from 'node:test';
import assert from 'node:assert/strict';
import {
  semesterFromSettingsKey, settingsKeyFromSemester, resolveSemesterAt, applySemesterRollover,
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

const roll = (enrollments) => applySemesterRollover(enrollments, {
  semester: '2026-Summer', semesterStartDate: '2026-07-20', today: '2026-09-01',
});

test('학기 안에서 시작한 조각은 semester만 교체한다 (김예은 AX101)', () => {
  const { updatedEnrollments, changes } = roll([
    { class_type: '정규', level_symbol: 'AX', class_number: '101', semester: '2026-Spring', start_date: '2026-08-17' },
  ]);
  assert.equal(changes.length, 1);
  assert.deepEqual(updatedEnrollments, [
    { class_type: '정규', level_symbol: 'AX', class_number: '101', semester: '2026-Summer', start_date: '2026-08-17' },
  ]);
});

test('지난 학기부터 이어지는 조각은 학기 시작 전날에 닫고 새 조각을 연다', () => {
  const { updatedEnrollments } = roll([
    { class_type: '정규', level_symbol: 'A', class_number: '102', semester: '2026-Spring', start_date: '2026-03-07', day: ['화'] },
  ]);
  assert.deepEqual(updatedEnrollments, [
    { class_type: '정규', level_symbol: 'A', class_number: '102', semester: '2026-Spring', start_date: '2026-03-07', end_date: '2026-07-19', day: ['화'] },
    { class_type: '정규', level_symbol: 'A', class_number: '102', semester: '2026-Summer', start_date: '2026-07-20', day: ['화'] },
  ]);
});

test('분할 시 예정된 종료일은 새 조각이 이어받는다', () => {
  const { updatedEnrollments } = roll([
    { class_type: '정규', class_number: 'A102', semester: '2026-Spring', start_date: '2026-03-07', end_date: '2026-12-31' },
  ]);
  assert.equal(updatedEnrollments[0].end_date, '2026-07-19');
  assert.equal(updatedEnrollments[1].end_date, '2026-12-31');
});

test('semester가 없던 조각도 현재 학기를 부여받는다', () => {
  const { updatedEnrollments } = roll([{ class_type: '정규', class_number: 'A102', start_date: '2026-08-01' }]);
  assert.equal(updatedEnrollments[0].semester, '2026-Summer');
});

test('닫힌 조각·미래 예약·정규 아닌 수업·이미 현재 학기는 그대로 둔다', () => {
  const input = [
    { class_type: '정규', class_number: 'A102', semester: '2026-Spring', start_date: '2026-07-17', end_date: '2026-08-16' },
    { class_type: '정규', class_number: 'A103', semester: '2026-Spring', start_date: '2026-09-15' },
    { class_type: '내신', class_number: '', semester: '2026-Spring', start_date: '2026-06-01' },
    { class_type: '특강', account_type: '특강', class_number: 'SP101', semester: '2026-Spring', start_date: '2026-03-01' },
    { class_type: '정규', class_number: 'A104', semester: '2026-Summer', start_date: '2026-07-25' },
  ];
  const { updatedEnrollments, changes } = roll(input);
  assert.deepEqual(changes, []);
  assert.equal(updatedEnrollments, input);
});

test('학기 정보가 없으면 손대지 않는다', () => {
  const input = [{ class_type: '정규', class_number: 'A102', semester: '2026-Spring', start_date: '2026-03-07' }];
  assert.equal(applySemesterRollover(input, { semester: '', semesterStartDate: '', today: '2026-09-01' }).updatedEnrollments, input);
});
