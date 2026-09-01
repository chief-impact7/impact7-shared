// question-mask.js — 질문 원문에서 사람을 지운다 (단일 소스).
//
// 질문 원문은 그 학원 안에만 있어야 한다(원장 결정 2026-08-21). 그런데 "무엇을 물었나"를
// 전혀 모르면 제품을 고칠 수 없다. 그래서 사람만 지우고 문장은 남긴다.
//
// 사전식 추측이 아니라 그 학원의 실제 학생·직원 이름과 대조한다. 훨씬 정확하다.
// 확신이 안 서면 문장을 통째로 버린다 — 새는 것보다 표본이 적은 편이 낫다.

export const MASK = {
  student: '[학생]', phone: '[번호]', person: '[이름]',
  // 명단으로 확인하지 못하고 모양으로만 판정한 것. 물음표가 그 사실을 남긴다.
  unknown: '[이름?]',
};

// 미확인 이름이 이만큼 나오면 문장을 버린다. 하나는 살린다 —
// 마스킹하면 그 이름은 어차피 지워지고, 버리기가 막는 것은 "옆에 있을지 모르는 못 잡은 사람"이다.
// 미확인이 둘이면 명단이 그 문장에 못 미친다는 뜻이라 옆 사람이 있을 확률이 실제로 높다.
export const DROP_AT_UNKNOWN_NAMES = 2;

// 한 글자짜리는 지우지 않는다. 명단에는 "0"·"*"·"초" 같은 값이 실제로 섞여 있어
// 그대로 찾아 바꾸면 "8/20까지"가 "8/2[학생]까지"가 된다(2026-08-22 실측).
const MIN_NAME_CHARS = 2;

// 사람 이름은 한글로만 되어 있다. 명단에는 "ㅇㅇ"·"고2"·"*" 같은 값이 섞여 있고,
// 그대로 쓰면 "고2 몇명이야"가 "[학생] 몇명이야"가 된다.
const HANGUL_ONLY = /^[가-힣]+$/;

// 두 글자 값이 더 긴 낱말 속에 박혀 있으면 그건 그 낱말이지 이름이 아니다.
// 뒤에 조사가 오면 이름으로 본다 — "강해는"은 이름, "강해졌다"는 아니다.
const HANGUL = /[가-힣]/;

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

// 경음 규칙으로도 안 걸러지는 흔한 말. 여기 박아 두는 것은 씨앗뿐이고,
// 실제 목록은 호출자가 notNames로 넘긴다 — 쓰면서 쌓여야 품질이 오른다.
const SEED_NOT_NAMES = ['전체적', '문의사', '신청서', '성적표', '안내문'];

// 이름으로 보이는 부분만 돌려준다(조사는 뺀다). 이름이 아니면 null.
// 어디까지가 이름인지 알아야 "김영수는"을 "[이름?]는"으로 바꿀 수 있다.
function namePart(run, notNames) {
  if (hasTense(run)) return null;

  // 복성 + 이름 두 자. "남궁민수"는 세 자 규칙에 안 걸린다.
  if (run.length === 4 && COMPOUND_SURNAMES.has(run.slice(0, 2))) return run;

  const token = (run.length === 4 && PARTICLE.has(run[3])) ? run.slice(0, 3) : run;
  if (token.length !== 3) return null;
  if (VERB_TAIL.has(token[2])) return null;
  if (notNames.has(token)) return null;
  return SURNAMES.has(token[0]) ? token : null;
}

// 두 글자 이름이 더 긴 낱말 속에 있으면 지우지 않는다. 뒤가 조사면 이름으로 본다.
// 세 글자 이상은 낱말과 겹칠 일이 드물어 그대로 바꾼다.
function replaceEntry(text, needle, mask, replacements) {
  if (needle.length > MIN_NAME_CHARS) {
    const parts = text.split(needle);
    for (let i = 1; i < parts.length; i += 1) replacements.push({ text: needle, mask });
    return parts.join(mask);
  }

  let out = '';
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0) return out + text.slice(from);
    const next = text[at + needle.length];
    const isWord = next && HANGUL.test(next) && !PARTICLE.has(next);
    if (!isWord) replacements.push({ text: needle, mask });
    out += text.slice(from, at) + (isWord ? needle : mask);
    from = at + needle.length;
  }
}

/**
 * @param {string} text            질문 원문
 * @param {object} known           { studentNames, staffNames, notNames }
 *   notNames는 "이름이 아니라고 확인된 말" 목록이다. 쌓을수록 오탐이 줄어든다.
 * @returns {{ masked, dropped, reason, uncertain, tokens, replacements }}
 *   dropped=true면 쓰지 않는다. uncertain=true면 명단으로 확인하지 못한 이름이 있었다는 뜻이다.
 *   tokens는 그때 잡힌 말들 — 오탐이면 예외로 확정해 다음부터 지우지 않게 한다.
 */
export function maskQuestion(text, known = {}) {
  const source = String(text ?? '');
  if (!source.trim()) {
    return { masked: null, dropped: true, reason: 'empty', uncertain: false, tokens: [], replacements: [] };
  }

  // 예외는 두 곳 모두에 걸린다: 이름 모양 판정과, 명단에 잘못 들어간 값.
  const notNames = new Set([...SEED_NOT_NAMES, ...(known.notNames ?? []).map(norm)]);
  // 한 글자짜리와 한글이 아닌 값은 지우지 않는다 — 문장을 망가뜨리는 손해가 더 크다.
  const usable = (list) => [...new Set((list ?? [])
    .map(norm)
    .filter((v) => v.length >= MIN_NAME_CHARS && HANGUL_ONLY.test(v) && !notNames.has(v)))];

  // 학생과 직원을 한 줄로 세워 긴 것부터 지운다. 목록별로 따로 돌리면 짧은 쪽이
  // 긴 이름을 먼저 먹어 이름 일부가 그대로 남는다(2026-08-22 실측).
  const entries = [
    ...usable(known.studentNames).map((v) => [v, MASK.student]),
    ...usable(known.staffNames).map((v) => [v, MASK.person]),
  ].sort((a, b) => b[0].length - a[0].length);

  const replacements = [];
  const maskPhone = (text) => {
    replacements.push({ text, mask: MASK.phone });
    return MASK.phone;
  };
  let masked = source.replace(PHONE, maskPhone).replace(LONG_DIGITS, maskPhone);
  for (const [needle, mask] of entries) masked = replaceEntry(masked, needle, mask, replacements);

  // 지운 뒤에도 이름처럼 보이는 덩어리가 남으면 명단이 그 문장에 못 미친 것이다.
  // 명단에 없는 사람(형제·학부모·타 학원생)이 여기서 걸린다.
  const hits = [];
  for (const match of masked.matchAll(KOREAN_NAME)) {
    const part = namePart(match[0], notNames);
    if (part) hits.push({ index: match.index, part });
  }

  const tokens = hits.map((h) => h.part);
  replacements.push(...hits.map((hit) => ({ text: hit.part, mask: MASK.unknown })));
  if (hits.length >= DROP_AT_UNKNOWN_NAMES) {
    return {
      masked: null,
      dropped: true,
      reason: 'multiple_unknown_names',
      uncertain: true,
      tokens,
      replacements,
    };
  }
  // 뒤에서부터 바꿔야 앞 위치가 밀리지 않는다.
  for (const hit of hits.reverse()) {
    masked = masked.slice(0, hit.index) + MASK.unknown + masked.slice(hit.index + hit.part.length);
  }

  // 잡힌 말을 돌려준다 — 호출자가 후보로 쌓아 다음부터 오탐을 줄인다.
  return { masked, dropped: false, reason: null, uncertain: hits.length > 0, tokens, replacements };
}
