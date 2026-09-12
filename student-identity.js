import { digitsOf } from './phone.js';

// 학생 문서 ID = 이름_보호자전화(11자리는 선행 0만 뗀다). 생성 창구 4곳이 공유하는 레거시 정본.
// 이름을 trim하지 않는다 — 앞뒤 공백도 밑줄로 치환되던 기존 문서 ID와 어긋나지 않게.
export function studentDocId(name, guardianPhone) {
  const digits = digitsOf(guardianPhone);
  const phone = digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  const nameText = String(name ?? '');
  if (!nameText.trim() || !phone) return '';
  return `${nameText}_${phone}`.replace(/\s+/g, '_');
}

const ENDED_STATUSES = new Set(['퇴원', '종강']);

function compactName(value) {
  return String(value ?? '').replace(/\s+/g, '');
}

// 같은 보호자 전화로 미리 모은 후보({ id, data }[])에서 입력 이름의 학생을 찾는다.
// DB 수정 모드가 ID를 유지한 채 이름을 바꿀 수 있어 이름 일치 또는 ID 접두 일치로 판정.
// 2건 이상이면 활성(퇴원·종강 아님)을 우선하고 그래도 남으면 ambiguous.
export function matchStudentIdentity(candidates, { name } = {}) {
  const key = compactName(name);
  const matches = key
    ? (Array.isArray(candidates) ? candidates : []).filter((c) => compactName(c?.data?.name) === key
      || String(c?.id ?? '').startsWith(`${key}_`))
    : [];
  if (matches.length <= 1) return { match: matches[0] || null, ambiguous: [] };
  const active = matches.filter((c) => !ENDED_STATUSES.has(c?.data?.status));
  if (active.length === 1) return { match: active[0], ambiguous: [] };
  return { match: null, ambiguous: active.length > 1 ? active : matches };
}
