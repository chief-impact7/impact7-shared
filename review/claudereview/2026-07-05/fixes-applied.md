# Fixes Applied — 2026-07-05

확정 25건(claudereview) + codexreview 5건(전부 확정 목록에 포함)을 적용했다.
29개 파일 변경, +458 / −75 라인. 버전 1.40.0 → **1.41.0** (동작 변경 포함 minor).

## 검증 게이트 결과 (수정 후)

```text
npm test                     → tests 259 / pass 259 / fail 0   (기존 233 + 회귀 26)
coverage                     → enrollment-derivation.js line 100% (기존 미커버 148-165 해소), all files 99.24%
node scripts/check-drift.mjs → ✓ drift 없음 (모듈 21개)
npm pack --dry-run           → 22 files (패키징 표면 불변)
```

## 수정 효과 재현 (수정 전 → 후)

| 발견 | 수정 전 | 수정 후 |
|------|--------|--------|
| C1 earliestExpectedTime('9:30' vs '10:00') | `'10:00'` | `'9:30'` |
| C2 formatTimeKST 5000회 | 186.7µs/call | **1.4µs/call (133배)** |
| C4 deriveLevelPeriod(06-20→07-05) | `'1개월'` | `'15일'` |
| C5 formatPhone(123) | `number 123` | `string '123'` |
| C6 branchFromClassNumber(101) | TypeError | `'2단지'` |
| C7 computeExpectedArrival([null]) | TypeError | `''` (무시) |
| C9 실휴원→등원예정 | `null` (숨김) | `{label:'복귀', …}` |
| C10 WITHDRAW before '종강' | from `'재원'` | from `'종강'` |
| C11 동률 사이클 [a,b]/[b,a] | 1 / 2 (비결정) | 1 / 1 |
| C14 deriveFromSource(1012345678 · '+82-10-…') | '101234' / '821012' | 둘 다 `'123456'` |

## 파일별 변경

### 소스 (14)

- `expected-arrival.js` — 분 단위 최솟값 선택(사전식 폴백은 시각 형식 전무 시만), enrollments null 원소 가드
- `phone.js` — 항상 string 반환
- `enrollment-derivation.js` — deriveLevelPeriod 문자열 파싱(타임존 무관) + 일(day) 미달 시 1개월 차감
- `branch.js` — `String(num ?? '')` 숫자 class_number 허용
- `promote-enroll.js` — 오늘 활성 enrollment 조건(end_date 존중) + null 가드 + 200명 단위 batch 분할
- `datetime.js` — Intl.DateTimeFormat 5종 모듈 레벨 캐시 (출력 동일성 기존 테스트로 검증)
- `history-classifier.js` — 복귀 규칙에 등원예정 포함, STATUSES에 '종강'(파싱 인식), '상태' regex 앵커, ymdSeoul 포맷터 캐시
- `leave-cycles.js` — 정렬 키 프리컴퓨트 + 타입 랭크 tiebreak, 헤더 주석에 endDate 예외·동률 규칙 명시
- `attendance-log.js` — normalizeAttendanceLabel 적용('귀가' 포함), epoch 기반 정렬(오프셋 혼용 안전)
- `ime-input.js` — oninput 블록 가드 `if(!this._c){…}`, JSDoc 보안 경고
- `form-components.js` — pick: 문자열이며 공백 아닌 값만 채택
- `student-label.js` — 전각 숫자 정규화, level '졸업' 멱등 가드
- `student-number.js` — +82·앞 0 소실 표기 정규화
- `class-move.js` — 헤더 주석 모순 수정

### 테스트 (12, +26건)

각 수정에 1:1 회귀 테스트. `deriveLevelPeriod`는 테스트 0건 → 4블록 신설(말일/윤년/등원예정/무효 입력).
`ime-input.test.js`는 블록 가드 반영으로 기대 문자열 3건 갱신(의도된 변경).

### 문서·인프라 (5)

- `AGENTS.md` — 누락 모듈 5개 섹션 신설(expected-arrival·attendance-action·attendance-log·form-slug·form-components), student-number 4종·businessDayKST 심볼 추가, `applyNaesinFreeDerivation → enrollment[]` 정정, 테스트 수 259 갱신, ime-input 보안 경고, history-classifier 분리 정책 문구 갱신
- `.omc/RELEASE_RULE.md` · `.agents/skills/release/SKILL.md` — 소비자 6곳(DashBoard·impact7forms 추가)으로 정정
- `scripts/check-drift.mjs` **신설** — exports↔files↔디스크↔AGENTS.md 표↔테스트 수 대조 (`--no-test` 옵션)
- `package.json` — 1.41.0

## 소비자 영향 (동작 변경 3건 — minor bump 사유)

1. **promote-enroll**: 과거 종료 enrollment만 가진 등원예정 학생이 더 이상 자동 전환되지 않음 (의도된 수정 — 조기 전환 버그 제거)
2. **history-classifier**: 실휴원/가휴원→등원예정 이벤트가 '복귀'로 새로 표시됨 (기존엔 숨김). HISTORY_BADGE 키 7종 불변
3. **student-number**: +82·숫자형 표기에서 파생되는 번호가 표준 표기와 동일해짐 (기발급 번호는 불변 정책상 영향 없음)

## 적용하지 않은 것 (보류 P1~P9)

정책·불변 계약이 걸린 9건은 [action-plan.md](action-plan.md) 보류 표 참고 — 사용자 결정 후 진행.
대표: reconcileEnrollments unknown status 검증(불변 계약 영역), normalizeRegistrationNo dedup 키 통일, 반코드 소문자 정규화 위치, isLate 자정 넘김.

## 다음 단계

1. 커밋 전 pre-commit 가드 절차: simplify → code-review → `--mark`
2. 릴리스(사용자 승인 후): `npm version` 커밋 + `git tag v1.41.0 && git push origin v1.41.0` → 소비자 6곳 자동 갱신
3. 보류 P1~P9 결정
