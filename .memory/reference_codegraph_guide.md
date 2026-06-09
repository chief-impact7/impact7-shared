---
name: reference-codegraph-guide
description: codegraph 인덱스 현황 + 모듈별 핵심 쿼리 패턴 — 이 프로젝트에서 코드를 탐색할 때 먼저 확인
metadata:
  type: reference
---

# impact7-shared codegraph 활용 가이드

**인덱스 현황 (2026-06-09 기준)**
- 파일 20개 · 노드 140개 · 엣지 203개 · DB 0.35 MB
- 언어: JavaScript 19, YAML 1
- 모든 모듈에 `.test.js` 존재 — `node --test`로 검증 가능

## 패키지 구조

```
@impact7/shared v1.26.1 — DB·DSC·HR·exam·qbank가 import하는 순수 함수 라이브러리
```

## export map → 파일 매핑

| import 경로 | 파일 | 역할 |
|-------------|------|------|
| `@impact7/shared/history` | `history-classifier.js` | 이력 로그 분류·뱃지 |
| `@impact7/shared/enrollment-status` | `enrollment-status.js` | status↔수강 정합성 |
| `@impact7/shared/enrollment-derivation` | `enrollment-derivation.js` | 수강 파생 로직 |
| `@impact7/shared/class-move` | `class-move.js` | 반 이동 |
| `@impact7/shared/promote-enroll` | `promote-enroll.js` | 승격 등록 |
| `@impact7/shared/student-number` | `student-number.js` | 학생번호 파생 |
| `@impact7/shared/student-label` | `student-label.js` | 학생 표시 라벨 |
| `@impact7/shared/staff-label` | `staff-label.js` | 직원 라벨 |
| `@impact7/shared/datetime` | `datetime.js` | 날짜 유틸 |

## 모듈별 codegraph_explore 핵심 쿼리

| 모듈 | 쿼리 예시 |
|------|----------|
| 학생 표시 라벨 | `"studentFullLabel schoolLevelGradeLabel studentSearchTerms normalizeSchoolForLabel"` |
| 학생번호 | `"deriveStudentNumber studentNumberIdentityKey studentNumberNameKey"` |
| 수강 상태 정합성 | `"ENROLLABLE_STATUSES reconcileEnrollments selectableStatuses STATUS_TONE isEnrollableStatus"` |
| 수강 파생 | `"enrollment-derivation getActiveEnrollments enrollmentCode"` |
| 이력 로그 분류 | `"history-classifier HISTORY_BADGE shortAuthor classifyHistory"` |
| 반 이동 | `"class-move classMove moveEnrollment"` |
| 승격 등록 | `"promote-enroll promoteEnroll buildPromoteEnrollment"` |
| 직원 라벨 | `"staff-label staffLabel staffShortLabel"` |
| 날짜 유틸 | `"datetime formatDateKST formatDateTimeKST parseDateKST"` |

## 핵심 불변 규칙

- **history-classifier vs enrollment-status 의도적 분리**: `STATUSES`(로그용)와 `ENROLLABLE_STATUSES`(저장용)는 다름. 상태 추가 시 두 파일 동시 확인.
- **학생 표시는 항상 `studentFullLabel(student)`**: school+level+grade를 직접 문자열 조합하지 않는다.
- **학교·학부·학년 개별 표시는 `schoolLevelGradeLabel({school, level, grade})`** 사용.
- 이 패키지는 순수 함수만 포함 — Firebase·DOM·외부 의존 없음.

## 주의: 테스트 있음

다른 프로젝트와 달리 `*.test.js`가 존재한다. 수정 후 반드시 테스트 실행:
```bash
node --test
```
