# Claude 적대적 리뷰 — 2026-07-05

`@impact7/shared` v1.40.0 (커밋 feb0228) 전 모듈 대상 적대적 코드 리뷰.

## 방법론

- 8개 관점 병렬 리뷰(ultracode 멀티에이전트 워크플로우): 시간 도메인 / enrollment 도메인 / 식별·라벨 / 로그 파싱 / HTML·폼 / 계약 정합성 / 성능 / 적대적 입력
- 원시 발견 57건 → 실제 node 재현으로 전수 검증 (재현 안 되면 기각)
- 검증 축: 정합성(문서·계약·모듈 간 일관성) · 안정성(경계값·오염 입력) · 신뢰성(조용한 오답) · 신속성(실측 벤치마크)
- 소비자 레포(impact7DB·impact7newDSC) 실사용 경로 대조로 심각도 보정

## 결과 요약

| 판정 | 건수 | 내용 |
|------|------|------|
| 확정(CONFIRMED) | 25 | 재현 성공 + 실제 영향 경로 존재 → 수정 대상 |
| 보류(정책 결정 필요) | 9 | 재현되나 수정이 정책·계약 변경을 수반 → 사용자 결정 대기 |
| 기각(REFUTED) | 3+ | 입력 계약 위반 전제이거나 내부 신뢰 계약상 정상 |

## 대표 발견 (심각도순)

1. **earliestExpectedTime 사전순 정렬** — '9:30'과 '10:00' 혼재 시 늦은 시각을 "가장 이른"으로 반환 → 지각 판정 오염 (codexreview와 교차 확인)
2. **datetime 포맷 함수의 Intl.DateTimeFormat 매 호출 재생성** — 실측 186.7µs/call vs 캐시 1.6µs/call (117배). 학생 1000명 렌더 시 187ms
3. **deriveLevelPeriod 월수 과대 계산** — 15일 경과를 '1개월'로 표시. 테스트 0건이던 함수
4. **promote-enroll end_date 무시** — 종료된 과거 enrollment 때문에 등원예정 학생 조기 '재원' 전환 가능 + writeBatch 500 한도 미분할
5. **branch/expected-arrival/promote-enroll TypeError 크래시** — Firestore 원본 배열(시스템 경계)의 숫자·null 원소에서 크래시
6. **AGENTS.md 공개 API 카탈로그 대규모 drift** — 21개 export 중 5개 모듈 통째 누락, 심볼 5종 누락, 테스트 수 193(실제 233)

## 문서 구성

| 파일 | 내용 |
|------|------|
| [findings.md](findings.md) | 확정·보류·기각 전체 발견 목록 (재현 근거 포함) |
| [verification.md](verification.md) | 재현 명령·실제 출력·벤치마크 수치 |
| [codex-cross-review.md](codex-cross-review.md) | codexreview 오늘자 문서와 교차 대조 |
| [action-plan.md](action-plan.md) | 수정 계획·보류 항목·릴리스 절차 |
| [fixes-applied.md](fixes-applied.md) | 실제 적용된 수정·테스트 결과 (수정 후 작성) |
| [p1-p9-applied.md](p1-p9-applied.md) | 보류 P1~P9 진행 결과 (2차) — 적대적 검증이 잡은 회귀 2건(P5·P7) 포함, 소비자 후속 5건 |
