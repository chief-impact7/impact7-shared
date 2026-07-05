# P1~P9 보류 항목 진행 결과 — 2026-07-05 (2차)

사용자 승인으로 보류 9건을 진행했다. 절차: 소비자 사용처 조사 → 정책 확정 → 구현 → **ultracode 적대적 검증(변경별 파괴 시도 9 + 완전성 비판 1)** → 검증이 찾아낸 회귀 2건 수정.

## 결과 요약

| # | 항목 | 결정·구현 | 적대적 검증 |
|---|------|----------|------------|
| P1 | reconcileEnrollments unknown status | 7종 밖 status → `valid:false` + reason (반환 형태 불변). 소비자 조사: UI select가 7종을 강제하고 firestore.rules도 서버에서 거부 — 정상 경로 유입 불가 확인 | OK |
| P2 | normalizeRegistrationNo 비교 키 | 파생 규칙과 동일한 6자리 키로 축약(+82·앞 0 소실·8자리·'00' 패딩 통합). 소비자 사용처 0건(신규 API)이라 안전 | OK — 6자리 충돌은 파생 체계 자체의 입도이며 identityKey(이름\|번호)가 방어 |
| P3 | 반코드 소문자 미정규화 | `classSettingsGet(cs, code)` 신설(class-code.js) — 표기 차이 양방향 흡수. enrollment-derivation 4곳·expected-arrival startTime 적용. 파생 결과의 class_number는 원본 유지 | CONCERN — 소비자 후속 3건(아래) |
| P4 | 자유학기 활성 시 정규 노출 | 코드 무관 전량 숨김(헤더 계약·내신 분기와 대칭). 반 명부는 raw enrollments 직조회라 소실 없음 확인 | CONCERN — 정규 2개 학생 시나리오 테스트 추가로 고정 |
| P5 | isLate 자정 넘김 | **구현했다가 검증에서 BROKEN → 되돌림.** 같은 날 비교 계약을 명문화 | BROKEN → 회귀 제거 |
| P6 | isSameTeacher 도메인 | 내부 도메인(impact7.kr·gw.impact7.kr·도메인 없는 ID)만 로컬파트 병합, 외부는 완전 일치. canonicalize도 동일 | CONCERN — payments 미러 drift(아래) |
| P7 | Timestamp POJO 지원 | datetime toDate·leave-cycles toMs에 {seconds}/{_seconds} 지원. **1차 구현이 BROKEN → falsy 오분류·Invalid Date 미검증 수정** | BROKEN → 수정 완료 |
| P8 | getDayName rollover | 실존 검증 추가('2026-02-30'→''). dayName '' 시 computeExpectedArrival 안전(요일 필터 미매칭) 확인 | OK |
| P9 | audit 불가 대체 게이트 | check-drift에 순수 패키지 경계 정적 검사 + RELEASE_RULE 공식 게이트 명시. **검증이 우회 2종(re-export·표현식 동적 import) 발견 → regex 보강 + scanExternalImports 단위 테스트 신설** | CONCERN → 보강 완료 |

## 적대적 검증이 잡아낸 회귀 (수정 완료)

### P5 — isLate 720분 휴리스틱 (BROKEN → 되돌림)

- DSC `DailyLogBoard.jsx:84`는 `isLate(현재시각, 예정)`으로 미등원 학생을 분류 — 오전 09:30 조회 시 예정 22:00 학생 전원이 '미도착(연락)'으로 오분류.
- 태블릿 `tabletCheckinHandler.js`는 todayKST(달력일) 기반이라 의도한 '전날 22:00 예정' 케이스는 도달 불가, 반대로 자정 직후 등원이 새 날 오후 예정과 비교돼 **오탐 지각 알림톡 발송** 위험.
- 결론: 시각만으로는 방향(지각 vs 이른 등원) 구분 불가 → 원 동작 복원 + "같은 날 비교" 계약을 JSDoc·AGENTS.md·테스트로 명문화. 자정 넘김 판정이 필요하면 호출자가 businessDayKST 기준으로 날짜를 짝지어야 한다.

### P7 — toDate falsy 오분류 (BROKEN → 수정)

- `const sec = value && (...)` + `sec != null` 조합이 `''`·`NaN`·`false`를 POJO 경로로 흘려 `formatDateKST('')` → `'1970-01-01'`, `formatTimeKST(NaN)` → RangeError 크래시.
- 수정: `value == null ? null : typeof value.seconds === 'number' ? …` + POJO 경로에 Invalid Date 검증. 회귀 테스트 3건 추가(falsy·범위 밖 seconds·epoch 0 유지).

## 검증 게이트 (최종)

```text
npm test                     → tests 280 / pass 280 / fail 0
node scripts/check-drift.mjs → ✓ drift 없음 (모듈 21개 + 패키지 경계)
P7 재확인: formatDateKST('')="" formatTimeKST(NaN)="" formatTimeKST({seconds:1e15})=""
P5 재확인: isLate('09:30','22:00')=false isLate('23:00','22:00')=true
```

## 소비자 레포 후속 작업 — 2026-07-05 전건 처리 완료

1. ✅ **impact7DB** `functions-shared/src/expectedArrivalLoader.js` — `normalizeClassCode(code)` 병행 fetch 적용. canonical 문서가 classSettings 맵에 실려 서버 지각 판정 경로에서도 표기 차이 흡수. 검증: functions-shared vitest 566/566 통과.
2. ✅ **impact7newDSC** `student-helpers.js`에 `csGet(classSettings, code)` 로컬 브리지 신설(정확 일치 → normalizeClassCode 키, v1.40.0 API만 사용 — 릴리스 전에도 동작). 학생 데이터 유입 경로 교체: naesin.js:61(파생 cs)·getNaesinTime·teacher 조회, student-helpers isFreeSemesterActiveToday·getStudentStartTime. 설정 UI가 자기 키로 순회하는 조회·쓰기 경로는 불일치 소스가 아니라 의도적으로 미변경. 검증: node --check 통과, npm test 통과(node 8스위트 + vitest 33), vite build 성공.
3. ✅ **impact7newDSC** `.memory/project_class_type_logic.md` — 자유학기 규칙을 '정규 전량 숨김(shared v1.41부터 반코드 무관)'으로 갱신.
4. ✅ **payments** `functions/src/sync.ts` (lib는 빌드 산출물이라 원본 수정) — teacherPersonKey 도입: 내부 도메인(impact7.kr·gw.impact7.kr)만 로컬파트 병합, 외부 도메인은 자체 키. 외부 키는 HR englishName 매칭에서 자연 제외. 검증: tsc 빌드 성공, Firestore 에뮬레이터에서 sync.test.ts 17/17 통과.
5. ✅ **운영 점검** — ADC로 impact7db teachers 컬렉션 조회(읽기 전용): 총 42건, `@gw.impact7.kr` 22 + `@impact7.kr` 20, **외부 도메인 문서 0건** → P6 강화 규칙의 현재 운영 영향 없음 확인.

> 소비자 레포 변경은 각 레포 워킹트리에 **미커밋** 상태. impact7DB·DSC 변경은 shared v1.41.0 릴리스 전에도 무해(1.40.0 API만 사용)하며, 릴리스 후 케이스 불일치 흡수가 완성된다.

## 남긴 것 (의도적)

- P3: 정규형 키 없이 비정규 설정 키만 복수(ha101+Ha101 공존)일 때 스캔이 삽입순 의존 — 실데이터에서 비현실적, 각주로만 기록.
- P2: 011 구번호·유선 등 비실재 표기는 여전히 키 불일치(dedup 미탐 방향이라 오병합 없음).
- 잔여 동작 변경으로 v1.41.0 minor bump 유지 (릴리스 노트에 P1·P4·P6·normalizeRegistrationNo 의미 변경 명시할 것).
