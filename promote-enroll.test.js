import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPromoteEnrollPending } from './promote-enroll.js';
import { classifyHistory } from './history-classifier.js';

function makeFirebase() {
  const ops = [];
  const batch = {
    update: (ref, data) => ops.push({ op: 'update', ref, data }),
    set: (ref, data) => ops.push({ op: 'set', ref, data }),
    commit: async () => {},
  };
  return {
    firebase: {
      db: 'db',
      writeBatch: () => batch,
      doc: (db, col, id) => ({ db, col, id }),
      collection: (db, col) => ({ db, col }),
      serverTimestamp: () => 'SERVER_TS',
    },
    ops,
  };
}

describe('createPromoteEnrollPending', () => {
  const TODAY = '2026-06-01';

  it('등원예정이 없으면 빈 배열 반환', async () => {
    const { firebase } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase);
    const result = await fn([{ id: '1', status: '재원', enrollments: [] }], TODAY);
    assert.deepEqual(result, []);
  });

  it('start_date <= today인 등원예정 학생만 전환', async () => {
    const { firebase, ops } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase);
    const students = [
      { id: 'a', status: '등원예정', enrollments: [{ start_date: '2026-06-01' }] },
      { id: 'b', status: '등원예정', enrollments: [{ start_date: '2026-06-15' }] },
    ];
    const result = await fn(students, TODAY);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'a');
    const update = ops.find(o => o.op === 'update' && o.ref.id === 'a');
    assert.ok(update);
    assert.equal(update.data.status, '재원');
  });

  it('history_logs set 기록 포함', async () => {
    const { firebase, ops } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase);
    await fn([{ id: 'x', status: '등원예정', enrollments: [{ start_date: '2026-05-01' }] }], TODAY);
    const log = ops.find(o => o.op === 'set');
    assert.ok(log);
    assert.equal(log.data.before, '등원예정');
    assert.equal(log.data.after, '재원');
    assert.equal(log.data.google_login_id, 'auto-transition');
  });

  it('idField 옵션으로 커스텀 ID 필드 사용', async () => {
    const { firebase, ops } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase, { idField: 'docId' });
    await fn([{ docId: 'doc-1', status: '등원예정', enrollments: [{ start_date: '2026-01-01' }] }], TODAY);
    const update = ops.find(o => o.op === 'update');
    assert.equal(update.ref.id, 'doc-1');
  });

  it('batchUpdate 옵션 사용 시 커스텀 업데이터 호출', async () => {
    const { firebase } = makeFirebase();
    const customOps = [];
    const batchUpdate = (batch, ref, data) => customOps.push({ ref, data });
    const fn = createPromoteEnrollPending(firebase, { batchUpdate });
    await fn([{ id: 'y', status: '등원예정', enrollments: [{ start_date: '2026-01-01' }] }], TODAY);
    assert.equal(customOps.length, 1);
    assert.equal(customOps[0].data.status, '재원');
  });

  it('enrollments가 없으면 전환하지 않음', async () => {
    const { firebase } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase);
    const result = await fn([{ id: 'z', status: '등원예정' }], TODAY);
    assert.deepEqual(result, []);
  });

  // 자동전환 로그는 classifyHistory에서 null(교사 화면 숨김) — 양쪽 계약 고정
  it('자동전환 history_log가 classifyHistory에서 null(숨김) 반환', () => {
    const log = {
      change_type: 'UPDATE',
      before: '등원예정',
      after: '재원',
      google_login_id: 'auto-transition',
    };
    assert.equal(classifyHistory(log), null);
  });
});
