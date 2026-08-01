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
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    const result = await fn([{ id: '1', status: '재원', enrollments: [] }], TODAY);
    assert.deepEqual(result, []);
  });

  it('start_date <= today인 등원예정 학생만 전환', async () => {
    const { firebase, ops } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    const students = [
      { id: 'a', status: '등원예정', enrollments: [{ class_number: '101', start_date: '2026-06-01' }] },
      { id: 'b', status: '등원예정', enrollments: [{ class_number: '201', start_date: '2026-06-15' }] },
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
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    await fn([{ id: 'x', status: '등원예정', enrollments: [{ class_number: '101', start_date: '2026-05-01' }] }], TODAY);
    const log = ops.find(o => o.op === 'set');
    assert.ok(log);
    assert.equal(log.data.before, '등원예정');
    assert.equal(log.data.after, '재원');
    assert.equal(log.data.google_login_id, 'teacher@impact7.kr');
  });

  it('idField 옵션으로 커스텀 ID 필드 사용', async () => {
    const { firebase, ops } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr', idField: 'docId' });
    await fn([{ docId: 'doc-1', status: '등원예정', enrollments: [{ class_number: '101', start_date: '2026-01-01' }] }], TODAY);
    const update = ops.find(o => o.op === 'update');
    assert.equal(update.ref.id, 'doc-1');
  });

  it('batchUpdate 옵션 사용 시 커스텀 업데이터 호출', async () => {
    const { firebase } = makeFirebase();
    const customOps = [];
    const batchUpdate = (batch, ref, data) => customOps.push({ ref, data });
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr', batchUpdate });
    await fn([{ id: 'y', status: '등원예정', enrollments: [{ class_number: '101', start_date: '2026-01-01' }] }], TODAY);
    assert.equal(customOps.length, 1);
    assert.equal(customOps[0].data.status, '재원');
  });

  it('enrollments가 없으면 전환하지 않음', async () => {
    const { firebase } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    const result = await fn([{ id: 'z', status: '등원예정' }], TODAY);
    assert.deepEqual(result, []);
  });

  it('레거시 start_date 없는 enrollment는 전환하지 않음', async () => {
    const { firebase } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    const result = await fn([{
      id: 'legacy', status: '등원예정', enrollments: [{ class_type: '정규', class_number: '101' }],
    }], TODAY);
    assert.deepEqual(result, []);
  });

  // 자동전환 로그는 classifyHistory에서 null(교사 화면 숨김) — 양쪽 계약 고정
  it('자동전환 history_log가 classifyHistory에서 null(숨김) 반환', () => {
    const log = {
      change_type: 'UPDATE',
      before: '등원예정',
      after: '재원',
      google_login_id: 'teacher@impact7.kr',
    };
    assert.equal(classifyHistory(log), null);
  });
});

// ─── 2026-07-05 적대적 리뷰 회귀 (C8) ───
describe('createPromoteEnrollPending — 경계', () => {
  const TODAY = '2026-06-01';

  it('종료된 과거 enrollment만 있으면 전환하지 않음 (end_date 존중)', async () => {
    const { firebase } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    const result = await fn([{
      id: 'old', status: '등원예정',
      enrollments: [
        { class_number: '101', start_date: '2026-01-01', end_date: '2026-02-28' },
        { class_number: '201', start_date: '2026-06-15' },
      ],
    }], TODAY);
    assert.deepEqual(result, []);
  });

  it('오늘 활성인 enrollment가 있으면 전환 (end_date 미래·없음 모두)', async () => {
    const { firebase } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    const result = await fn([
      { id: 'a', status: '등원예정', enrollments: [{ class_number: '101', start_date: '2026-05-01', end_date: '2026-12-31' }] },
      { id: 'b', status: '등원예정', enrollments: [{ class_number: '201', start_date: '2026-05-01' }] },
    ], TODAY);
    assert.deepEqual(result.map(s => s.id), ['a', 'b']);
  });

  it('enrollments의 null 원소를 무시 (크래시 없음)', async () => {
    const { firebase } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    const result = await fn([{
      id: 'n', status: '등원예정',
      enrollments: [null, { class_number: '101', start_date: '2026-05-01' }],
    }], TODAY);
    assert.equal(result.length, 1);
  });

  it('활성 기타 계정은 전환하고 휴원 계정은 제외', async () => {
    const { firebase } = makeFirebase();
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    const result = await fn([
      {
        id: 'other', status: '등원예정',
        enrollments: [{
          account_id: 'other-a', account_type: '기타', class_type: '기타',
          class_number: '기타101', start_date: '2026-05-01',
        }],
      },
      {
        id: 'paused', status: '등원예정',
        enrollments: [{
          account_id: 'regular-a', account_type: '정규', class_type: '정규',
          class_number: '101', start_date: '2026-05-01',
          pause_start_date: '2026-05-15', pause_end_date: '2026-06-15',
        }],
      },
    ], TODAY);
    assert.deepEqual(result.map(s => s.id), ['other']);
  });

  it('200명 초과 시 batch 분할 커밋 (Firestore 500 ops 한도)', async () => {
    const batches = [];
    const firebase = {
      db: 'db',
      writeBatch: () => {
        const b = { n: 0, committed: false, update: () => { b.n++; }, set: () => { b.n++; }, commit: async () => { b.committed = true; } };
        batches.push(b);
        return b;
      },
      doc: (db, col, id) => ({ id }),
      collection: (db, col) => ({ col }),
      serverTimestamp: () => 'TS',
    };
    const fn = createPromoteEnrollPending(firebase, { actor: () => 'teacher@impact7.kr' });
    const students = Array.from({ length: 401 }, (_, i) => ({
      id: `s${i}`, status: '등원예정',
      enrollments: [{ class_number: '101', start_date: '2026-01-01' }],
    }));
    const result = await fn(students, TODAY);
    assert.equal(result.length, 401);
    assert.equal(batches.length, 3); // 200 + 200 + 1
    assert.ok(batches.every(b => b.committed));
    assert.ok(batches.every(b => b.n <= 500));
  });
  it('actor를 주입하지 않으면 만들 때 즉시 실패한다', () => {
    // 빈 actor는 rules가 거부하므로, 런타임에 조용히 멈추는 대신 생성 시점에 드러나야 한다.
    const { firebase } = makeFirebase();
    assert.throws(() => createPromoteEnrollPending(firebase), /actor 옵션이 필요합니다/);
  });
});
