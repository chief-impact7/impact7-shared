# impact7-shared 적대적 감사 요약

- 대상: `/Users/jongsooyi/IMPACT7/impact7-shared`
- 날짜: 2026-07-05
- 방식: codegraph 우선 탐색, 로컬 검증, 독립 `code-reviewer`/`architect` 레인 병렬 검토
- 결론: `REQUEST CHANGES` / Architectural Status `BLOCK`

## 핵심 결론

현재 패키지는 테스트 233개가 모두 통과하고, `exports`와 `files`의 배포 표면도 서로 맞는다. 외부 런타임 의존성 import도 발견되지 않아 순수 함수 패키지의 큰 방향은 유지되고 있다.

하지만 공유 핵심 로직에 실제 correctness bug가 있고, 운영 계약 문서가 실제 공개 API와 어긋나 있다. 이 패키지는 DB, DSC, Forms 등 소비자가 태그 고정으로 가져가는 SSoT라서, 작은 drift도 소비자 전체로 전파될 수 있다.

## 우선순위

1. HIGH: `expected-arrival.js`의 예정 등원 시각 선택이 문자열 정렬에 의존해 `9:30`보다 `10:00`을 먼저 고를 수 있다.
2. MEDIUM: `phone.js`의 `formatPhone(123)`이 number를 반환해 문서상 string 계약을 깬다.
3. MEDIUM: `AGENTS.md` 공개 API 목록이 `package.json` export 표면과 불일치한다.
4. MEDIUM: `deriveLevelPeriod()`의 월수 계산 경계가 과대 표시될 가능성이 있고, 해당 라인 커버리지가 비어 있다.
5. LOW: 릴리스 문서의 소비자 수가 실제 GitHub Actions matrix와 다르다.

## 파일 구성

- `findings.md`: 확정 findings와 근거
- `verification.md`: 실행한 검증 명령과 결과
- `action-plan.md`: 수정 순서와 권장 게이트
- `subagent-reports.md`: 독립 리뷰 레인 결과 요약

