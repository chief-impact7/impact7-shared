import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEIS_ALLERGEN_LABELS,
  parseMealDish,
  parseMealDishes,
  normalizeSchoolMatchKey,
  matchSchoolName,
} from './school-info.js';

test('NEIS_ALLERGEN_LABELS: 1~19 전 코드에 라벨이 있다', () => {
  for (let code = 1; code <= 19; code += 1) {
    assert.equal(typeof NEIS_ALLERGEN_LABELS[code], 'string', `${code}번 라벨`);
  }
  assert.equal(NEIS_ALLERGEN_LABELS[1], '난류');
  assert.equal(NEIS_ALLERGEN_LABELS[10], '돼지고기');
  assert.equal(NEIS_ALLERGEN_LABELS[18], '조개류(굴·전복·홍합 포함)');
  assert.equal(NEIS_ALLERGEN_LABELS[19], '잣');
  assert.equal(NEIS_ALLERGEN_LABELS[20], undefined);
});

test('NEIS_ALLERGEN_LABELS: 동결되어 수정되지 않는다', () => {
  assert.throws(() => { NEIS_ALLERGEN_LABELS[1] = '변경'; }, TypeError);
});

test('parseMealDish: 알레르기 없는 요리명', () => {
  assert.deepEqual(parseMealDish('현미밥'), { name: '현미밥', allergens: [] });
  assert.deepEqual(parseMealDish('  깍두기  '), { name: '깍두기', allergens: [] });
});

test('parseMealDish: 괄호 표기', () => {
  assert.deepEqual(parseMealDish('미역국 (5.6.)'), { name: '미역국', allergens: [5, 6] });
  assert.deepEqual(parseMealDish('돼지갈비찜(5.6.10.13.)'), { name: '돼지갈비찜', allergens: [5, 6, 10, 13] });
  assert.deepEqual(parseMealDish('우유 (2.)'), { name: '우유', allergens: [2] });
});

test('parseMealDish: 괄호 없는 마침표 표기', () => {
  assert.deepEqual(parseMealDish('불고기5.10.13.'), { name: '불고기', allergens: [5, 10, 13] });
  assert.deepEqual(parseMealDish('배추김치 9.13.'), { name: '배추김치', allergens: [9, 13] });
});

test('parseMealDish: 구분자·괄호·공백 변형을 관대하게 흡수', () => {
  assert.deepEqual(parseMealDish('모듬튀김 ( 1, 5, 6 )'), { name: '모듬튀김', allergens: [1, 5, 6] });
  assert.deepEqual(parseMealDish('탕수육（10.13.）'), { name: '탕수육', allergens: [10, 13] });
  assert.deepEqual(parseMealDish('계란찜  1 . 5 .'), { name: '계란찜', allergens: [1, 5] });
});

test('parseMealDish: 중복 코드는 한 번만', () => {
  assert.deepEqual(parseMealDish('잡채 (5.5.6.)'), { name: '잡채', allergens: [5, 6] });
});

test('parseMealDish: 코드 범위(1~19) 밖이면 원문을 잃지 않는다', () => {
  assert.deepEqual(parseMealDish('흑미밥(100)'), { name: '흑미밥(100)', allergens: [] });
  assert.deepEqual(parseMealDish('두부조림 (0.)'), { name: '두부조림 (0.)', allergens: [] });
});

test('parseMealDish: 숫자가 요리명 일부면 알레르기로 읽지 않는다', () => {
  assert.deepEqual(parseMealDish('우유(200ml)'), { name: '우유(200ml)', allergens: [] });
  assert.deepEqual(parseMealDish('오미자차 100ml'), { name: '오미자차 100ml', allergens: [] });
});

test('parseMealDish: 요리명 없이 코드만 있으면 원문 유지', () => {
  assert.deepEqual(parseMealDish('5.6.'), { name: '5.6.', allergens: [] });
  assert.deepEqual(parseMealDish('( )'), { name: '( )', allergens: [] });
});

test('parseMealDish: nullish·비문자열은 빈 이름', () => {
  assert.deepEqual(parseMealDish(null), { name: '', allergens: [] });
  assert.deepEqual(parseMealDish(undefined), { name: '', allergens: [] });
  assert.deepEqual(parseMealDish('   '), { name: '', allergens: [] });
});

test('parseMealDishes: 나이스 DDISH_NM 원문 파싱', () => {
  const raw = '기장밥 <br/>미역국 (5.6.)<br/>돼지갈비찜 (5.6.10.13.)<br/>배추김치 (9.13.)<br/>우유 (2.)';
  assert.deepEqual(parseMealDishes(raw), [
    { name: '기장밥', allergens: [] },
    { name: '미역국', allergens: [5, 6] },
    { name: '돼지갈비찜', allergens: [5, 6, 10, 13] },
    { name: '배추김치', allergens: [9, 13] },
    { name: '우유', allergens: [2] },
  ]);
});

test('parseMealDishes: <br> 표기 변형과 줄바꿈, 빈 조각 제거', () => {
  const raw = '현미밥<BR/>미역국 (5.6.)<br />\n불고기5.10.13.<br/>';
  assert.deepEqual(parseMealDishes(raw), [
    { name: '현미밥', allergens: [] },
    { name: '미역국', allergens: [5, 6] },
    { name: '불고기', allergens: [5, 10, 13] },
  ]);
});

test('parseMealDishes: nullish·빈 문자열은 빈 배열', () => {
  assert.deepEqual(parseMealDishes(null), []);
  assert.deepEqual(parseMealDishes(''), []);
  assert.deepEqual(parseMealDishes('<br/><br/>'), []);
});

test('normalizeSchoolMatchKey: 축약형과 정식명이 같은 키', () => {
  assert.equal(normalizeSchoolMatchKey('대현초'), normalizeSchoolMatchKey('대현초등학교'));
  assert.equal(normalizeSchoolMatchKey('금옥중'), normalizeSchoolMatchKey('금옥중학교'));
  assert.equal(normalizeSchoolMatchKey('양정고'), normalizeSchoolMatchKey('양정고등학교'));
  assert.equal(normalizeSchoolMatchKey('봉영여중'), normalizeSchoolMatchKey('봉영여자중학교'));
});

test('normalizeSchoolMatchKey: 나이스 정식명의 지역명 prefix를 흡수', () => {
  assert.equal(normalizeSchoolMatchKey('서울대현초등학교'), '대현초');
  assert.equal(normalizeSchoolMatchKey('서울 대현초'), '대현초');
});

test('normalizeSchoolMatchKey: 괄호 부가어와 공백 제거', () => {
  assert.equal(normalizeSchoolMatchKey('대현초등학교(분교)'), '대현초');
  assert.equal(normalizeSchoolMatchKey('대현 초등학교 （본교）'), '대현초');
});

test('normalizeSchoolMatchKey: 학교유형 지역명은 정식명이라 유지', () => {
  assert.equal(normalizeSchoolMatchKey('경기과학고등학교'), normalizeSchoolMatchKey('경기과학고'));
  assert.equal(normalizeSchoolMatchKey('경기과학고'), '경기과학고');
});

test('normalizeSchoolMatchKey: 학교명 자체가 학부글자로 끝나도 정식명과 이어진다', () => {
  assert.equal(normalizeSchoolMatchKey('안중중학교'), normalizeSchoolMatchKey('안중중'));
});

test('normalizeSchoolMatchKey: 빈값·nullish는 빈 키', () => {
  assert.equal(normalizeSchoolMatchKey(''), '');
  assert.equal(normalizeSchoolMatchKey(null), '');
  assert.equal(normalizeSchoolMatchKey('   '), '');
});

test('matchSchoolName: 학생 자유 텍스트와 나이스 정식명 일치', () => {
  assert.equal(matchSchoolName('대현초', '서울대현초등학교'), true);
  assert.equal(matchSchoolName('봉영여중', '봉영여자중학교'), true);
  assert.equal(matchSchoolName('금옥중학교', '금옥중'), true);
});

test('matchSchoolName: 다른 학교는 false', () => {
  assert.equal(matchSchoolName('대현초', '대현중학교'), false);
  assert.equal(matchSchoolName('대현초', '신대현초등학교'), false);
});

test('matchSchoolName: 학부를 판정할 수 없는 축약은 일치시키지 않는다', () => {
  // '안중'은 학교명 자체가 '중'으로 끝나는 예외라 학부 미상 — 오매칭보다 미매칭이 안전하다.
  assert.equal(matchSchoolName('안중', '안중중학교'), false);
});

test('matchSchoolName: 빈값은 항상 false', () => {
  assert.equal(matchSchoolName('', '대현초등학교'), false);
  assert.equal(matchSchoolName('대현초', ''), false);
  assert.equal(matchSchoolName(null, null), false);
});
