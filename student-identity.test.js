import test from 'node:test';
import assert from 'node:assert/strict';
import { matchStudentIdentity, studentDocId } from './student-identity.js';

test('studentDocId는 기존 생성 창구 4곳과 같은 규칙으로 ID를 만든다', () => {
  assert.equal(studentDocId('김민준', '010-1234-5678'), '김민준_1012345678');
  assert.equal(studentDocId('김 민준', '01012345678'), '김_민준_1012345678');
  // 레거시 admission 규칙 보존 — 앞뒤 공백도 밑줄로 치환한다
  assert.equal(studentDocId(' 김민준', '010-1234-5678'), '_김민준_1012345678');
  // 11자리 0 시작일 때만 선행 0을 뗀다
  assert.equal(studentDocId('김민준', '10-1234-5678'), '김민준_1012345678');
  assert.equal(studentDocId('김민준', '0101234567'), '김민준_0101234567');
});

test('studentDocId는 이름 또는 전화가 비면 빈 문자열을 돌려준다', () => {
  assert.equal(studentDocId('', '010-1234-5678'), '');
  assert.equal(studentDocId('   ', '010-1234-5678'), '');
  assert.equal(studentDocId('김민준', ''), '');
  assert.equal(studentDocId('김민준', null), '');
});

test('matchStudentIdentity: 이름이 정확히 같은 문서를 매칭한다', () => {
  const candidates = [{ id: '김민준_1012345678', data: { name: '김민준', status: '재원' } }];
  const { match, ambiguous } = matchStudentIdentity(candidates, { name: '김민준', guardianPhone: '010-1234-5678' });
  assert.equal(match?.id, '김민준_1012345678');
  assert.deepEqual(ambiguous, []);
});

test('matchStudentIdentity: 이름이 바뀐 문서는 ID 접두 일치로 매칭한다', () => {
  // DB 수정 모드가 ID를 유지한 채 이름만 바꾼 문서 — 실측 데이터 형태
  const candidates = [{ id: '한승윤_1084322436', data: { name: '한성윤', status: '재원' } }];
  const { match } = matchStudentIdentity(candidates, { name: '한승윤' });
  assert.equal(match?.id, '한승윤_1084322436');
});

test('matchStudentIdentity: 전화가 바뀐 문서는 이름 일치로 매칭한다', () => {
  // 후보는 호출자가 전화 변형으로 미리 모아 넘긴다 — ID 전화가 달라도 이름이 같으면 매칭
  const candidates = [{ id: '김민준_9012345678', data: { name: '김민준', status: '재원' } }];
  const { match } = matchStudentIdentity(candidates, { name: '김민준', guardianPhone: '010-1234-5678' });
  assert.equal(match?.id, '김민준_9012345678');
});

test('matchStudentIdentity: 같은 전화의 형제(다른 이름)는 매칭하지 않는다', () => {
  const candidates = [{ id: '김민수_1012345678', data: { name: '김민수', status: '재원' } }];
  const { match, ambiguous } = matchStudentIdentity(candidates, { name: '김민준', guardianPhone: '010-1234-5678' });
  assert.equal(match, null);
  assert.deepEqual(ambiguous, []);
});

test('matchStudentIdentity: 같은 이름 2건이면 활성 문서를 우선한다', () => {
  const candidates = [
    { id: '김민준_1012345678', data: { name: '김민준', status: '퇴원' } },
    { id: '김민준_9012345678', data: { name: '김민준', status: '재원' } },
  ];
  const { match, ambiguous } = matchStudentIdentity(candidates, { name: '김민준' });
  assert.equal(match?.id, '김민준_9012345678');
  assert.deepEqual(ambiguous, []);
});

test('matchStudentIdentity: 활성 후보가 2건 이상이면 ambiguous로 돌려준다', () => {
  const candidates = [
    { id: '김민준_1012345678', data: { name: '김민준', status: '재원' } },
    { id: '김민준_9012345678', data: { name: '김민준', status: '상담' } },
  ];
  const { match, ambiguous } = matchStudentIdentity(candidates, { name: '김민준' });
  assert.equal(match, null);
  assert.equal(ambiguous.length, 2);
});

test('matchStudentIdentity: 이름이 비면 매칭하지 않는다', () => {
  const candidates = [{ id: '김민준_1012345678', data: { name: '김민준' } }];
  const { match, ambiguous } = matchStudentIdentity(candidates, { name: '' });
  assert.equal(match, null);
  assert.deepEqual(ambiguous, []);
});
