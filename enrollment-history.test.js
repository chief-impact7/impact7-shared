import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEnrollmentEvent,
  eventFromHistoryLog,
  statusAt,
} from './enrollment-history.js';

function timestamp(iso) {
  return { toDate: () => new Date(iso) };
}

test('history_logs 상태 변경을 등록 이벤트로 변환한다', () => {
  const event = eventFromHistoryLog('h1', {
    doc_id: 'student-1',
    timestamp: timestamp('2026-03-10T02:00:00.000Z'),
    change_type: 'UPDATE',
    before: '{"status":"재원"}',
    after: '{"status":"실휴원"}',
  });

  assert.deepEqual(event, {
    id: 'log-h1',
    studentId: 'student-1',
    type: 'PAUSE',
    date: '2026-03-10',
    reason: '실휴원',
  });
});

test('ENROLL 로그는 수업없음과 등원예정을 구분한다', () => {
  assert.equal(eventFromHistoryLog('consult', {
    doc_id: 'student-1',
    timestamp: timestamp('2026-03-10T02:00:00.000Z'),
    change_type: 'ENROLL',
    after: '신규 등록: 학생 (수업없음)',
  })?.type, 'CONSULT');

  assert.equal(eventFromHistoryLog(
    'planned',
    {
      doc_id: 'student-2',
      timestamp: timestamp('2026-03-10T02:00:00.000Z'),
      change_type: 'ENROLL',
      after: '신규 등록: 학생 (A101)',
    },
    new Map([['student-2', '2026-03-20']]),
    new Map([['student-2', '등원예정']]),
  )?.type, 'PLAN');
});

test('등록 이벤트를 시점 상태로 재생한다', () => {
  assert.equal(applyEnrollmentEvent('WITHDRAWN', 'PLAN'), 'PLANNED');
  assert.equal(statusAt([
    { id: '1', studentId: 'student-1', type: 'ENROLL', date: '2026-03-01' },
    { id: '2', studentId: 'student-1', type: 'PAUSE', date: '2026-03-10' },
    { id: '3', studentId: 'student-1', type: 'RESUME', date: '2026-03-20' },
  ], 'student-1', '2026-03-15'), 'PAUSED');
});
