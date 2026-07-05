# Verification — 재현 명령과 실제 출력

모든 명령은 저장소 루트(`/Users/jongsooyi/projects/impact7-shared`)에서 실행. 기준: v1.40.0, `npm test` 233/233 통과 상태.

## V-C1. earliestExpectedTime 사전순 정렬 (C1)

```sh
node --input-type=module -e "import { earliestExpectedTime } from './expected-arrival.js'; console.log(earliestExpectedTime({ enrollments:[{ schedule:{월:'9:30'}, level_symbol:'H', class_number:'101' },{ schedule:{월:'10:00'}, level_symbol:'H', class_number:'102' }], dayName:'월', classSettings:{}, date:'2026-07-06' }));"
```
```text
10:00        # 기대값 9:30
```

## V-C9. datetime Intl 재생성 벤치마크 (C2)

5,000회 반복, Node 로컬 실행:
```text
formatTimeKST  5000회: 933ms (186.7µs/call)
businessDayKST 5000회: 886ms (177.1µs/call)
캐시 포맷터     5000회:   8ms (  1.6µs/call)   # 117배
출력 동일성: true ("오후 2:30")
```

## V-C24. AGENTS.md drift (C3)

```sh
grep -c 'expected-arrival\|attendance-log\|attendance-action\|form-slug\|form-components\|businessDayKST' AGENTS.md   # → 0
grep -n '193개' AGENTS.md    # "현재 193개 통과" — 실제 233
```
소비자 실사용: `impact7DB/functions-shared/src/tabletCheckinHandler.js:11` — `import { isLate } from '@impact7/shared/expected-arrival'`.

## V-C3. deriveLevelPeriod (C4)

```text
deriveLevelPeriod([{start_date:'2026-01-31'}], '2026-02-01') → { start:'2026-01-31', label:'1개월' }  # 실제 1일
deriveLevelPeriod([{start_date:'2026-06-20'}], '2026-07-05') → { start:'2026-06-20', label:'1개월' }  # 실제 15일
deriveLevelPeriod([{start_date:'2025-07-31'}], '2026-07-01') → { start:'2025-07-31', label:'1년' }    # 실제 약 11개월
grep -c deriveLevelPeriod enrollment-derivation.test.js → 0   # 테스트 부재
```

## V-C4. formatPhone 반환 타입 (C5)

```text
formatPhone(123) → typeof number, 값 123   # 계약: → string
```

## V-C5. branch 숫자 크래시 (C6)

```text
branchFromClassNumber(101)                          → THROW: (num || "").trim is not a function
branchesFromStudent({enrollments:[{class_number:101}]}) → THROW: 동일
```

## V-C2. computeExpectedArrival null 원소 (C7)

```text
computeExpectedArrival({ enrollments:[null], ... }) → THROW: Cannot read properties of null (reading 'start_date')
```

## C8. promote-enroll (코드 검증)

- `promote-enroll.js:9` — `(s.enrollments || []).some(e => e.start_date && e.start_date <= today)`: end_date 미확인 + 원소 null 가드 없음.
- `promote-enroll.js:13-30` — 학생당 batch.update + batch.set(2 ops), 단일 `batch.commit()`. Firestore 한도 500 ops → 250명 초과 시 전체 실패.
- enrollments가 종료 이력을 보유한다는 근거: `deriveClassPeriodHistory`·`computeExpectedArrival`의 end_date 필터가 그 전제로 설계됨.

## V-C8. 복귀 비대칭 (C9)

```text
classifyHistory({change_type:'UPDATE', before:'상태:실휴원', after:'상태:등원예정'}) → null   # 숨겨짐
# 반면 pause 기반 경로는 '등원예정'을 복귀로 인정 (history-classifier.js:95)
```

## V-C7. '종강' 단독 문자열 (C10)

```text
parseStatusClass('종강') → { status:'', classes:'', pauseStart:'' }
classifyHistory({change_type:'WITHDRAW', before:'종강', after:'퇴원'}) → { label:'퇴원', from:'재원', to:'퇴원' }  # from이 '재원'으로 둔갑
```

## V-C10. leave-cycles 동률 비결정성 (C11)

```text
같은 날짜(2026-03-01)의 휴원요청 a + 복귀요청 b:
groupLeaveCycles([a,b]).length → 1   # 한 사이클로 묶임
groupLeaveCycles([b,a]).length → 2   # 재등원 카드 + 휴원 카드로 분리
```

## C12. ime-input (코드 검증 + 소비자 대조)

- `oninput="if(!this._c)${handlerCall}"` — 블록 없는 if.
- escAttr는 HTML 엔티티 escape → 어트리뷰트 값은 JS 실행 전 HTML 디코드되므로 `'` breakout 차단 불가.
- 소비자 전수: `class-detail.js:112` 고정 함수명, `student-detail.js:1635` `saveExtraVisit('${escAttr(studentId)}', ...)` — Firestore ID만 삽입, 사용자 자유 텍스트 삽입 사례 없음 → 현재 악용 경로 없음.

## V-C19. form-components 공백/비문자열 (C13)

`pick()`의 `(groupSource && groupSource[key]) || 기본값` — `' '` truthy → 기본값 미적용, `{}` → `"[object Object]"` 강제 변환.

## V-C15. 학생번호 표기 불일치 (C14)

```text
deriveFromSource({student_phone: 1012345678}, 'student_phone')      → "101234"
deriveFromSource({student_phone: '+82-10-1234-5678'}, 'student_phone') → "821012"
deriveFromSource({student_phone: '010-1234-5678'}, 'student_phone')  → "123456"   # 같은 전화, 세 가지 번호
```

## V-C18 / V-C16. attendance-log (C15·C16)

```text
departureOrder([{type:'귀가', occurred_at:'...'}]).length → 0   # 구 라벨 누락
arrivalOrder([{id:'late', occurred_at:'2026-07-01T06:05:00Z'}, {id:'early', occurred_at:'2026-07-01T09:00:00+09:00'}])
  → ['late','early']   # early(KST 09:00)가 late(KST 15:05)보다 이른데 뒤로 밀림
```

## V-C13. '상태' regex 오파싱 (C17)

```text
parseStatusClass('특이사항: 건강상태:양호, 기타') → { status:'양호', ... }
```

## V-C20 / V-C13b. student-label (C18·C19)

```text
studentFullLabel({level:'중등', grade:'２', school_middle:'봉영여자중학교'}) → "봉영여중"   # 학년 소실
normalizeRealLevelGrade({level:'졸업', grade:1}) → { level:'초등', grade:1, graduated:false }   # 비멱등
```

## V-C11. leave-cycles withdraw 카드 endDate (C23)

```text
groupLeaveCycles([{request_type:'퇴원요청', withdrawal_date:'2026-05-01', ...}])[0]
  → { type:'withdraw', endDate:'2026-05-01', withdrawalDate:'2026-05-01', ... }
# 헤더 주석 "endDate는 휴원 종료일만 담는다"와 상충. 소비자는 폴백 체인으로 읽어 실해 없음.
```

## 보류 항목 재현 (P1~P8)

```text
reconcileEnrollments('휴원', [...])           # 7종 밖 status → {enrollments:[...], valid:true} 무검증 통과
normalizeRegistrationNo('010-1234-5678')      → "12345678"  vs 파생번호 "123456" — 키 불일치
enrollmentCode({level_symbol:'ha', ...})      → "ha101" — classSettings['HA101'] 조회 실패
isLate('00:30','22:00')                       → false      # 자정 넘김
isSameTeacher('edward@gmail.com','edward@impact7.kr') → true
leaveRequestSortKey({created_at:{seconds:1751000000}}) → 0   # POJO Timestamp 소실
getDayName('2026-02-30')                      → "월"       # rollover
```

## 기각 근거 (R1)

```text
applyNaesinFreeDerivation에 미래 시작(start_date '2099-01-01') 명시 내신을 넣으면 내신 2건 반환되나,
모듈 헤더 계약: "입력 current: 이미 날짜 필터링(미시작·종료 제외)이 끝난 활성 enrollment 배열"
→ 전제가 계약 위반 입력. computeExpectedArrival 경유 시 해당 항목은 사전 필터됨.
```
