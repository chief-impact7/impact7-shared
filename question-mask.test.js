import test from 'node:test';
import assert from 'node:assert/strict';
import { maskQuestion, MASK } from './question-mask.js';

const known = {
  studentNames: ['홍길동', '김영희', '이서준'],
  staffNames: ['박선생'],
  schoolNames: ['양정중학교', '양정중'],
};
const mask = (q) => maskQuestion(q, known);

test('명단에 있는 학생 이름을 지우고 문장은 남긴다', () => {
  const r = mask('홍길동 3월에 환불받은 거 어떻게 처리해요?');
  assert.equal(r.dropped, false);
  assert.equal(r.masked, `${MASK.student} 3월에 환불받은 거 어떻게 처리해요?`);
});

test('학교는 긴 이름부터 지운다 — 짧은 것 먼저 지우면 조각이 남는다', () => {
  assert.equal(mask('양정중학교 애들 출결 어디서 봐요?').masked, `${MASK.school} 애들 출결 어디서 봐요?`);
  assert.equal(mask('양정중 애들 어디서 봐요?').masked, `${MASK.school} 애들 어디서 봐요?`);
});

test('전화번호는 형식이 달라도 지운다', () => {
  assert.equal(mask('010-1234-5678로 문자 갔나요?').masked, `${MASK.phone}로 문자 갔나요?`);
  assert.equal(mask('01012345678 맞나요?').masked, `${MASK.phone} 맞나요?`);
});

test('직원 이름도 지운다', () => {
  assert.equal(mask('박선생 반이 어디죠?').masked, `${MASK.person} 반이 어디죠?`);
});

test('사람이 없는 질문은 그대로 통과한다', () => {
  for (const q of [
    '퇴원 요청 어떻게 해요?',
    '결석 처리하면 그다음 어떻게 되나요?',
    '일일현황표 어디서 받나요?',
    '여러 명 한꺼번에 출결 바꾸는 법',
  ]) {
    const r = mask(q);
    assert.equal(r.dropped, false, q);
    assert.equal(r.masked, q);
  }
});

test('명단에 없는 이름이 남으면 버린다 — 새는 것보다 표본이 적은 편이 낫다', () => {
  assert.deepEqual(mask('최민서 오늘 왔어요?'), { masked: null, dropped: true, reason: 'unmasked_name' });
});

test('오타 난 이름도 성이 남아 걸린다', () => {
  assert.equal(mask('홍길똥 오늘 왔나요?').dropped, true);
});

test('명단에 없는 형제도 성이 같아 걸린다', () => {
  assert.equal(mask('김영수는 어느 반이에요?').dropped, true);
});

test('성으로 시작하지 않는 흔한 말은 이름으로 보지 않는다', () => {
  for (const q of ['어디서 확인해요?', '갔나요 안 갔나요?', '그다음 뭐 하죠?']) {
    assert.equal(mask(q).dropped, false, q);
  }
});

test('빈 질문은 버린다', () => {
  assert.deepEqual(maskQuestion('', known), { masked: null, dropped: true, reason: 'empty' });
  assert.deepEqual(maskQuestion('   ', known), { masked: null, dropped: true, reason: 'empty' });
});

test('명단이 없으면 이름 있는 질문은 전부 버린다 — 지울 근거가 없다', () => {
  assert.equal(maskQuestion('홍길동 왔어요?', {}).dropped, true);
  assert.equal(maskQuestion('퇴원 요청 어떻게 해요?', {}).dropped, false);
});

test('같은 이름이 여러 번 나와도 모두 지운다', () => {
  assert.equal(mask('홍길동이랑 김영희 둘 다 왔나요?').masked,
    `${MASK.student}이랑 ${MASK.student} 둘 다 왔나요?`);
});

test('"~해 주세요" 같은 어미를 이름으로 보지 않는다', () => {
  for (const q of [
    '결석 처리 좀 해 주세요',
    '문의사항은 어디에 남기죠?',
    '출결 어디서 보나요',
    '이거 어떻게 하죠',
  ]) {
    assert.equal(mask(q).dropped, false, q);
  }
});

test('어미를 걸러도 진짜 이름은 여전히 잡는다', () => {
  assert.equal(mask('최민서 왔어요?').dropped, true);
  assert.equal(mask('김영수는 어느 반이에요?').dropped, true);
});
