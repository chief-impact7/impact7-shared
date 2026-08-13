// 나이스(NEIS) 학교 공공정보 파싱·매칭. 수집 서버와 표시 앱이 같은 규칙을 쓰게 하는 순수 로직.
import { canonicalSchoolLabel } from './student-label.js';

// 나이스 급식식단정보 알레르기 유발식품 코드(1~19).
export const NEIS_ALLERGEN_LABELS = Object.freeze({
  1: '난류',
  2: '우유',
  3: '메밀',
  4: '땅콩',
  5: '대두',
  6: '밀',
  7: '고등어',
  8: '게',
  9: '새우',
  10: '돼지고기',
  11: '복숭아',
  12: '토마토',
  13: '아황산류',
  14: '호두',
  15: '닭고기',
  16: '쇠고기',
  17: '오징어',
  18: '조개류(굴·전복·홍합 포함)',
  19: '잣',
});

// 요리명 끝에 붙는 알레르기 표기. "(5.6.)"·"5.10.13."·"1,2"·전각 괄호·공백 변형을 모두 흡수한다.
const ALLERGEN_TAIL_RE = /\s*(?:[(（]\s*([\d.,\s]+?)\s*[)）]|(\d[\d.,\s]*))\s*$/;
const DISH_SEPARATOR_RE = /<br\s*\/?>|[\r\n]+/i;

// 나이스 요리명 한 건을 { name, allergens }로. 표기가 규격을 벗어나면 원문을 name으로 보존한다 —
// 급식 화면은 알레르기를 못 읽더라도 메뉴 자체는 반드시 보여야 한다.
export function parseMealDish(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { name: '', allergens: [] };

  const m = text.match(ALLERGEN_TAIL_RE);
  if (!m) return { name: text, allergens: [] };

  const name = text.slice(0, m.index).trim();
  const codes = (m[1] ?? m[2]).split(/\D+/).filter(Boolean).map(Number);
  if (!name || !codes.length || codes.some((code) => !NEIS_ALLERGEN_LABELS[code])) {
    return { name: text, allergens: [] };
  }
  return { name, allergens: [...new Set(codes)] };
}

// 나이스 DDISH_NM 필드(요리 여러 개가 <br/>로 이어진 문자열) 전체를 파싱.
export function parseMealDishes(dishText) {
  return String(dishText ?? '')
    .split(DISH_SEPARATOR_RE)
    .map(parseMealDish)
    .filter((dish) => dish.name);
}

// 학교명 매칭 키. 학생 마스터의 자유 텍스트와 나이스 정식 학교명을 같은 키로 떨어뜨린다.
// 학교급 접미·지역명·약어 통일은 canonicalSchoolLabel이 이미 SSoT이므로 재사용하고,
// 여기서는 나이스 표기에만 있는 괄호 부가어("(분교)")와 공백만 걷어낸다.
export function normalizeSchoolMatchKey(name) {
  const stripped = String(name ?? '')
    .replace(/[(（][^)）]*[)）]/g, '')
    .replace(/\s+/g, '');
  return canonicalSchoolLabel(stripped);
}

export function matchSchoolName(studentSchool, neisSchoolName) {
  const key = normalizeSchoolMatchKey(studentSchool);
  return key !== '' && key === normalizeSchoolMatchKey(neisSchoolName);
}
