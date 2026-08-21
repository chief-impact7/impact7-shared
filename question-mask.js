// question-mask.js — 질문 원문에서 사람을 지운다 (단일 소스).
//
// 질문 원문은 그 학원 안에만 있어야 한다(원장 결정 2026-08-21). 그런데 "무엇을 물었나"를
// 전혀 모르면 제품을 고칠 수 없다. 그래서 사람만 지우고 문장은 남긴다.
//
// 사전식 추측이 아니라 그 학원의 실제 학생·직원 이름과 대조한다. 훨씬 정확하다.
// 확신이 안 서면 문장을 통째로 버린다 — 새는 것보다 표본이 적은 편이 낫다.

export const MASK = { student: '[학생]', phone: '[번호]', school: '[학교]', person: '[이름]' };

// 한국 이름처럼 보이는 덩어리. 조사가 붙어도 앞 2~4자를 잡는다.
const KOREAN_NAME = /[가-힣]{2,4}/g;
const PHONE = /\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const LONG_DIGITS = /\d{7,}/g;

const norm = (v) => String(v ?? '').trim().replace(/\s+/g, '');

// 명단으로 못 지운 이름을 잡는 두 번째 그물. 한국 이름은 성(닫힌 집합) + 1~2자 꼴이라
// "3자이면서 성으로 시작"이면 이름일 가능성이 높다. 오타·별명·형제 이름이 여기 걸린다
// — 어느 쪽이든 성은 그대로 남기 때문이다.
// 흔한 말("어디서"·"갔나요")은 성으로 시작하지 않아 통과한다.
const SURNAMES = new Set([
  ...'김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구',
  ...'민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국은편용',
]);

// 복성은 두 자다. 세 자 규칙에 안 걸려 그대로 새어나가므로 따로 본다.
const COMPOUND_SURNAMES = new Set(['남궁', '황보', '제갈', '선우', '독고', '사공', '서문', '동방']);

// 조사가 붙어 4자로 잡힌 것도 떼고 본다 — "김영수는"의 이름은 앞 3자다.
const PARTICLE = new Set(['은', '는', '이', '가', '을', '를', '도', '만', '의', '와', '과', '에', '로', '랑', '님']);

// 이름은 이렇게 끝나지 않는다. "주세요"·"남기죠"처럼 성으로 시작하는 흔한 어미를 걸러낸다
// — 이걸 안 하면 "~해 주세요"가 붙은 질문이 전부 버려진다.
const VERB_TAIL = new Set(['요', '죠', '까', '다', '네', '까', '군', '냐', '지']);

// 한국 이름에는 경음(ㄲㄸㅃㅆㅉ)이 없다. "이쫑수"·"이따희" 같은 이름은 존재하지 않는다.
// 그래서 경음이 섞였으면 이름이 아니다 — "한꺼번"·"오늘까"가 여기서 걸러진다.
// 오타 난 이름("홍길똥")도 이 규칙으로 통과한다. 실제 학생을 식별하지 못하는 글자를
// 지키려다 멀쩡한 질문을 버릴 이유가 없다(원장 판단 2026-08-21).
// 초성뿐 아니라 종성도 본다 — 이름 전체에 경음이 없다.
// 종성까지 보면 "안았어"처럼 성으로 시작하는 활용형이 이름으로 오인되지 않는다.
const TENSE_INITIAL = new Set([1, 4, 8, 10, 13]);   // ㄲ ㄸ ㅃ ㅆ ㅉ
const TENSE_FINAL = new Set([2, 20]);               // ㄲ ㅆ

function hasTense(text) {
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) continue;
    if (TENSE_INITIAL.has(Math.floor(code / 588))) return true;
    if (TENSE_FINAL.has(code % 28)) return true;
  }
  return false;
}

// 경음 규칙으로도 안 걸러지는 흔한 말. 늘려야 할 만큼 버려지면 그때 추가한다.
const NOT_NAMES = new Set(['전체적', '문의사', '신청서', '성적표', '안내문']);

function looksLikeName(run) {
  if (hasTense(run)) return false;

  // 복성 + 이름 두 자. "남궁민수"는 세 자 규칙에 안 걸린다.
  if (run.length === 4 && COMPOUND_SURNAMES.has(run.slice(0, 2))) return true;

  let token = run;
  if (token.length === 4 && PARTICLE.has(token[3])) token = token.slice(0, 3);
  if (token.length !== 3) return false;
  if (VERB_TAIL.has(token[2])) return false;
  if (NOT_NAMES.has(token)) return false;
  return SURNAMES.has(token[0]);
}

/**
 * @param {string} text            질문 원문
 * @param {object} known           { studentNames: string[], staffNames: string[], schoolNames: string[] }
 * @returns {{ masked: string|null, dropped: boolean, reason: string|null }}
 *   dropped=true면 쓰지 않는다. masked는 null이다.
 */
export function maskQuestion(text, known = {}) {
  const source = String(text ?? '');
  if (!source.trim()) return { masked: null, dropped: true, reason: 'empty' };

  const students = new Set((known.studentNames ?? []).map(norm).filter(Boolean));
  const staff = new Set((known.staffNames ?? []).map(norm).filter(Boolean));
  const schools = new Set((known.schoolNames ?? []).map(norm).filter(Boolean));

  let masked = source.replace(PHONE, MASK.phone).replace(LONG_DIGITS, MASK.phone);

  // 긴 것부터 지운다 — "양정중"을 먼저 지우면 "양정중학교"가 조각으로 남는다.
  for (const name of [...schools].sort((a, b) => b.length - a.length)) {
    masked = masked.split(name).join(MASK.school);
  }
  for (const name of [...students].sort((a, b) => b.length - a.length)) {
    masked = masked.split(name).join(MASK.student);
  }
  for (const name of [...staff].sort((a, b) => b.length - a.length)) {
    masked = masked.split(name).join(MASK.person);
  }

  // 지운 뒤에도 사람 이름처럼 보이는 덩어리가 남으면 확신할 수 없다 — 버린다.
  // 명단에 없는 학생(오타·별명·형제)이 여기서 걸린다.
  const leftovers = (masked.match(KOREAN_NAME) ?? []).filter(looksLikeName);
  if (leftovers.length) return { masked: null, dropped: true, reason: 'unmasked_name' };

  return { masked, dropped: false, reason: null };
}
