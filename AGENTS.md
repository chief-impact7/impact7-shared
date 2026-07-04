# impact7-shared — 다중 에이전트 운영 계약

Claude Code · Codex · Antigravity 등 모든 AI 에이전트가 이 파일을 따른다.

## 패키지 정체

`@impact7/shared` — impact7 에코시스템의 **순수 로직 SSoT**.
- DB·DSC·Forms 등 소비자가 `npm i` 로 갱신해 사용한다.
- 의존성 없음. DOM·Firebase·날짜 라이브러리 import 금지.
- 테스트: `npm test` (`node --test`). 현재 193개 통과.

## 모듈 목록 및 공개 API

### `./history` — `history-classifier.js`

수업이력 로그를 교사용 7종 이벤트로 분류. DB·DSC가 동일 컬렉션 공유.

| 심볼 | 종류 | 시그니처 / 값 |
|------|------|--------------|
| `HISTORY_BADGE` | const | `{ '신규'|'복귀'|'재등원'|'수업추가': 'badge-enroll', '전반'|'휴원': 'badge-update', '퇴원': 'badge-withdraw' }` |
| `classifyHistory` | fn | `(log) → { label, from, to } \| null` |
| `parseStatusClass` | fn | `(text) → { status, classes, pauseStart }` |
| `shortAuthor` | fn | `(emailOrId) → string` — `@` 앞만, 비문자열→`'system'` |
| `isAttendedStatus` | fn | `(status) → boolean` — 출석/지각/조퇴만 true |
| `deriveTenure` | fn | `(logs, getDate, attendances, isCurrentlyEnrolled?) → { start, end, startEvent }` |

### `./enrollment-status` — `enrollment-status.js`

재원상태↔enrollment 정합성 SSoT. 가장 많이 참조되는 계약.

| 심볼 | 종류 | 시그니처 / 값 |
|------|------|--------------|
| `ENROLLABLE_STATUSES` | const | `Set { '재원', '등원예정', '실휴원', '가휴원' }` |
| `NON_ENROLLABLE_STATUSES` | const | `Set { '상담', '퇴원', '종강' }` |
| `STUDENT_STATUS_GROUPS` | const | `[{ category: '재원생'\|'비원생', statuses: [...] }]` |
| `STATUS_TONE` | const | `{ status: 'active'\|'scheduled'\|'paused'\|'consult'\|'ended-hard'\|'ended-soft' }` |
| `INITIAL_STATUSES` | const | `['등원예정', '재원']` |
| `isEnrollableStatus` | fn | `(status) → boolean` |
| `hasRealEnrollment` | fn | `(enrollments) → boolean` — 빈 placeholder 제외 |
| `reconcileEnrollments` | fn | `(status, enrollments) → { enrollments, valid, reason? }` |
| `studentCategory` | fn | `(status) → '재원생' \| '비원생'` |
| `selectableStatuses` | fn | `(current, isNew) → string[]` |

### `./enrollment-derivation` — `enrollment-derivation.js`

enrollment 배열에서 파생 계산. classSettings를 참조.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `enrollmentCode` | fn | `(e) → level_symbol+class_number` — 예: `'HA101'`. 아래 두 함수의 옵션 기본값 |
| `applyNaesinFreeDerivation` | fn | `(current, { classSettings, dateStr, resolveNaesinCsKey, enrollmentCode? }) → enrollment` |
| `deriveActiveNaesinEnrollment` | fn | `(current, { classSettings, dateStr, resolveNaesinCsKey }) → enrollment\|null` — 활성 내신 enrollment(명시/파생) 또는 null. 아래 predicate와 applyNaesinFreeDerivation의 SSoT |
| `isNaesinActiveAt` | fn | `(current, { classSettings, dateStr, resolveNaesinCsKey }) → boolean` — 기준일 내신기간 활성 여부. 내신 active 판정은 로컬 재구현 말고 이 함수 사용(current는 호출자가 날짜 필터한 활성 enrollment 배열) |
| `deriveClassPeriodHistory` | fn | `(enrollments, classSettings, { enrollmentCode? }?) → [{ class_type, code, start_date, end_date }]` |
| `deriveLevelPeriod` | fn | `(enrollments, todayStr) → { start: string\|null, label: string }` |

### `./class-move` — `class-move.js`

특정 학기 정규 enrollment를 다른 반으로 이동 (순수 함수, in-place 아님).

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `moveClass` | fn | `(student, { semester, targetLevelSymbol, targetClassNumber }) → { updatedEnrollments, before, after, skipped, warning }` |

### `./promote-enroll` — `promote-enroll.js`

등원예정→재원 자동전환. Firebase 의존성을 팩토리로 주입.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `createPromoteEnrollPending` | fn | `(firebase, { idField?, batchUpdate? }) → async (students, today) → pending[]` |

### `./student-number` — `student-number.js`

전화번호 기반 6자리 학생번호 파생 + identity key.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `deriveStudentNumber` | fn | `(student) → { studentNumber: string, source: string }` |
| `studentNumberNameKey` | fn | `(name) → string` — 공백 제거 |
| `studentNumberIdentityKey` | fn | `(name, studentNumber) → string` — `'이름|번호'` 또는 `''` |
| `normalizeRegistrationNo` | fn | `(raw) → string` — 비교용 등록번호 정규화 (010 prefix·00 패딩 제거), 저장·표시용 아님 |

### `./student-label` — `student-label.js`

학교·학부·학년 라벨 SSoT. 지역명 제거·약어·졸업 처리 포함.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `SCHOOL_FIELD` | const | `{ '초등': 'school_elementary', '중등': 'school_middle', '고등': 'school_high' }` |
| `LEVEL_SHORT` | const | `{ '초등': '초', '중등': '중', '고등': '고' }` |
| `currentSchool` | fn | `(student) → string` |
| `normalizeRealLevelGrade` | fn | `(s) → { level, grade, graduated }` |
| `schoolLevelGradeLabel` | fn | `({ school, level, grade }) → string` |
| `studentFullLabel` | fn | `(student) → string` — 예: `'봉영여중1'` |
| `formatSchoolLabelFromText` | fn | `(raw) → string` — OCR·비원생용, className 텍스트 정규화 |
| `studentSearchTerms` | fn | `(student) → string[]` — 검색어 후보 [학교, 학교+학부글자, 풀라벨] |

### `./staff-label` — `staff-label.js`

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `staffLabel` | fn | `(emailOrId) → string` — `@` 앞만, 이미 ID면 통과 |

### `./teacher-label` — `teacher-label.js`

담임(교수) 규약. 원본 데이터는 impact7db staff(HR 직원현황).

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `isActiveTeacher` | fn | `(staff) → boolean` — 부서 '교수' ∧ status 'active'만 담임 후보 |
| `teacherDisplayName` | fn | `(englishName) → string` — 첫 토큰, 첫 글자만 대문자 (`'Edward Lee'→'Edward'`) |
| `canonicalizeTeacherEmails` | fn | `(emails) → string[]` — 구(@gw)·신 메일 중복을 신메일 우선 사람당 1건으로 |
| `isSameTeacher` | fn | `(a, b) → boolean` — 로컬파트 비교, 구·신 메일을 같은 사람으로 판별 |

### `./class-code` — `class-code.js`

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `normalizeClassCode` | fn | `(code) → string` — trim + 대문자 (`'ks132'→'KS132'`), 비교·저장 전 정규화 |

### `./datetime` — `datetime.js`

KST 날짜·시간 포맷. 항상 Asia/Seoul, 12시간제.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `formatTimeKST` | fn | `(value) → '오후 3:05'` |
| `formatDateTimeKST` | fn | `(value, { withYear? }) → '6월 7일 오후 3:05'` |
| `formatDateKST` | fn | `(value) → 'YYYY-MM-DD'` |
| `todayKST` | fn | `() → 'YYYY-MM-DD'` — KST 오늘 |

### `./ime-input` — `ime-input.js`

HTML 템플릿 문자열 렌더링용 IME-aware inline 이벤트 어트리뷰트 생성. onSnapshot 재렌더 입력 소실(onchange)·한국어 조합 중 부분 저장(oninput) 문제를 동시에 해결.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `imeInputAttrs` | fn | `(handlerCall) → string` — `oncompositionstart/end` + `oninput` 한 줄 어트리뷰트. handlerCall은 escAttr 처리된 값 가정, 추가 escape 없음 |

### `./html-escape` — `html-escape.js`

순수 문자열 HTML escape. DOM 기반 로컬 구현(DB·DSC)을 대체하는 SSoT.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `esc` | fn | `(str) → string` — `& < > " '` 5종 escape, nullish → `''`. innerHTML 텍스트 삽입용 |
| `escAttr` | fn | `(str) → string` — HTML 속성용, esc와 동일 5종 escape |

### `./phone` — `phone.js`

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `formatPhone` | fn | `(phone) → string` — 11자리만 `010-1234-5678` 하이픈 분할, 그 외 원본, nullish → `''` |

### `./branch` — `branch.js`

반번호·내신 csKey → 단지(지점) 파생.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `branchFromClassNumber` | fn | `(num) → '2단지' \| '10단지' \| ''` — '10단지'/'2단지' 접두 우선, 그다음 첫 숫자('1'→2단지, '2'→10단지) |
| `branchFromStudent` | fn | `(s) → string` — `s.branch` 우선, 없으면 첫 enrollment에서 파생 |
| `branchesFromStudent` | fn | `(s) → string[]` — 전체 enrollment 파생 합집합, 비면 branch fallback |

### `./leave-cycles` — `leave-cycles.js`

`leave_requests` 휴원/퇴원 사이클 묶음 SSoT. DB·DSC 과거이력 뷰가 공유.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `leaveRequestSortKey` | fn | `(r) → number` — ms. created_at → requested_at → leave_start_date → withdrawal_date → return_date 폴백. Timestamp·Date·문자열 처리 |
| `groupLeaveCycles` | fn | `(requests) → [{ type: 'leave'\|'leave_to_withdraw'\|'withdraw'\|'reenroll'\|'other', startDate, endDate, returnDate, withdrawalDate, note, subType, requests }]` — cancelled/rejected 제외, 최신 사이클이 앞 |

---

## 새 모듈 추가 절차 (이 순서대로)

1. `{name}.js` 작성 — 순수 함수, 의존성 없음
2. `{name}.test.js` 작성 — `node:test` + `node:assert/strict`
3. `package.json` 두 곳 모두 추가:
   - `"exports"`: `"./{name}": "./{name}.js"`
   - `"files"`: `"{name}.js"`
4. `npm test` 전체 통과 확인
5. 버전 bump: `package.json` `.version` 패치 단위 올림
6. 이 파일 "모듈 목록 및 공개 API" 섹션에 새 모듈 추가

## 불변 계약 (절대 깨지 않는다)

아래 심볼은 소비자(impact7DB · impact7newDSC · impact7forms 등)가 직접 의존한다. 변경 전 반드시 사용자 확인.

- `ENROLLABLE_STATUSES`, `NON_ENROLLABLE_STATUSES` — 상태 집합 변경 시 소비자 전체 영향
- `reconcileEnrollments()` 반환 형태 `{ enrollments, valid, reason? }` — 필드명 변경 금지
- `HISTORY_BADGE` 키 집합 7종 — DB 렌더러가 CSS 클래스로 매핑
- `currentSchool(student)` 시그니처 — DSC·DB 다수 사이트에서 호출
- `SCHOOL_FIELD` 값 (`school_elementary` 등) — Firestore 필드명과 동기화

### history-classifier.js의 내부 상수 분리 정책

`history-classifier.js`는 `enrollment-status.js`를 import하지 않고 독립 `STATUSES`/`LEAVE`를 유지한다.
이유: 로그 텍스트 파싱 전용이며 `종강`이 로그에 기록되지 않아 집합이 다르다.
→ 상태값 추가 시 **두 파일을 모두 확인**해야 한다.

## 소비자 패키지 버전 업

1. `package.json` `.version` 올림
2. `git tag vX.Y.Z && git push origin vX.Y.Z`
3. GitHub Actions(`notify-consumers.yml`)가 등록된 소비자 레포의 package.json을 수정하고 커밋함

**breaking change** (시그니처·구조 변경)는 minor/major bump + 소비자 레포 영향 확인 선행.
`npm update @impact7/shared`는 태그 고정 방식에서 동작하지 않음 — 태그를 올려야 한다.

## pre-commit 훅

`.agents/hooks/impact7-precommit-quality-guard.mjs` (로컬 사본, 외부 의존 없음).

- staged 소스 파일이 있으면 simplify → code-review 완료 마커를 확인
- 미검토 시 커밋 차단. 마킹: `node .agents/hooks/impact7-precommit-quality-guard.mjs --mark`
- 긴급 우회: `IMPACT7_SKIP_QUALITY_GUARD=1 git commit ...`

새 머신 클론 후 한 번만 실행:
```sh
sh .agents/hooks/install.sh
```

## 에이전트 충돌 방지

- 같은 파일을 동시에 편집하지 않는다 (git 브랜치 분리 권장).
- `npm test` 는 커밋 전 항상 로컬에서 실행한다.
- SSoT 계약(위 "불변 계약") 변경은 반드시 사용자에게 먼저 확인을 받는다.

## 응답 언어

모든 에이전트는 한국어로 응답한다.

## codegraph 탐색 원칙

코드를 탐색할 때 Read·grep 전에 **`codegraph_explore`를 먼저** 실행한다.
`.memory/reference_codegraph_guide.md`에 도메인별 핵심 쿼리가 정리되어 있다.

---

## 하네스: impact7-shared

**목표:** 순수 함수 모듈 추가·검증·릴리스를 에이전트 팀이 일관되게 처리한다.

**트리거:** 새 모듈 추가·기존 모듈 수정·품질 검증·릴리스 요청 시 `impact7-shared-module` 스킬을 사용하라. 단순 질문·단일 파일 편집은 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-09 | 초기 구성 | quality-guard, module-author, impact7-shared-module | 다중 에이전트 안전성 강화 세션 |
| 2026-06-09 | 포인터 등록 + description 후속 키워드 추가 + 테스트 수 동기화 | AGENTS.md, SKILL.md, quality-guard.md | 하네스 드리프트 정합 |
| 2026-06-09 | release 스킬 신설 | .claude/skills/release/SKILL.md | Actions 자동화 연동 릴리스 프로세스 스킬화 |

## 프론트엔드 수렴 정책 (impact7 에코시스템)

분열된 프레임워크(바닐라 DSC·DB / Svelte HR / Next exam)를 강제 통합하지 않고 **점진 수렴**한다.

- **신규 화면·앱은 React(Next)로** 만든다. 기존 바닐라·Svelte는 강제 마이그레이션하지 않고 수명이 다할 때 React로 교체.
- **공유 UI는 `@impact7/ui`** (`github:chief-impact7/impact7-ui`). React 앱은 컴포넌트 직접 import, 바닐라/Svelte 앱은 `@impact7/ui/mount` 어댑터로 부분 마운트(islands) — **반드시 `unmount`로 정리, 한 앱 *내부* 프레임워크 혼용 남발 금지**(ROI 높은 영역만).
- **공유 레이어 재사용**: 디자인=`design-tokens.json` SSoT, 로직=`@impact7/shared`, 접근성=`a11y.css`/`a11y-dom.js`. 컴포넌트(렌더링)만 프레임워크 종속이므로 그 위 레이어는 항상 공유.
- 토큰/공유DOM drift는 `impact7DB/.agents/hooks/check-design-tokens.mjs`·`check-shared-dom.mjs`(pre-push)가 차단.
