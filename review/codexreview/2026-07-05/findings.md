# Findings

## HIGH

### 1. 예정 등원 시각이 문자열 정렬로 오판됨

- 파일: `expected-arrival.js:44`, `expected-arrival.js:60`, `expected-arrival.js:83`
- 상태: 재현 완료
- 영향: DSC/태블릿이 공유하는 예정 등원 시각과 지각 판정이 실제보다 늦게 잡힐 수 있다.

`earliestExpectedTime()`은 여러 출처의 시간을 모은 뒤 `times.sort()[0]`로 가장 이른 시간을 고른다. 같은 파일의 `toMinutes()`는 `9:30` 같은 1자리 hour 형식을 허용한다. 즉 시스템은 1자리 시간을 유효하게 받아들이면서, 최솟값 선택은 사전식 정렬로 수행한다.

재현:

```sh
node --input-type=module -e "import { earliestExpectedTime } from './expected-arrival.js'; console.log(earliestExpectedTime({ enrollments:[{ schedule:{월:'9:30'}, level_symbol:'H', class_number:'101' },{ schedule:{월:'10:00'}, level_symbol:'H', class_number:'102' }], dayName:'월', classSettings:{}, date:'2026-07-06' }));"
```

결과:

```text
10:00
```

기대값은 `9:30`이다.

권장 수정:

- `toMinutes()` 또는 같은 기준의 파서를 재사용해 numeric sort로 비교한다.
- `9:30`, `09:30`, `10:00`이 섞인 정규 schedule/task/extra_visit/absence 보충 케이스를 회귀 테스트로 추가한다.

## MEDIUM

### 2. `formatPhone()`이 문서상 string 반환 계약을 깸

- 파일: `phone.js:3`, `phone.js:6`, `AGENTS.md:150`, `AGENTS.md:154`
- 상태: 재현 완료
- 영향: 소비자가 `formatPhone()` 결과를 문자열로 가정해 `.trim()`이나 문자열 결합을 수행하면 런타임 오류 또는 타입 drift가 날 수 있다.

`AGENTS.md`는 `formatPhone(phone) -> string` 계약으로 설명한다. 구현은 11자리 외 입력에 대해 `phone ?? ''`를 그대로 반환한다.

재현:

```sh
node --input-type=module -e "import { formatPhone } from './phone.js'; const v = formatPhone(123); console.log(typeof v, JSON.stringify(v));"
```

결과:

```text
number 123
```

권장 수정:

- 비 11자리 입력도 `String(phone ?? '')`로 반환하도록 맞춘다.
- 숫자 입력 회귀 테스트를 추가한다.

### 3. 공개 API 문서가 실제 export 표면과 불일치

- 파일: `package.json:6`, `package.json:27`, `AGENTS.md:14`, `AGENTS.md:172`
- 상태: 스크립트로 확인
- 영향: 이 repo는 `AGENTS.md`가 에이전트 운영 계약이자 공개 API 카탈로그 역할을 한다. 문서 누락은 다음 릴리스/소비자 반영에서 API를 놓치게 만든다.

`package.json`에는 아래 subpath가 공개되어 있지만 `AGENTS.md`의 모듈 목록에는 없다.

```text
attendance-action
expected-arrival
attendance-log
form-slug
form-components
```

확인 명령:

```sh
node - <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const agents = fs.readFileSync('AGENTS.md', 'utf8');
for (const key of Object.keys(pkg.exports)) {
  const name = key.slice(2);
  if (!agents.includes('`./' + name + '`')) console.log(name);
}
NODE
```

추가 drift:

- `AGENTS.md:51`의 `applyNaesinFreeDerivation` 반환형이 `enrollment`로 적혀 있으나 실제 구현은 배열을 반환한다.
- `datetime.js`의 `businessDayKST`, `student-number.js`의 `STUDENT_NUMBER_SOURCES`, `deriveFromSource`, `isValidStudentNumber`, `detectStudentNumberUpgrade` 등 현재 export 일부가 문서 표에 없다.

권장 수정:

- `AGENTS.md` 모듈 표를 `package.json.exports` 기준으로 1:1 동기화한다.
- export/files/test/문서 동기화 검증 스크립트를 추가하고 릴리스 게이트에 넣는다.

### 4. `deriveLevelPeriod()` 월수 계산 경계와 테스트 공백

- 파일: `enrollment-derivation.js:147`, `enrollment-derivation.js:157`
- 상태: 독립 리뷰 레인 지적, coverage로 테스트 공백 확인
- 영향: `2026-01-31`부터 `2026-02-01` 같은 경계에서 완료된 개월 수가 과대 표시될 수 있다.

커버리지 결과에서 `enrollment-derivation.js`의 `148-165` 라인이 미커버로 남았다. 이 범위가 `deriveLevelPeriod()`의 주요 계산부다.

권장 수정:

- “완료된 개월 수” 정의를 제품 계약으로 명확히 한다.
- 월 단위 계산이면 `today.getDate() < startD.getDate()` 경계에서 1개월을 빼는 식으로 고친다.
- 1개월 미만, 말일, 윤년, 졸업/레벨 변화 케이스를 테스트한다.

## LOW

### 5. 릴리스 문서와 실제 소비자 matrix 불일치

- 파일: `.omc/RELEASE_RULE.md:15`, `.omc/RELEASE_RULE.md:16`, `.github/workflows/notify-consumers.yml:16`
- 영향: 릴리스 후 확인 범위를 잘못 잡을 수 있다.

`.omc/RELEASE_RULE.md`는 소비자 4곳이라고 설명한다. 실제 workflow matrix는 6곳이다.

```text
impact7DB, impact7HR, exam, impact7newDSC, DashBoard, impact7forms
```

권장 수정:

- 릴리스 문서를 현재 matrix 기준으로 갱신한다.
- 가능하면 소비자 목록을 문서와 workflow에서 중복 관리하지 않도록 체크 스크립트를 둔다.

