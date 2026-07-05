# Verification

## 통과한 검증

### CodeGraph

```sh
codegraph_status
```

결과:

```text
Files indexed: 44
Total nodes: 263
Total edges: 377
Languages: javascript 43, yaml 1
```

### 전체 테스트

```sh
npm test
```

결과:

```text
tests 233
pass 233
fail 0
duration_ms 1563.227334
```

### 테스트 커버리지

```sh
node --test --experimental-test-coverage
```

결과:

```text
tests 233
pass 233
fail 0
all files line 97.97%
all files branch 86.30%
all files funcs 97.58%
```

중요 미커버:

```text
enrollment-derivation.js | uncovered lines 148-165
```

### 패키징 표면

```sh
npm pack --dry-run
```

결과:

```text
@impact7/shared@1.40.0
package size: 21.4 kB
unpacked size: 59.9 kB
total files: 22
```

`package.json`의 `exports`와 `files` 차이는 없음:

```json
{
  "exportsOnly": [],
  "filesOnly": [],
  "sourceNotExported": [],
  "exportWithoutTest": [],
  "testWithoutSource": []
}
```

### 문법 검사

```sh
for f in *.js .agents/hooks/*.mjs; do node --check "$f" || exit 1; done
```

결과: 통과, 출력 없음.

### 순수 패키지 경계 정적 스캔

```sh
rg --pcre2 -n "^import .* from ['\"](?!\\./|node:)|from ['\"](?!\\./|node:)|require\\(['\"](?!\\./|node:)" -g '*.js' -g '!*.test.js' . || true
```

결과: 외부 런타임 패키지 import 없음.

```sh
rg -n "document|window|firebase|Firestore|Date\\(|toLocale|fetch\\(|localStorage|sessionStorage" -g '*.js' -g '!*.test.js' . || true
```

검토 결과:

- DOM/window/fetch/localStorage 사용 없음.
- `promote-enroll.js`의 `firebase`는 import가 아니라 팩토리 주입.
- `Date`/`toLocale`은 날짜 모듈과 날짜 파생 로직에서 의도된 사용.

### 작업트리

감사 시작 시점:

```sh
git status --short
```

결과: 출력 없음.

감사 문서 작성 후에는 `review/codexreview/2026-07-05/` 신규 문서만 추가됨.

## 실패 또는 제한된 검증

### npm audit

```sh
npm audit --omit=dev
```

결과:

```text
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
npm error audit Try creating one first with: npm i --package-lock-only
npm error audit Original error: loadVirtual requires existing shrinkwrap file
```

해석:

- 현재 취약점이 있다는 증거는 아니다.
- 하지만 lockfile이 없어 audit 재현성을 증명할 수 없다.
- 의존성이 없는 패키지라 직접 위험은 낮지만, 릴리스 게이트 관점에서는 “audit 불가” 상태로 기록해야 한다.

## 직접 재현한 버그

### `earliestExpectedTime()` 문자열 정렬

```sh
node --input-type=module -e "import { earliestExpectedTime } from './expected-arrival.js'; console.log(earliestExpectedTime({ enrollments:[{ schedule:{월:'9:30'}, level_symbol:'H', class_number:'101' },{ schedule:{월:'10:00'}, level_symbol:'H', class_number:'102' }], dayName:'월', classSettings:{}, date:'2026-07-06' }));"
```

결과:

```text
10:00
```

### `formatPhone()` 반환 타입

```sh
node --input-type=module -e "import { formatPhone } from './phone.js'; const v = formatPhone(123); console.log(typeof v, JSON.stringify(v));"
```

결과:

```text
number 123
```

