import test from 'node:test';
import assert from 'node:assert/strict';
import { maskQuestion, MASK } from './question-mask.js';

const known = {
  studentNames: ['홍길동', '김영희', '이서준'],
  staffNames: ['박선생'],
};
const mask = (q) => maskQuestion(q, known);

test('명단에 있는 학생 이름을 지우고 문장은 남긴다', () => {
  const r = mask('홍길동 3월에 환불받은 거 어떻게 처리해요?');
  assert.equal(r.dropped, false);
  assert.equal(r.masked, `${MASK.student} 3월에 환불받은 거 어떻게 처리해요?`);
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

test('명단에 없는 이름 하나는 [이름?]으로 지우고 문장은 살린다', () => {
  const r = mask('최민서 오늘 왔어요?');
  assert.equal(r.dropped, false);
  assert.equal(r.masked, `${MASK.unknown} 오늘 왔어요?`);
  assert.equal(r.uncertain, true);   // 명단이 못 미쳤다는 사실은 남긴다
});

test('조사는 남기고 이름만 바꾼다', () => {
  assert.equal(mask('김영수는 어느 반이에요?').masked, `${MASK.unknown}는 어느 반이에요?`);
});

test('미확인 이름이 둘이면 버린다 — 못 잡은 사람이 옆에 있을 확률이 높다', () => {
  const r = mask('최민서랑 김영수 둘 다 결석이래요');
  assert.equal(r.dropped, true);
  assert.equal(r.reason, 'multiple_unknown_names');
});

test('명단으로 확인된 이름은 불확실이 아니다', () => {
  const r = mask('홍길동 왔어요?');
  assert.equal(r.uncertain, false);
  assert.equal(r.masked, `${MASK.student} 왔어요?`);
});

test('경음이 섞이면 이름이 아니다 — 한국 이름에 ㄲㄸㅃㅆㅉ은 없다', () => {
  // 오타 난 이름은 실제 학생을 식별하지 못한다. 지키려다 멀쩡한 질문을 버리지 않는다.
  assert.equal(mask('홍길똥 오늘 왔나요?').dropped, false);
  assert.equal(mask('이따희 왔어요?').dropped, false);
  // 흔한 말도 임시 목록 없이 이 규칙으로 통과한다.
  assert.equal(mask('여러 명 한꺼번에 출결 바꾸는 법').dropped, false);
  assert.equal(mask('오늘까지 결석 처리 안 된 학생').dropped, false);
  // 종성 경음도 본다 — 성으로 시작하는 활용형이 이름으로 오인되지 않는다.
  assert.equal(mask('안았어 뭐라고요?').dropped, false);
});

test('명단에 없는 형제도 성이 같아 잡힌다', () => {
  assert.equal(mask('김영수는 어느 반이에요?').uncertain, true);
});

test('성으로 시작하지 않는 흔한 말은 이름으로 보지 않는다', () => {
  for (const q of ['어디서 확인해요?', '갔나요 안 갔나요?', '그다음 뭐 하죠?']) {
    assert.equal(mask(q).dropped, false, q);
  }
});

test('빈 질문은 버린다', () => {
  assert.equal(maskQuestion('', known).dropped, true);
  assert.equal(maskQuestion('   ', known).reason, 'empty');
});

test('명단이 없어도 이름 모양은 지운다 — 다만 불확실로 남긴다', () => {
  const r = maskQuestion('홍길동 왔어요?', {});
  assert.equal(r.masked, `${MASK.unknown} 왔어요?`);
  assert.equal(r.uncertain, true);
  assert.equal(maskQuestion('퇴원 요청 어떻게 해요?', {}).uncertain, false);
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
  assert.equal(mask('최민서 왔어요?').uncertain, true);
  assert.equal(mask('김영수는 어느 반이에요?').uncertain, true);
});

test('복성은 두 자라 세 자 규칙에 안 걸린다 — 따로 본다', () => {
  assert.equal(mask('남궁민수 어느 반이죠?').masked, `${MASK.unknown} 어느 반이죠?`);
  assert.equal(mask('남궁민수는 어느 반이죠?').uncertain, true);
  assert.equal(mask('황보라온 왔나요?').uncertain, true);
});

test('명단에 있으면 복성이라도 지우고 문장은 남긴다', () => {
  const r = maskQuestion('남궁민수 왔나요?', { studentNames: ['남궁민수'] });
  assert.equal(r.dropped, false);
  assert.equal(r.masked, `${MASK.student} 왔나요?`);
});

test('한 글자짜리 명단 값은 지우지 않는다 — 문장을 망가뜨린다', () => {
  // 명단에 "0"·"*"·"초"가 실제로 섞여 있다(2026-08-22 실측).
  const dirty = { studentNames: ['0', '*', '초', '김영희'], staffNames: [] };
  assert.equal(maskQuestion('8/20까지 휴원을 연장하려면', dirty).masked, '8/20까지 휴원을 연장하려면');
  assert.equal(maskQuestion('김영희 왔나요?', dirty).masked, `${MASK.student} 왔나요?`);
});

test('notNames는 이름 모양 판정을 막는다', () => {
  const q = '지각처리를 여기서 할 수 있나?';
  assert.equal(mask(q).masked, `지각처리를 ${MASK.unknown} 할 수 있나?`);
  assert.equal(maskQuestion(q, { ...known, notNames: ['여기서'] }).masked, q);
});

test('notNames는 명단에 잘못 들어간 값도 막는다', () => {
  // 명단에 잘못 들어간 흔한 말은 예외로 막는다.
  const dirty = { studentNames: ['등원'], staffNames: [] };
  assert.equal(maskQuestion('오늘 등원은 몇명?', dirty).masked, `오늘 ${MASK.student}은 몇명?`);
  assert.equal(maskQuestion('오늘 등원은 몇명?', { ...dirty, notNames: ['등원'] }).masked, '오늘 등원은 몇명?');
});

test('짧은 이름이 긴 이름을 먼저 먹지 않는다', () => {
  // 목록별로 따로 돌리면 짧은 쪽이 먼저 걸려 이름 일부가 그대로 남았다(2026-08-22).
  const dirty = { studentNames: ['조원근'], staffNames: ['조원'] };
  assert.equal(maskQuestion('오늘 조원근 결석이유는?', dirty).masked, `오늘 ${MASK.student} 결석이유는?`);
});

test('한글이 아닌 명단 값은 지우지 않는다', () => {
  // 명단에 "ㅇㅇ"·"고2"·"*"가 실제로 들어 있다.
  const dirty = { studentNames: ['ㅇㅇ', '고2', '*'], staffNames: [] };
  assert.equal(maskQuestion('고2 몇명이야?', dirty).masked, '고2 몇명이야?');
});

test('두 글자 이름은 낱말 속에 박혀 있으면 지우지 않는다', () => {
  const dirty = { studentNames: ['강해'], staffNames: [] };
  assert.equal(maskQuestion('바람이 강해졌어', dirty).masked, '바람이 강해졌어');
  assert.equal(maskQuestion('강해는 왔어?', dirty).masked, `${MASK.student}는 왔어?`);
});

test('예외로 막힌 이름은 불확실로도 세지 않는다', () => {
  const r = maskQuestion('지각처리를 여기서 할 수 있나?', { ...known, notNames: ['여기서'] });
  assert.equal(r.uncertain, false);
  assert.equal(r.dropped, false);
});

test('잡힌 말을 돌려준다 — 오탐이면 예외로 확정할 수 있어야 한다', () => {
  assert.deepEqual(mask('지각처리를 여기서 할 수 있나?').tokens, ['여기서']);
  assert.deepEqual(mask('홍길동 왔어요?').tokens, []);
  // 버려진 문장에서도 무엇이 걸렸는지는 알아야 한다.
  assert.deepEqual(mask('최민서랑 김영수 둘 다 결석').tokens, ['최민서', '김영수']);
});
