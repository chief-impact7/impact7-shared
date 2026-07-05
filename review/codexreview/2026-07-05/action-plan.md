# Action Plan

## 1. 런타임 correctness 먼저 수정

### `expected-arrival.js`

- `earliestExpectedTime()`의 `times.sort()[0]`를 분 단위 numeric 비교로 교체한다.
- `toMinutes()`를 내부에서 재사용하거나, 같은 파일 안에서 시간 후보 정규화 헬퍼를 만든다.
- 회귀 테스트:
  - `9:30` vs `10:00`
  - `09:30` vs `10:00`
  - schedule, `hwTasks`, `testTasks`, `extra_visit`, `absences.makeup_time` 혼합
  - 잘못된 시간 문자열은 기존 계약대로 무시할지, 사전식 fallback할지 명확히 결정

### `phone.js`

- `formatPhone()`이 항상 string을 반환하도록 맞춘다.
- 숫자 입력 테스트를 추가한다.

## 2. 공개 API 계약 문서 동기화

- `AGENTS.md`의 테스트 수를 현재 `233`개로 갱신한다.
- `package.json.exports`의 21개 subpath를 모두 문서화한다.
- 누락된 5개 모듈을 추가한다:
  - `./attendance-action`
  - `./expected-arrival`
  - `./attendance-log`
  - `./form-slug`
  - `./form-components`
- 잘못된 시그니처를 고친다:
  - `applyNaesinFreeDerivation(...) -> enrollment[]`
- 현재 공개 export 중 문서 누락된 심볼을 추가한다:
  - `businessDayKST`
  - `STUDENT_NUMBER_SOURCES`
  - `deriveFromSource`
  - `isValidStudentNumber`
  - `detectStudentNumberUpgrade`

## 3. 테스트 공백 보강

- `deriveLevelPeriod()`에 제품 계약을 먼저 명시한다.
- 말일/월초/윤년/1개월 미만 경계 테스트를 추가한다.
- 수정 후 `node --test --experimental-test-coverage`에서 `enrollment-derivation.js:148-165`가 남지 않는지 확인한다.

## 4. 릴리스/가드 신뢰성 강화

- `.omc/RELEASE_RULE.md`의 소비자 수를 workflow matrix와 맞춘다.
- `package.json`의 `exports`/`files`/실제 `.js`/`.test.js`/`AGENTS.md` 문서 동기화 검사를 스크립트화한다.
- pre-commit 또는 pre-push에서 최소한 export/files/test drift를 차단한다.
- lockfile을 두지 않는 정책이면 `npm audit`을 릴리스 게이트에서 제외하고, “의존성 없음 + 외부 import 없음” 정적 검사를 공식 게이트로 명시한다. audit을 유지하려면 `package-lock.json`을 추가한다.

## 권장 수정 순서

1. `expected-arrival.js` + 테스트
2. `phone.js` + 테스트
3. `AGENTS.md`, `.omc/RELEASE_RULE.md` 문서 동기화
4. export/files/test/docs 동기화 스크립트 추가
5. `npm test`
6. `node --test --experimental-test-coverage`
7. `npm pack --dry-run`
8. 필요 시 patch version bump 후 태그 릴리스

