# impact7-shared — 다중 에이전트 운영 계약

Claude Code · Codex · Antigravity 등 모든 AI 에이전트가 이 파일을 따른다.

## 패키지 정체

`@impact7/shared` — impact7 에코시스템의 **순수 로직 SSoT**.
- DB·DSC·Forms 등 소비자가 `npm i` 로 갱신해 사용한다.
- 의존성 없음. DOM·Firebase·날짜 라이브러리 import 금지.
- 테스트: `npm test` (`node --test`). 현재 477개 통과.
- 문서↔코드 drift 검사: `node scripts/check-drift.mjs` (exports·디스크·이 문서 표 대조, 고아 소스 검출)
- 학생·수업·출결·강사·전화·학교/학부/학년 로직은 앱 로컬 탐색·작성 전에 아래 공개 API와 해당 소스·테스트를 먼저 읽는다. 같은 의미의 로컬 helper를 새로 만들지 않는다.

## 모듈 목록 및 공개 API

### `./history` — `history-classifier.js`

수업이력 로그를 교사용 10종 이벤트로 분류. DB·DSC가 동일 컬렉션 공유.

| 심볼 | 종류 | 시그니처 / 값 |
|------|------|--------------|
| `HISTORY_BADGE` | const | `{ '신규'|'복귀'|'재등원'|'수업추가'|'계정재개': 'badge-enroll', '전반'|'휴원'|'계정휴원': 'badge-update', '퇴원'|'계정종료': 'badge-withdraw' }` |
| `classifyHistory` | fn | `(log) → { label, from, to } \| null` |
| `parseStatusClass` | fn | `(text) → { status, classes, pauseStart }` |
| `shortAuthor` | fn | `(emailOrId) → string` — `@` 앞만, 비문자열→`'system'` |
| `isAttendedStatus` | fn | `(status) → boolean` — 출석/지각/조퇴만 true |
| `deriveTenure` | fn | `(logs, getDate, attendances, isCurrentlyEnrolled?) → { start, end, startEvent }` |

### `./enrollment-status` — `enrollment-status.js`

재원상태↔enrollment 정합성 SSoT. 가장 많이 참조되는 계약.
수업계열과 소분류의 의미·등록·override·인원처리 계약은 루트 `AGENTS.md`와 `docs/수업계열-학생상태-출결-운영매뉴얼.md`를 따릅니다.

| 심볼 | 종류 | 시그니처 / 값 |
|------|------|--------------|
| `ENROLLABLE_STATUSES` | const | `Set { '재원', '등원예정', '실휴원', '가휴원' }` |
| `NON_ENROLLABLE_STATUSES` | const | `Set { '상담', '퇴원', '종강' }` |
| `ACCOUNT_TYPES` | const | `['정규', '특강', '기타']` — 기술 필드 `account_type`에 저장하는 수업계열 값 |
| `CLASS_TYPES` | const | `['정규', '내신', '자유학기', '특강', '기타']` — 정규계열 소분류는 정규·내신·자유학기, 특강·기타는 각 계열 단일 소분류 |
| `LEAVE_STATUSES` | const | `Set { '실휴원', '가휴원' }` — 휴원(일시정지) 부분집합(⊂ ENROLLABLE). `status==='실휴원'||'가휴원'` 인라인 대체 |
| `STUDENT_STATUS_GROUPS` | const | `[{ category: '재원생'\|'비원생', statuses: [...] }]` |
| `STATUS_TONE` | const | `{ status: 'active'\|'scheduled'\|'paused'\|'consult'\|'ended-hard'\|'ended-soft' }` |
| `INITIAL_STATUSES` | const | `['등원예정', '재원']` |
| `isEnrollableStatus` | fn | `(status) → boolean` |
| `canRegisterStudentInClass` | fn | `(status, classType) → boolean` — 특강·기타는 status와 무관하게 등록 가능, 정규계열은 재원상태만 가능. 내신·자유학기의 정규수업반 보유 검사는 아래 base helper와 저장 정합성 검사를 함께 사용 |
| `hasRealEnrollment` | fn | `(enrollments) → boolean` — 빈 placeholder 제외 |
| `accountTypeOf` | fn | `(enrollment) → '정규'\|'특강'\|'기타'` — 명시 `account_type` 우선, 레거시는 `class_type`으로 파생 |
| `isValidEnrollmentClassType` | fn | `(accountType, classType) → boolean` — 정규→정규/내신/자유학기, 특강→특강, 기타→기타 조합만 허용 |
| `groupEnrollmentAccounts` | fn | `(enrollments) → [{ key, accountId, accountType, items, typeConflict }]` — placeholder 제외. `key`는 ID 또는 `legacy:{유형}:{대표 반코드}` |
| `deriveEnrollmentAccountTypes` | fn | `(enrollments) → ('정규'\|'특강'\|'기타')[]` — 실제 enrollment에서 정본 순서로 중복 없이 파생 |
| `accountStateAt` | fn | `(account, dateStr) → '활성'\|'예정'\|'휴원'\|'종료'` — 날짜 양끝 포함, 종료일 없는 pause는 열린 구간. `YYYY-` 관례 밖 기준일은 계정을 활성 판정에서 제외하지 않음 |
| `openAccounts` | fn | `(enrollments, dateStr) → account[]` — 종료되지 않은 계정 |
| `openAccountIds` | fn | `(enrollments, dateStr) → string[]` — 열린 명시 계정 ID만 |
| `leaveTypeChangeSource` | fn | `(targetType) → sourceType \| ''` — 휴원종류변경 목표의 반대 원본 유형 |
| `leaveTypeChangeAccounts` | fn | `(enrollments, targetType, dateStr) → account[]` — 기준일에 모든 휴원 항목이 원본 유형인 변경 가능 계정과 `pausedItems` |
| `activeEnrollmentsAt` | fn | `(enrollments, dateStr) → enrollment[]` — 활성 계정 중 항목 자체도 기준일에 활성인 것만 |
| `activeRegularBases` | fn | `(enrollments, dateStr) → enrollment[]` — 활성 정규 소분류 중 수업요일이 있는 정규수업반만 |
| `findActiveRegularBase` | fn | `(enrollments, dateStr) → enrollment\|null` — 내신·자유학기 추가 전 정규수업반 확인용 |
| `hasActiveRegularAccount` | fn | `(enrollments, dateStr) → boolean` — 기준일에 활성인 정규계열 계정 존재 여부 |
| `pauseAccount` | fn | `(enrollments, accountIdOrKey, { pauseStart, pauseEnd?, leaveSubType }) → { updatedEnrollments, skipped }` |
| `resumeAccount` | fn | `(enrollments, accountIdOrKey) → { updatedEnrollments, skipped }` |
| `closeAccount` | fn | `(enrollments, accountIdOrKey, { endDate, endReason }) → { updatedEnrollments, removed, skipped }` |
| `deriveStudentStatusAfterAccountChange` | fn | `(enrollments, dateStr, { fallbackReason?, currentStatus?, changedAccountType? }?) → status` — 기타 계정 변경은 status 불변, 정규·특강 계정은 활성→재원·휴원→예정→종료 우선순위 |
| `reconcileEnrollments` | fn | `(status, enrollments, { dateStr?, previousStatus? }?) → { enrollments, valid, reason? }` — 비원 전환 시 기타만 보존. 내신·자유학기는 같은 정규계정의 정규수업반 필수. 휴원·퇴원→재원은 활성 정규계정 필수. 날짜 지정 시 열린 계정과 유형 충돌 검사 |
| `studentCategory` | fn | `(status) → '재원생' \| '비원생'` |
| `selectableStatuses` | fn | `(current, isNew) → string[]` |

### `./enrollment-derivation` — `enrollment-derivation.js`

enrollment 배열에서 파생 계산. classSettings를 참조.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `enrollmentCode` | fn | `(e) → level_symbol+class_number` — 예: `'HA101'`. 아래 두 함수의 옵션 기본값 |
| `applyNaesinFreeDerivation` | fn | `(current, { classSettings, dateStr, resolveNaesinCsKey, enrollmentCode? }) → enrollment[]` — 내신/자유학기 활성 시 정규를 치환한 배열 |
| `deriveActiveNaesinEnrollment` | fn | `(current, { classSettings, dateStr, resolveNaesinCsKey }) → enrollment\|null` — 활성 내신 enrollment(명시/파생) 또는 null. 아래 predicate와 applyNaesinFreeDerivation의 SSoT |
| `isNaesinActiveAt` | fn | `(current, { classSettings, dateStr, resolveNaesinCsKey }) → boolean` — 기준일 내신기간 활성 여부. 내신 active 판정은 로컬 재구현 말고 이 함수 사용(current는 호출자가 날짜 필터한 활성 enrollment 배열) |
| `deriveClassPeriodHistory` | fn | `(enrollments, classSettings, { enrollmentCode? }?) → [{ class_type, code, start_date, end_date, account_id?, account_type? }]` — 명시 기간 존재를 계정별 판정 |
| `deriveLevelPeriod` | fn | `(enrollments, todayStr) → { start: string\|null, label: string }` |

### `./class-move` — `class-move.js`

특정 학기 정규 enrollment를 다른 반으로 이동 (순수 함수, in-place 아님).

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `moveClass` | fn | `(student, { semester, targetLevelSymbol, targetClassNumber, accountId? }) → { updatedEnrollments, before, after, skipped, warning }` — accountId 생략 시 기존 첫 정규 계정 동작 |

### `./promote-enroll` — `promote-enroll.js`

등원예정→재원 자동전환. Firebase 의존성을 팩토리로 주입.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `createPromoteEnrollPending` | fn | `(firebase, { idField?, batchUpdate? }) → async (students, today) → pending[]` — 오늘 활성(시작됐고 안 끝난) enrollment 필요, 200명 단위 batch 분할 |

### `./expected-arrival` — `expected-arrival.js`

학생 당일 등원 예정 시각 계산 SSoT. DSC(대시보드)·태블릿 서버(지각 판정)가 공유.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `getDayName` | fn | `(dateStr) → '일'~'토'` — TZ 무관(UTC 산술), 실존하지 않는 날짜('2026-02-30')는 `''` |
| `normalizedDays` | fn | `(day) → string[]` — '요일' 접미·구분자 제거 |
| `resolveNaesinCsKey` | fn | `(regularEnroll) → string \| null` — naesin_class_override 기반 |
| `startTime` | fn | `(enrollment, dayName, classSettings) → 'HH:MM' \| ''` |
| `earliestExpectedTime` | fn | `({ enrollments, dayName, classSettings, rec, hwTasks, testTasks, absences, date }) → 'HH:MM' \| ''` — 분 단위 최솟값('9:30' 한 자리 시 허용) |
| `computeExpectedArrival` | fn | `({ enrollments, classSettings, rec, hwTasks, testTasks, absences, date }) → 'HH:MM' \| ''` — 날짜필터→내신/자유학기 파생→요일필터 후 earliest |
| `isLate` | fn | `(arrivalHHMM, expectedHHMM, graceMin=5) → boolean` — 같은 날 비교 계약. 자정 넘김은 판정하지 않음(호출자가 businessDay 기준으로 날짜를 짝지을 것) |

### `./attendance-action` — `attendance-action.js`

출결 액션 표준 용어 SSoT. DB·DSC·태블릿이 import.

| 심볼 | 종류 | 시그니처 / 값 |
|------|------|--------------|
| `ATTENDANCE_ACTIONS` | const | `{ arrival: '등원', out: '외출', return: '귀원', departure: '하원' }` |
| `normalizeAttendanceLabel` | fn | `(label) → string` — 구 동의어('귀가'→'하원', '복귀'→'귀원') 정규화. 출결 액션 값에만 적용 |
| `attendanceLabel` | fn | `(key) → string` |
| `attendanceActionKey` | fn | `(label) → 'arrival'\|'out'\|'return'\|'departure'\|''` — 구·신 라벨 모두 |

### `./attendance-log` — `attendance-log.js`

출결 이벤트 조회용 정렬·그룹. 태블릿·DSC 공유.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `sortByProcessed` | fn | `(events, { desc? }) → events[]` — occurred_at 절대시각순 (오프셋 표기 혼용 안전) |
| `arrivalOrder` | fn | `(events, dailyByStudent?) → events[]` — 등원·재등원만 시각 오름차순. `late`는 등원에만 적용(재등원은 false) |
| `departureOrder` | fn | `(events) → events[]` — 하원(구 라벨 '귀가' 포함)만 시각 오름차순 |
| `groupByState` | fn | `(students, dailyByStudent?) → { 미등원, 원내, 외출중, 하원 }` |

### `./attendance-status` — `attendance-status.js`

출결 **결과 상태**(출석·지각·조퇴·결석) 집합 SSoT. 출결 **액션**(등원·외출·귀원·하원, `./attendance-action`)과는 다른 축. 소비자: 태블릿 서버 checkinHandler.

| 심볼 | 종류 | 값 |
|------|------|-----|
| `ATTENDANCE_STATUSES` | const | `Set { '출석', '지각', '조퇴', '결석' }` |
| `ARRIVAL_STATUSES` | const | `Set { '출석', '지각' }` — 도착 시각 기록 상태(⊂ ATTENDANCE_STATUSES) |

### `./email` — `email.js`

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `isValidEmail` | fn | `(email) → boolean` — `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, 비문자열 → false. HR 여러 화면이 복제하던 정규식 통일 |

### `./ai-model-policy` — `ai-model-policy.js`

Gemini 모델 선택·폴백·3.6 요청 설정 정규화 SSoT. SDK·Firebase 의존성 없이 DSC·Functions·Exam이 공유.

| 심볼 | 종류 | 시그니처 / 값 |
|------|------|----------------|
| `GEMINI_FLASH_PRIMARY` | const | `'gemini-3.6-flash'` |
| `GEMINI_FLASH_FALLBACK` | const | `'gemini-3.5-flash'` |
| `aiModelSequence` | fn | `(feature) → readonly string[]` — 학부모 총평·Exam 일반 텍스트는 3.5 폴백, 상담 제목은 3.6 단일 |
| `runWithAiModelPolicy` | fn | `(feature, generate) → Promise<result>` — 모델 순서대로 실행 |
| `geminiGenerationConfig` | fn | `(model, config?) → config` — 3.6에서 폐기된 sampling 파라미터 제거 |

### `./student-number` — `student-number.js`

전화번호 기반 6자리 학생번호 파생 + identity key.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `STUDENT_NUMBER_SOURCES` | const | `['student_phone', 'parent_phone_1', 'parent_phone_2']` — 파생 우선순위 순 |
| `deriveStudentNumber` | fn | `(student) → { studentNumber: string, source: string }` |
| `deriveFromSource` | fn | `(student, source) → string` — 소스 필드 하나에서만 6자리 파생, 실패 시 `''`. +82·앞 0 소실 표기도 동일 번호 |
| `isValidStudentNumber` | fn | `(raw) → boolean` — 정확히 6자리 숫자 |
| `detectStudentNumberUpgrade` | fn | `(student, currentSource) → { studentNumber, source } \| null` — 상위 소스 번호 제안용 |
| `studentNumberNameKey` | fn | `(name) → string` — 공백 제거 |
| `studentNumberIdentityKey` | fn | `(name, studentNumber) → string` — `'이름|번호'` 또는 `''` |
| `normalizeRegistrationNo` | fn | `(raw) → string` — 비교용 등록번호 정규화. 전화의 모든 표기(+82·앞 0 소실·8자리·'00' 패딩)를 파생 규칙과 동일한 6자리 키로 축약. 저장·표시용 아님 |

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
| `schoolLevelFromName` | fn | `(name) → '초등'\|'중등'\|'고등'\|''` — 학교명 자유텍스트만으로 학부 파생. 학교급 접미(초등학교/중학교/고등학교·초등/중등/고등) 확정 → 없으면 정규화 축약형 마지막 글자 → DUP_EXCEPT(안중·영중 등) bare stem은 미상(`''`). 학생 level 없는 도메인(내신자료) 목록 그룹핑·필터용 |
| `canonicalSchoolLabel` | fn | `(name) → string` — 학교명 표기 편차(금옥중학교·금옥중·금옥중등)를 한 라벨(`금옥중`)로 통일. 학교급 표현을 떼고 학부약어 재부착(schoolLevelGradeLabel 재사용) — 중복제거·DUP_EXCEPT·지역명유지 정합. 목록 학교 옵션·필터·표시 SSoT |

### `./staff-label` — `staff-label.js`

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `staffLabel` | fn | `(emailOrId) → string` — `@` 앞만, 이미 ID면 통과 |

### `./staff-status` — `staff-status.js`

직원 인사 날짜 → 유효 상태 파생 SSoT. 소비자: impact7HR(직원 현황), impact7DB functions(태블릿 staffCheckin·bulkMessage). 종무일은 당일까지 재직·익일 퇴직, 퇴사일·퇴사예정일은 당일부터 퇴직, 날짜순 상태 전이(from은 직전 파생 상태), 퇴사 이후 입사 계열 날짜는 재입사. `today`는 필수 — 달력일(todayKST) vs 영업일(businessDayKST 06시 경계) 선택은 호출자 도메인 결정.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `mergePersonnelDates` | fn | `(staff) → {type,date}[]` — personnelDates 배열 우선 + legacy 최상위 필드 병합, known 타입 dedupe, 미지 타입 보존, 정렬 없음(UI는 별도 정렬) |
| `autoStatusFromPersonnelDates` | fn | `(records, current, today) → status` — 날짜순 상태 전이, YYYY-MM-DD 아닌 날짜는 무시, today 누락·비ISO는 throw |
| `effectiveStaffStatus` | fn | `(staff, today) → status` — 병합+파생, leave_pending·빈 status는 active 기준 |

### `./teacher-label` — `teacher-label.js`

강사(교수) 규약. 원본 데이터는 impact7db staff(HR 직원현황).

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `isTeacher` | fn | `(staff) → boolean` — 부서가 '교수'인 강사 |
| `isEmployedTeacher` | fn | `(staff, today) → boolean` — 강사 ∧ staff-status 파생 재직 (저장 status 아님) |
| `teacherDisplayName` | fn | `(englishName) → string` — 첫 토큰, 첫 글자만 대문자 (`'Edward Lee'→'Edward'`) |
| `teacherKeyOfStaff` | fn | `(staff) → string` — 영어이름 첫 토큰 소문자 우선, 없으면 email |
| `isTeacherStaffIdentity` | fn | `(staff, teacher) → boolean` — 영어이름 key 또는 이메일로 동일 강사 판정 |
| `canonicalizeTeacherEmails` | fn | `(emails) → string[]` — 구(@gw)·신 메일 중복을 신메일 우선 사람당 1건으로. 외부 도메인은 병합하지 않음 |
| `isSameTeacher` | fn | `(a, b) → boolean` — 내부 도메인(impact7.kr·gw.impact7.kr, 도메인 없는 ID 포함)만 로컬파트 비교, 외부 도메인은 완전 일치 필요 |

### `./class-code` — `class-code.js`

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `normalizeClassCode` | fn | `(code) → string` — trim + 대문자 (`'ks132'→'KS132'`), 비교·저장 전 정규화 |
| `classSettingsGet` | fn | `(classSettings, code) → setting \| undefined` — 표기 차이(ks132 ≡ KS132)를 양방향 흡수하는 조회. 파생 계층(enrollment-derivation·expected-arrival)이 사용 |
| `classSettingsAccountType` | fn | `(settings) → '정규'\|'특강'\|'기타'\|null` — 명시 `account_type` 우선, 레거시 `class_type` 파생 |
| `isSelectableAccountClass` | fn | `(accountType, settings) → boolean` — 계정 유형과 반 설정 유형 일치 |
| `selectableAccountClassCodes` | fn | `(classSettings, accountType) → string[]` — 해당 계정 유형의 반코드 정렬 |
| `accountClassParts` | fn | `(accountType, classCode) → { levelSymbol, classNumber }` — 정규화 후 정규는 문자/숫자 분해, 특강·기타는 전체 코드 사용 |
| `validateExistingAccountClass` | fn | `(classSettings, accountType, classCode) → string\|null` — 기존 반 선택·유형·변환 검증 |

### `./datetime` — `datetime.js`

KST 날짜·시간 포맷. 항상 Asia/Seoul, 12시간제 기본(24h 변형 포함). 입력: Date·Timestamp(toDate)·직렬화 POJO(`{seconds}`/`{_seconds}`)·epoch·ISO.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `toDate` | fn | `(value) → Date \| null` — 모든 입력 형태 공통 파싱. 포맷터·leave-cycles 정렬키가 재사용하는 SSoT |
| `formatTimeKST` | fn | `(value) → '오후 3:05'` |
| `formatTime24KST` | fn | `(value) → '15:05'` — 24시간제 시각. toDate가 받는 모든 입력. 잘못된 값 `''` |
| `formatDateTimeKST` | fn | `(value, { withYear? }) → '6월 7일 오후 3:05'` |
| `formatDateKST` | fn | `(value) → 'YYYY-MM-DD'` |
| `formatTime12h` | fn | `(hhmm) → '오후 3:05'` — `'HH:MM'` **문자열** 입력용(Date 아님, formatTimeKST와 구분). 형식 아니면 `''` |
| `formatTime12hNoAmPm` | fn | `(hhmm) → '3:05'` — 오전/오후 없는 콜론 표기. 형식 아니면 `''` |
| `todayKST` | fn | `() → 'YYYY-MM-DD'` — KST 오늘 |
| `addDays` | fn | `(dateStr, days) → 'YYYY-MM-DD'` — 날짜 문자열 ±일 이동, UTC 산술(타임존 무관). 형식이 잘못되면 `''` |
| `addMonths` | fn | `(monthStr, months) → 'YYYY-MM'` — `'YYYY-MM'` 월 ±이동, UTC 산술. 형식이 잘못되면 `''` |
| `isoWeekKST` | fn | `(dateStr) → 'YYYY-Www'` — `'YYYY-MM-DD'`(KST 벽시계) → ISO 8601 주차 키. UTC 산술(서버 TZ 무관). board·DB 주차 SSoT. 형식이 잘못되면 `''` |
| `businessDayKST` | fn | `(value?, cutoffHour=6) → 'YYYY-MM-DD'` — 근무일 06시 경계(당일 06:00~익일 06:00), 익일 00~05시는 전날 귀속 |

### `./ime-input` — `ime-input.js`

HTML 템플릿 문자열 렌더링용 IME-aware inline 이벤트 어트리뷰트 생성. onSnapshot 재렌더 입력 소실(onchange)·한국어 조합 중 부분 저장(oninput) 문제를 동시에 해결.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `imeInputAttrs` | fn | `(handlerCall) → string` — `oncompositionstart/end` + `oninput` 한 줄 어트리뷰트. handlerCall은 escAttr 처리된 값 가정, 추가 escape 없음 |

⚠️ 보안: escAttr는 HTML 계층만 보호한다. 어트리뷰트 값은 JS 실행 전 HTML 디코드되므로,
handlerCall의 JS 문자열 리터럴 안에 사용자 자유 텍스트(이름·메모)를 삽입하면 따옴표 breakout(XSS)이 가능하다.
Firestore ID·고정 함수명 같은 통제된 값만 삽입할 것.

### `./form-slug` — `form-slug.js`

공개 폼 주소(slug) 규약. firebase 라우팅·dev 프록시·검증이 공유.

| 심볼 | 종류 | 시그니처 / 값 |
|------|------|--------------|
| `RESERVED_PUBLIC_SLUGS` | const | `Set { 'forms-admin', 'forms', 'assets', 'vendor', 'src', 'design', 'index', 'form', 'favicon' }` — slug로 쓸 수 없는 시스템 경로 |
| `RESERVED_RESPONSE_SLUGS` | const | `Set { 'uploads' }` — 응답 주소로 쓸 수 없는 예약 경로(`/{slug}/uploads`는 파일 업로드) |
| `slugify` | fn | `(value) → string` — 자유 텍스트 → slug: trim·소문자·영숫자 외 `-`·양끝 `-` 제거·최대 60자. 클라(스튜디오)·서버(Cloud Run) 주소 생성 SSoT |

### `./form-components` — `form-components.js`

공개 폼 공통 구성요소(동의·카카오·푸터) 기본 문구와 정규화. 스튜디오(클라)·Cloud Run(서버) 공유.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `COMPONENT_SETTINGS_DEFAULTS` | const | `{ privacyConsent, marketingConsent, kakaoChannel, footer }` — frozen 기본 문구 |
| `normalizeComponentSettings` | fn | `(value, cap?) → settings` — cap(서버 길이 제한) 주입 시 저장용, 생략 시 표시용. 공백만·비문자열 값은 기본값 유지 |

### `./html-escape` — `html-escape.js`

순수 문자열 HTML escape. DOM 기반 로컬 구현(DB·DSC)을 대체하는 SSoT.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `esc` | fn | `(str) → string` — `& < > " '` 5종 escape, nullish → `''`. innerHTML 텍스트 삽입용 |
| `escAttr` | fn | `(str) → string` — HTML 속성용, esc와 동일 5종 escape |

### `./phone` — `phone.js`

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `digitsOf` | fn | `(value) → string` — 숫자만 추출, nullish → `''`. 수신번호 정규화 등 소비자 직접 사용 |
| `formatPhone` | fn | `(phone) → string` — 국내 번호·국가번호(+82)·휴대폰 앞자리 생략 표기를 표준 하이픈 형식으로 통일. 8자리 가입자 번호는 `010`, 대표번호(15xx·16xx·18xx)는 4-4, `02`는 2자리 지역번호 유지, 정규화 불가는 원본, nullish → `''` |
| `normalizePhoneDigitsKR` | fn | `(value) → string` — `formatPhone`과 같은 규칙으로 발송·검색용 국내 번호 숫자열 반환 |
| `legacyStudentPhoneKeyKR` | fn | `(value) → string` — 국내 번호 정규화 후 11자리 휴대폰의 선행 `0`만 제거한 기존 학생 문서 ID용 키. 지역번호는 보존. 일반 저장·표시·발송에는 사용 금지 |
| `isValidPhoneKR` | fn | `(value) → boolean` — `formatPhone`과 같은 휴대폰 앞자리 정규화 후 `/^01[016789]\d{7,8}$/` 검증. 지역번호는 false |
| `formatPhoneInput` | fn | `(value) → string` — 완성 번호는 `formatPhone`과 같은 표준 형식, 입력 중 번호는 숫자 최대 11자리의 점진 3-3~4-4 분할, nullish → `''` |

### `./branch` — `branch.js`

반번호·내신 csKey → 단지(지점) 파생.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `branchFromClassNumber` | fn | `(num) → '2단지' \| '10단지' \| ''` — '10단지'/'2단지' 접두 우선, 그다음 첫 숫자('1'→2단지, '2'→10단지) |
| `branchFromClassCode` | fn | `(code) → '2단지' \| '10단지' \| ''` — 풀 반코드용. 접두 우선, 그다음 코드 내 **첫 숫자**(`'A101'`→2단지). 학년 숫자가 먼저 오는 csKey(`'목동중1A'`)에는 사용 금지 |
| `branchFromStudent` | fn | `(s) → string` — `s.branch` 우선, 없으면 첫 enrollment에서 파생 |
| `branchesFromStudent` | fn | `(s) → string[]` — 전체 enrollment 파생 합집합, 비면 branch fallback |

### `./leave-cycles` — `leave-cycles.js`

`leave_requests` 휴원/퇴원 사이클 묶음 SSoT. DB·DSC 과거이력 뷰가 공유.

| 심볼 | 종류 | 시그니처 |
|------|------|---------|
| `leaveRequestSortKey` | fn | `(r) → number` — ms. created_at → requested_at → leave_start_date → withdrawal_date → return_date 폴백. Timestamp·직렬화 POJO(`{seconds}`/`{_seconds}`)·Date·문자열 처리 |
| `groupLeaveCycles` | fn | `(requests) → [{ type: 'leave'\|'leave_to_withdraw'\|'withdraw'\|'reenroll'\|'other', startDate, endDate, returnDate, withdrawalDate, note, subType, requests }]` — cancelled/rejected 제외, 최신 사이클이 앞 |

### `./permissions` — `permissions.js`

에코시스템 전역 권한 카탈로그. HR 권한설정 화면이 렌더링 SSoT로 사용. key는 `HR_users.permissions`/`staff.permissions` 맵의 필드명. 신규 키 추가 시 firestore.rules `isSafeShortTermSelfCreate` 화이트리스트도 갱신할 것.

| 심볼 | 종류 | 시그니처 / 값 |
|------|------|--------------|
| `PERMISSION_GROUPS` | const | `[{ key, title, items: PermissionEntry[] }]` — 항목은 권한 `{ key, label, apps, enforced }` 또는 재귀 하위 목록 `{ id, label, children }`. 그룹 11종. `enforced`: `'rules'`(firestore.rules 서버 강제) \| `'client'`(앱 화면 제어만) \| `'none'`(카탈로그만) |
| `ALL_PERMISSION_KEYS` | const | `PERMISSION_GROUPS`의 중첩 항목을 재귀 순회한 권한 키 43종 |
| `SENSITIVE_PERMISSION_KEYS` | const | `['canViewPopulationStats', 'canViewClassCounts']` — 오너/원장만 부여·회수 |

### `./retention` — `retention.js`

강사별 유지율(리텐션) 귀속 규칙 SSoT. 담당 전환 버퍼는 `[T, T+14)` 반개구간(전환일 당일 포함, 14일째 제외) — 버퍼 안 이탈은 이전·현재 담당 0.5/0.5, 밖·첫 배정·같은 teacher 재배정은 현재 담당 1.0. 휴원은 유지(세그먼트 유지·이벤트 아님), 퇴원·휴원→퇴원은 퇴원신청서 작성자(form-author) 귀책 1.0(교수 매칭 실패 시 퇴원일 기준 버퍼 폴백 + uncertain). 소비자: impact7HR 유지율 페이지.

| 심볼 | 종류 | 시그니처 / 값 |
|------|------|--------------|
| `RETENTION_BUFFER_DAYS` | const | `14` — 담당 전환 귀속 버퍼 일수 |
| `teacherOfClassAt` | fn | `(classCode, dateStr, teacherHistory, classSettings) → { teacher, uncertain }` — changed_at≤D 최신 레코드 → 첫 레코드 prev_teacher(uncertain) → classSettings teacher(uncertain) → `''`(uncertain). changed_at은 Timestamp·POJO·Date·ISO 모두(toDate) |
| `buildStudentSegments` | fn | `(student, { classSettings, teacherHistory, fallbackClassCodes, archivedEnrollments? }) → [{ start, end, classCode, teacher, kind: '정규'\|'내신'\|'자유학기', uncertain, accountKey, accountId, accountType }]` — 현재·종료 스냅샷을 정규 account별로 복원하고 안정 정렬. 내신·자유학기 overlay는 같은 account의 정규 조각만 치환. 휴원은 세그먼트를 끊지 않으며 fallback 종료일은 첫 비재원일 전날 |
| `churnEventsForStudent` | fn | `(student, cycles, { archivedEnrollments? }?) → [{ type: 'withdraw'\|'leave_to_withdraw', date, anchorDate, formAuthor?, subType?, accountKey?, accountId?, accountType? }]` — 특강·기타 종료와 다른 정규 account 유지 중 부분 종료는 제외하고 최종 정규 account 이탈만 반환. scoped cycle은 account 범위를 보존 |
| `attributeEvent` | fn | `(event, segments, { bufferDays?, teacherEmails? }?) → [{ teacher, weight, rule: 'form-author'\|'buffer-split'\|'current'\|'unknown', uncertain? }]` — 가중치 합 1.0. scoped event는 같은 account 세그먼트에만 귀속하며 첫 비재원일은 종료 전날 세그먼트로 연결. 퇴원신청자 formAuthor 매칭 실패는 버퍼 폴백+uncertain |
| `periodRange` | fn | `(period, semesterSettings?) → { start, end }` — month: `[1일, 말일]`. semester: `{level}-{year}-{nameLower}` 키 start_date ~ 같은 학부 다음 학기 시작 전일(마지막 학기면 오늘). 해석 불가는 `{ start: null, end: null }` |
| `aggregateRetention` | fn | `({ studentIds, segmentsByStudent, attributionsByStudent, range }) → { byTeacher: { [email]: { exposed, churn, retentionRate, events } } }` — 분모=기간 겹침 `(studentId, accountKey)` 노출 수, 분자=기간 내 account 이탈 귀속 가중 합, retentionRate=exposed>0 ? 1−churn/exposed : null. accountKey 없는 기존 세그먼트는 학생 단위 호환, Map·plain object 및 구·신 이메일 병합 |

---

## 새 모듈 추가 절차 (이 순서대로)

1. `{name}.js` 작성 — 순수 함수, 의존성 없음
2. `{name}.test.js` 작성 — `node:test` + `node:assert/strict`
3. `package.json` `"exports"`에 `"./{name}": "./{name}.js"` 추가 (`"files"`는 glob `*.js`·`!*.test.js`로 자동 포함)
4. `npm test` 전체 통과 확인
5. 버전 bump: `package.json` `.version` 패치 단위 올림
6. 이 파일 "모듈 목록 및 공개 API" 섹션에 새 모듈 추가

## 불변 계약 (절대 깨지 않는다)

아래 심볼은 소비자(impact7DB · impact7newDSC · impact7forms 등)가 직접 의존한다. 변경 전 반드시 사용자 확인.

- `ENROLLABLE_STATUSES`, `NON_ENROLLABLE_STATUSES` — 상태 집합 변경 시 소비자 전체 영향
- `reconcileEnrollments()` 반환 형태 `{ enrollments, valid, reason? }` — 필드명 변경 금지
- `HISTORY_BADGE` 키 집합 10종 — DB 렌더러가 CSS 클래스로 매핑
- `currentSchool(student)` 시그니처 — DSC·DB 다수 사이트에서 호출
- `SCHOOL_FIELD` 값 (`school_elementary` 등) — Firestore 필드명과 동기화

### history-classifier.js의 내부 상수 분리 정책

`history-classifier.js`는 `enrollment-status.js`를 import하지 않고 독립 `STATUSES`/`LEAVE`를 유지한다.
이유: 로그 텍스트 파싱 전용 — 집합의 목적(파싱 인식)이 상태 정합성 집합과 다르다.
`종강`은 WITHDRAW 로그의 before 텍스트에 나타날 수 있어 파싱 인식에 포함한다(2026-07-05 리뷰 반영).
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
