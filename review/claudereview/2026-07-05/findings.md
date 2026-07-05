# Findings — 확정 25 · 보류 9 · 기각 3

기준: v1.40.0 (feb0228), 테스트 233개 통과 상태. 모든 확정 건은 node 재현 완료 (재현 출력은 [verification.md](verification.md)).

## 확정 — HIGH

### C1. earliestExpectedTime이 시각을 사전순 정렬 — 지각 판정 오염

- 파일: `expected-arrival.js:60`
- 축: 신뢰성 | 재현: V-C1
- `times.sort()[0]`가 'HH:MM' 문자열을 사전식으로 정렬한다. 같은 파일의 `toMinutes()`(`expected-arrival.js:84`)는 `\d{1,2}:` 한 자리 시각을 유효하게 받으므로 모듈 내부 계약이 비일관. '9:30'과 '10:00' 혼재 시 '10:00'을 "가장 이른" 시각으로 반환.
- 영향: DSC 대시보드·태블릿 지각 판정(impact7DB functions-shared `tabletCheckinHandler.js`)의 기준 시각이 조용히 틀어짐. codexreview #1과 동일 발견.
- 수정: `toMinutes`를 모듈 상단으로 올려 숫자 최솟값 선택. 파싱 불가 문자열은 파싱 가능한 후보가 없을 때만 사전식 폴백.

### C2. datetime 포맷 4종이 호출마다 Intl.DateTimeFormat 재생성 — 117배 낭비 (실측)

- 파일: `datetime.js:25,35,46,62`
- 축: 신속성 | 재현: V-C9 (벤치마크)
- `toLocaleTimeString`/`toLocaleString`/`toLocaleDateString`은 내부적으로 매 호출 Intl.DateTimeFormat을 생성한다. 실측 186.7µs/call vs 모듈 레벨 캐시 1.6µs/call. `businessDayKST`는 호출당 2회 생성(177µs). 소비자는 onSnapshot 콜백·렌더 루프에서 학생 단위로 대량 호출 — 1,000건 렌더 시 약 187ms.
- `history-classifier.js:117 ymdSeoul`도 동일 패턴 (`deriveTenure` 내부 호출).
- 수정: 모듈 레벨 캐시 포맷터. 출력 동일성 실측 확인 완료.

### C3. AGENTS.md 공개 API 카탈로그 대규모 drift

- 파일: `AGENTS.md`
- 축: 정합성 | 재현: V-C24
- package.json exports 21개 중 5개 모듈(`attendance-action`, `expected-arrival`, `attendance-log`, `form-slug`, `form-components`)이 문서 표에 통째로 없음. 이들은 실사용 중(impact7DB functions-shared 5개 파일, DSC DailyLogBoard 등).
- 추가: `businessDayKST`, `STUDENT_NUMBER_SOURCES`, `deriveFromSource`, `isValidStudentNumber`, `detectStudentNumberUpgrade` 심볼 누락 · `applyNaesinFreeDerivation` 반환형 오기(`enrollment` → 실제 배열) · "테스트 193개" (실제 233개).
- 영향: AGENTS.md를 계약 SSoT로 읽는 에이전트가 기존 API를 발견하지 못하고 중복 구현. "새 모듈 추가 절차" 6단계를 5회 연속 위반한 상태. codexreview #3과 동일.

## 확정 — MEDIUM

### C4. deriveLevelPeriod 월수 과대 계산 + 실행 환경 타임존 의존

- 파일: `enrollment-derivation.js:159`
- 축: 신뢰성 | 재현: V-C3
- (a) 일(day) 미보정: `(연차*12+월차)`만 계산해 2026-06-20 시작을 07-05 조회(15일 경과) 시 '1개월', 01-31→02-01(1일)도 '1개월', 2025-07-31→2026-07-01(약 11개월)은 '1년'.
- (b) `getFullYear()/getMonth()`가 런타임 로컬 타임존 달력 사용 — UTC 서버와 KST 브라우저에서 결과가 다를 수 있음(순수 SSoT 위반).
- (c) 이 함수는 테스트가 0건 (test 파일에서 import조차 안 됨). 소비자 실경로: impact7DB app.js:3222, DSC student-detail.js:1227.
- codexreview #4와 동일 발견 + 타임존 축 추가.
- 수정: 'YYYY-MM-DD' 문자열 직접 파싱(타임존 무관) + `일수 < 시작일` 시 1개월 차감 + 테스트 신설.

### C5. formatPhone이 비문자열 입력에 number 그대로 반환 — 계약 위반

- 파일: `phone.js:6` | 축: 정합성 | 재현: V-C4
- AGENTS.md 계약 `(phone) → string`인데 `formatPhone(123)`이 `number 123` 반환. 엑셀/폼 import 숫자형에서 `.trim()` 등 후속 호출 크래시. codexreview #2와 동일.

### C6. branchFromClassNumber가 숫자 class_number에서 TypeError

- 파일: `branch.js:4` | 축: 안정성 | 재현: V-C5
- `(num || '').trim()`이 숫자 입력에서 즉시 throw. 같은 필드를 `enrollmentCode()`는 템플릿 리터럴로 숫자 허용 — 모듈 간 비일관. Firestore에 class_number가 number로 저장된 문서가 하나라도 있으면 지점 파생 전체 크래시.

### C7. computeExpectedArrival — enrollments의 null 원소에서 TypeError

- 파일: `expected-arrival.js:68` | 축: 안정성 | 재현: V-C2
- 날짜 필터가 원소 가드 없이 `e.start_date` 접근. Firestore 원본 배열(시스템 경계)을 직접 받는 진입점. 소비자 catch가 빈 문자열로 강등 → 해당 학생 지각 판정이 조용히 영구 비활성화.

### C8. promote-enroll 3종 — end_date 무시 · batch 500 한도 · null 원소

- 파일: `promote-enroll.js:9,13` | 축: 신뢰성·안정성 | 재현: 코드 검증
- (a) `some(e => e.start_date <= today)`가 end_date를 안 봄 — enrollments 배열은 종료된 과거 항목을 이력으로 보유하므로(deriveClassPeriodHistory가 의존), 미래 시작 등원예정 학생이 과거 종료 enrollment 때문에 조기 '재원' 전환.
- (b) 학생당 2 ops(update+history set) × 250명 초과 시 Firestore writeBatch 500 한도로 commit 전체 실패 — 일괄 import 직후 시나리오.
- (c) null 원소에서 TypeError → 자동전환 전체 중단.

### C9. history-classifier 복귀 분기 비대칭 — 실휴원/가휴원→등원예정이 사라짐

- 파일: `history-classifier.js:84` | 축: 정합성 | 재현: V-C8
- 상태 기반 복귀 규칙은 `LEAVE → '재원'`만 인정. 반면 같은 함수의 pause_start_date 기반 복귀 규칙(`history-classifier.js:95`)은 `'재원' || '등원예정'` 둘 다 인정 — 동일 개념의 두 경로가 비대칭. 휴원 중 복귀 예약(등원예정 설정) 이벤트가 교사 뷰에서 통째로 사라진다.
- 수정: 상태 기반 규칙도 등원예정 인정. HISTORY_BADGE 키 7종은 불변(계약 준수).

### C10. history-classifier '종강' 단독 문자열 파싱 실패 — JSON 경로와 불일치

- 파일: `history-classifier.js:14,54` | 축: 정합성 | 재현: V-C7
- `parseStatusClass('종강')` → status ''. 같은 함수의 JSON 경로(`{"status":"종강"}`)는 STATUSES 검증 없이 '종강'을 통과시킴 — 동일 데이터의 두 표현이 다른 결과. WITHDRAW 로그에서 from이 '재원'으로 둔갑(`bS || '재원'` 폴백).
- 수정: 파싱용 STATUSES에 '종강' 추가(내부 상수, 불변 계약 아님. AGENTS.md "두 파일 동시 확인" 절차 준수 — enrollment-status에는 이미 존재).

### C11. leave-cycles 동률 정렬이 입력 순서 의존 — 사이클 묶음 비결정적

- 파일: `leave-cycles.js:71` | 축: 신뢰성 | 재현: V-C10
- 같은 sortKey(예: 같은 날짜의 휴원요청+복귀요청)에서 입력 순서에 따라 1사이클 또는 2카드로 갈라짐. Firestore 쿼리 순서는 보장이 약하므로 화면마다 다른 결과 가능.
- 수정: 정렬 키 프리컴퓨트(성능 겸) + 동률 시 요청 타입 랭크(휴원시작 < 연장 < 복귀 < 퇴원) tiebreak.

### C12. ime-input — (a) if 가드가 첫 문장만 보호 (b) escAttr 계약이 JS 문자열 breakout을 못 막음

- 파일: `ime-input.js:24` | 축: 안정성·보안 | 재현: 코드 검증 + 소비자 대조
- (a) `oninput="if(!this._c)${handlerCall}"` — 블록 없는 if라 다중 문장 handlerCall의 2번째 문장부터 IME 가드 밖에서 실행.
- (b) JSDoc·AGENTS.md의 "escAttr 처리 가정 = 안전" 계약은 거짓: escAttr(HTML 엔티티)은 어트리뷰트 파싱 시 디코드된 뒤 JS로 실행되므로 `'` breakout을 막지 못함. **현 소비자 사용처 전수 확인 결과 handlerCall에 들어가는 값은 Firestore ID·고정 함수명뿐이라 현재 악용 경로 없음** → HIGH가 아닌 MEDIUM(계약 문서 위험).
- 수정: (a) 중괄호 가드. (b) JSDoc·AGENTS.md에 "사용자 텍스트를 JS 문자열 리터럴로 삽입 금지(ID·고정값만)" 경고 명시.

### C13. form-components — 공백만 입력 시 기본값 미적용 + 비문자열 조용한 강제 변환

- 파일: `form-components.js:42` | 축: 안정성 | 재현: V-C19
- `(groupSource[key]) || 기본값`의 truthy 판정이라 `' '`(공백만)이 기본값을 대체하고, 객체/배열이 들어오면 `"[object Object]"`로 강제 변환되어 공개 폼에 노출.
- 수정: 문자열이며 trim 후 비지 않은 값만 채택.

### C14. deriveFromSource — 숫자형·+82 표기에서 조용히 다른 학생번호 발급

- 파일: `student-number.js:7` | 축: 신뢰성 | 재현: V-C15
- 엑셀 import로 leading 0이 소실된 숫자(1012345678)는 '101234', '+82-10-1234-5678'은 '821012'를 발급 — 같은 전화의 문자열 표기('010-1234-5678' → '123456')와 다른 번호. 학생번호는 identity key라 동일인 이중 발급 위험.
- 수정: digits 정규화(`8210…`→`010…`, 10자리 `10…`→`010…`) 후 기존 규칙 적용. 기발급 번호는 불변 정책상 영향 없음.

## 확정 — LOW

### C15. attendance-log가 구 라벨 '귀가'를 조용히 누락

- 파일: `attendance-log.js:14,20` | 재현: V-C18 — 같은 패키지의 `normalizeAttendanceLabel`(attendance-action.js)이 '귀가'→'하원' 정규화를 SSoT로 제공하는데 미적용. 구 데이터 이벤트가 귀가순 목록에서 사라짐. 수정: 필터에 정규화 적용.

### C16. attendance-log 정렬 — 오프셋 혼용 오정렬 + localeCompare 낭비

- 파일: `attendance-log.js:2` | 재현: V-C16 — 'Z'와 '+09:00' 표기가 섞이면 절대시각이 아닌 문자열 순서로 정렬(등원순 역전). 수정: epoch 키 프리컴퓨트 정렬(파싱 불가 시 문자열 폴백).

### C17. history-classifier '상태' regex 비앵커 — 자유 텍스트 오파싱

- 파일: `history-classifier.js:48` | 재현: V-C13 — '건강상태:양호'에서 status '양호' 추출. 수정: `(^|,\s*)` 앵커.

### C18. student-label 전각 숫자 학년 소실

- 파일: `student-label.js:24` | 재현: V-C20 — grade '２'가 NaN → '봉영여중' (학년 없는 라벨). 수정: 전각→반각 정규화.

### C19. normalizeRealLevelGrade 비멱등 — 졸업 출력 재입력 시 초등생으로

- 파일: `student-label.js:27` | 재현: V-C13b — `{level:'졸업', grade:1}` 입력 → `{level:'초등', grade:1}`. 수정: level '졸업' 가드.

### C20. class-move 헤더 주석 모순

- 파일: `class-move.js:1` | "in-place 이동한다 (순수 함수)" — 구현은 새 배열 반환, AGENTS.md도 "in-place 아님". 주석 수정.

### C21. 릴리스 문서 소비자 수 불일치

- 파일: `.omc/RELEASE_RULE.md`, `.agents/skills/release/SKILL.md` | "소비자 4곳" vs notify-consumers.yml matrix 실제 6곳(impact7DB, impact7HR, exam, impact7newDSC, DashBoard, impact7forms). codexreview #5와 동일.

### C22~C25. (경미) 기타

- C22 `promote-enroll.js` null 원소 가드 (C8-c에 포함 처리)
- C23 leave-cycles 헤더 주석 — "endDate는 휴원 종료일만" vs withdraw/other 카드는 endDate에 퇴원일 기입(재현 V-C11). 소비자(impact7DB past-history.js:247)는 `returnDate || withdrawalDate || endDate` 폴백이라 코드 변경 위험 > 이득 → **주석에 예외 명시**로 처리.
- C24 groupLeaveCycles comparator가 비교마다 sortKey 재계산 — C11 수정(프리컴퓨트)에 포함.
- C25 AGENTS.md 변경 이력 표 미갱신 — 문서 동기화에 포함.

## 보류 — 정책 결정 필요 (수정하지 않고 보고만)

### P1. reconcileEnrollments가 7종 밖 status를 무검증 통과

- `enrollment-status.js:34` — 오타·구 데이터·undefined status가 비재원도 재원도 아닌 채로 enrollment를 유지한 채 저장됨. **불변 계약(반환 형태) 영역이라 변경 전 사용자 확인 필수.** 옵션: (a) 현행 유지(내부 신뢰) (b) unknown status에 `valid:false` 반환.

### P2. normalizeRegistrationNo — 전화 원본(8자리)과 파생 학생번호(6자리)가 다른 비교 키

- `student-number.js:58` — '010-1234-5678'→'12345678' vs 파생번호 '123456'. dedup 목적 함수인데 같은 사람의 두 표기를 못 묶음. 8자리를 앞 6자리로 자르면 해결되나 오병합 위험 검토 필요.

### P3. 소문자 반코드 미정규화 — 내신/자유학기 파생 조용히 누락

- `enrollment-derivation.js:18` — `normalizeClassCode` SSoT가 패키지 내부 미적용. 'ha101' 저장 시 classSettings['HA101'] 조회 실패. 소비자 저장 시점 정규화가 우선 권장; 파생 계층 정규화는 표시 코드 변경 부작용 검토 필요.

### P4. 명시적 자유학기 반코드 ≠ 정규 반코드면 정규 미숨김

- `enrollment-derivation.js:95` — 헤더 주석("자유학기 활성이면 정규를 숨긴다")과 다름 (재현 V-C5). 실데이터에 해당 조합이 존재하는지 확인 후 정책 결정.

### P5. isLate 자정 넘김 미판정

- `expected-arrival.js:89` — 예정 22:00, 등원 익일 00:30 → 지각 아님. businessDayKST가 06시 경계를 도입한 운영 특성상 발생 가능. 자정 넘김 휴리스틱(±12h) 도입 여부는 정책 결정.

### P6. teacher-label이 도메인을 무시 — 외부 도메인 같은 로컬파트 병합

- `teacher-label.js` — `isSameTeacher('edward@gmail.com','edward@impact7.kr')` → true (재현 V-C17). HR 원본이 내부 메일만 담는 한 실위험 낮음. 허용 도메인 목록 확정 시 강화 가능.

### P7. Firestore Timestamp POJO({seconds,nanoseconds}) 미지원

- `datetime.js:8`, `leave-cycles.js:14` — JSON 직렬화 경유(캐시·API 응답) 형태가 조용히 ''/0. 실경로 존재 확인 후 지원 결정.

### P8. getDayName이 실존하지 않는 날짜를 rollover

- `expected-arrival.js:9` — '2026-02-30'→'월'. 날짜 생성원이 모두 유효 날짜라 실경로 없음.

### P9. lockfile 부재로 npm audit 불가 (codexreview 지적 승계)

- 의존성 0 정책이면 "외부 import 없음" 정적 검사를 공식 게이트로 명시하는 쪽 권장.

## 기각 — REFUTED

### R1. "내신 파생 활성 시 비활성 명시적 내신 동시 노출"

- 재현은 되나(V-R1) 전제가 입력 계약 위반: `applyNaesinFreeDerivation`의 current는 **호출자가 날짜 필터(미시작·종료 제외)를 마친 배열**이어야 한다(모듈 헤더 명시, computeExpectedArrival도 필터 후 전달). 미래 시작 내신은 유효 입력이 아님.

### R2. "branchFromStudent(null) 크래시"

- AGENTS.md 계약 "내부 호출에는 신뢰 가정" — student 객체 자체의 null은 소비자 책임. (배열 *원소* null인 C6·C7과 구분: 그쪽은 Firestore 원본을 그대로 받는 시스템 경계.)

### R3. "departureOrder가 day_state를 무시" 류 — 발견 원문이 구현 오독

- groupByState는 문서 계약대로 동작. 워크플로우 finder의 일부 중복·오독 발견은 검증 단계에서 배제.
