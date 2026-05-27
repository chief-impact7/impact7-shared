// 등원예정 → 재원 자동 전환 + history_log 기록. Firebase 의존성은 주입한다.
// idField: 학생 문서 ID 필드명('id'|'docId'). batchUpdate: DSC audit 래퍼(없으면 plain update).
export function createPromoteEnrollPending(firebase, { idField = 'id', batchUpdate } = {}) {
  const { db, writeBatch, doc, collection, serverTimestamp } = firebase;

  return async function (students, today) {
    const pending = students.filter(s =>
      s.status === '등원예정' &&
      (s.enrollments || []).some(e => e.start_date && e.start_date <= today)
    );
    if (pending.length === 0) return [];

    const batch = writeBatch(db);
    for (const s of pending) {
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
    return pending;
  };
}
