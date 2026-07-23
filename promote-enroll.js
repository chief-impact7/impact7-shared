// 등원예정 → 재원 자동 전환 + history_log 기록. Firebase 의존성은 주입한다.
// idField: 학생 문서 ID 필드명('id'|'docId'). batchUpdate: DSC audit 래퍼(없으면 plain update).
import { activeEnrollmentsAt } from './enrollment-status.js';

export function createPromoteEnrollPending(firebase, { idField = 'id', batchUpdate } = {}) {
  const { db, writeBatch, doc, collection, serverTimestamp } = firebase;

  return async function (students, today) {
    const pending = students.filter(s =>
      s.status === '등원예정'
      && activeEnrollmentsAt((s.enrollments || []).filter(e => e?.start_date), today).length > 0
    );
    if (pending.length === 0) return [];

    // Firestore writeBatch 한도 500 ops — 학생당 2 ops(update+history)이므로 200명씩 분할 커밋.
    // 청크 중간 실패 시 이미 커밋된 학생은 '재원'이라 다음 실행에서 자동 제외 — 재실행으로 자연 재개.
    for (let i = 0; i < pending.length; i += 200) {
      const batch = writeBatch(db);
      for (const s of pending.slice(i, i + 200)) {
        const ref = doc(db, 'students', s[idField]);
        if (batchUpdate) {
          batchUpdate(batch, ref, { status: '재원' });
        } else {
          batch.update(ref, { status: '재원', updated_at: serverTimestamp() });
        }
        batch.set(doc(collection(db, 'history_logs')), {
          doc_id: s[idField],
          change_type: 'UPDATE',
          before: '등원예정',
          after: '재원',
          google_login_id: 'auto-transition',
          timestamp: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    return pending;
  };
}
