# Action Plan

## 수정 순서 (확정 25건)

### 1. 런타임 correctness

| 파일 | 수정 | 발견 |
|------|------|------|
| `expected-arrival.js` | toMinutes 상단 이동 → 분 단위 최솟값 선택 (파싱 불가 시 사전식 폴백) + enrollments 원소 null 가드 | C1, C7 |
| `phone.js` | 비 11자리도 `String(phone ?? '')` 반환 | C5 |
| `enrollment-derivation.js` | deriveLevelPeriod를 문자열 파싱 기반(타임존 무관)으로 재작성 + 일 미달 시 1개월 차감 | C4 |
| `branch.js` | `String(num ?? '').trim()` | C6 |
| `promote-enroll.js` | 원소 null 가드 + `end_date < today` 항목 제외 + 200명 단위 batch 분할 | C8 |
| `history-classifier.js` | 복귀 규칙에 등원예정 포함 · STATUSES에 '종강' 추가 · '상태' regex 앵커 | C9, C10, C17 |
| `leave-cycles.js` | 정렬 키 프리컴퓨트 + 타입 랭크 tiebreak · 헤더 주석 endDate 예외 명시 | C11, C23, C24 |
| `attendance-log.js` | normalizeAttendanceLabel 적용 · epoch 키 정렬 | C15, C16 |
| `ime-input.js` | `if(!this._c){…}` 중괄호 + JSDoc 보안 경고 | C12 |
| `form-components.js` | pick: 문자열·trim 비어있지 않은 값만 채택 | C13 |
| `student-label.js` | 전각 숫자 정규화 + level '졸업' 멱등 가드 | C18, C19 |
| `student-number.js` | digits 정규화(+82·leading 0 소실) | C14 |
| `class-move.js` | 헤더 주석 수정 | C20 |

### 2. 성능

| 파일 | 수정 | 발견 |
|------|------|------|
| `datetime.js` | Intl.DateTimeFormat 모듈 레벨 캐시 (formatTime/DateTime/Date/businessDay) | C2 |
| `history-classifier.js` | ymdSeoul 포맷터 캐시 | C2 |

### 3. 회귀 테스트

각 수정에 대응하는 테스트를 해당 `.test.js`에 추가. 특히:
- `earliestExpectedTime` '9:30' vs '10:00' (+ 09:30 혼합, task/absence 소스 혼합)
- `deriveLevelPeriod` 신설: 말일→월초·15일 경과·1년 경계·윤년·등원예정·잘못된 today
- `promote-enroll` 종료 enrollment 제외·null 원소·250명 초과 분할
- datetime 캐시 후 출력 동일성 (기존 테스트가 커버)

### 4. 문서·계약 동기화

- `AGENTS.md`: 누락 모듈 5개 섹션 신설, datetime·student-number 심볼 추가, `applyNaesinFreeDerivation → enrollment[]` 수정, 테스트 수 갱신, ime-input 보안 경고, 변경 이력 행 추가
- `.omc/RELEASE_RULE.md` · `.agents/skills/release/SKILL.md`: 소비자 6곳으로 갱신
- `scripts/check-drift.mjs` 신설: exports ↔ files ↔ 디스크 ↔ AGENTS.md 문서 표 + 테스트 수 대조

### 5. 검증 게이트

```sh
npm test                                   # 전체 통과
node --test --experimental-test-coverage   # enrollment-derivation 148-165 미커버 해소 확인
node scripts/check-drift.mjs               # 문서 drift 0건
npm pack --dry-run                         # 패키징 표면 불변(22 files)
```

### 6. 릴리스 (사용자 승인 후)

- version 1.40.0 → 1.41.0 (동작 변경 포함: promote-enroll 전환 조건·history 분류 확대·학생번호 정규화)
- 커밋 전 simplify → review 절차 (pre-commit 가드)
- `git tag v1.41.0 && git push origin v1.41.0` → notify-consumers.yml이 소비자 6곳 갱신

## 보류 — 사용자 결정 필요 (P1~P9)

> **2026-07-05 (2차): 사용자 승인으로 전부 진행 완료.** 결과·회귀·소비자 후속은 [p1-p9-applied.md](p1-p9-applied.md) 참고. 아래 표는 당시 결정 대기 상태의 기록.

| # | 항목 | 결정할 것 |
|---|------|----------|
| P1 | reconcileEnrollments unknown status 무검증 | 불변 계약 영역 — `valid:false` 반환 추가 여부 |
| P2 | normalizeRegistrationNo 8자리 vs 6자리 키 | dedup 키를 앞 6자리로 통일할지 (오병합 위험 검토) |
| P3 | 반코드 소문자 미정규화 | 파생 계층에서 normalizeClassCode 적용할지, 소비자 저장 시 정규화로 갈지 |
| P4 | 명시적 자유학기 코드 ≠ 정규 코드 시 정규 노출 | 실데이터 존재 여부 + 숨김 정책 |
| P5 | isLate 자정 넘김 | ±12h 휴리스틱 도입 여부 |
| P6 | isSameTeacher 도메인 무시 | 허용 도메인 목록 확정 |
| P7 | Timestamp POJO({seconds}) 지원 | 직렬화 경유 실경로 존재 여부 |
| P8 | getDayName rollover | 방치 가능(실경로 없음) |
| P9 | lockfile 부재 audit 불가 | "의존성 0 + 외부 import 없음" 정적 검사를 공식 게이트로 명시 |
