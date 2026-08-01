// 등원예정 → 재원 자동 전환 + history_log 기록. Firebase 의존성은 주입한다.
// idField: 학생 문서 ID 필드명('id'|'docId'). batchUpdate: DSC audit 래퍼(없으면 plain update).
// actor: 로그인 계정 이메일을 돌려주는 함수. firestore.rules가 history_logs.google_login_id를
// request.auth.token.email과 대조하므로 고정 문자열을 쓰면 쓰기가 거부된다.
import { activeEnrollmentsAt } from './enrollment-status.js';

export function createPromoteEnrollPending(firebase, { idField = 'id', batchUpdate, actor } = {}) {
  const { db, writeBatch, doc, collection, serverTimestamp } = firebase;
  // 빈 actor는 rules가 무조건 거부한다. 호출 시점이 아니라 여기서 막아야 "옵션 하나를
  // 잊었더니 자동 승격이 조용히 멈춘" 상태로 배포되지 않는다.
  if (typeof actor !== 'function') {
    throw new TypeError('createPromoteEnrollPending: actor 옵션이 필요합니다 — history_logs.google_login_id가 로그인 이메일과 일치해야 합니다.');
  }

  return async function (students, today) {
    const pending = students.filter(s =>
      s.status === '등원예정'
      && activeEnrollmentsAt((s.enrollments || []).filter(e => e?.start_date), today).length > 0
    );
    if (pending.length === 0) return [];
    const loggedBy = actor();

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
          google_login_id: loggedBy,
          timestamp: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    return pending;
  };
}
