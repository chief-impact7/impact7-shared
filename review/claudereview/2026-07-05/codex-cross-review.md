# Codex 리뷰(2026-07-05) 교차 대조

대상: `review/codexreview/2026-07-05/` (findings 5건 + action-plan + verification).

## 판정 요약

| Codex 발견 | Claude 재검증 | 판정 |
|-----------|--------------|------|
| #1 HIGH — earliestExpectedTime 문자열 정렬 | 독립 재현 성공 (2개 레인에서 동일 발견) | **일치·확정** (C1) |
| #2 MEDIUM — formatPhone string 계약 위반 | 독립 재현 성공 | **일치·확정** (C5) |
| #3 MEDIUM — 공개 API 문서 drift (모듈 5개·심볼·시그니처) | 독립 재현 성공 + 소비자 실사용 확인 | **일치·확정** (C3) |
| #4 MEDIUM — deriveLevelPeriod 월수 경계·테스트 공백 | 재현 성공 + **타임존 의존 축 추가 발견** | **일치·확장** (C4) |
| #5 LOW — 릴리스 문서 소비자 4곳 vs 6곳 | workflow matrix 대조 확인 | **일치·확정** (C21) |

Codex 발견 5건 전부 유효. 반박된 것 없음. 서로 모순되는 발견도 없음.

## Codex가 잡고 Claude 워크플로우가 놓친 것

- **lockfile 부재로 npm audit 불가** — 릴리스 게이트 관점 지적. 본 리뷰 P9로 승계.
- `.omc/RELEASE_RULE.md` 경로 특정 — Claude 레인은 `.agents/skills/release/SKILL.md`만 지목. 두 파일 모두 수정 대상.

## Claude가 추가로 확정한 것 (Codex 미발견)

| 항목 | 심각도 |
|------|--------|
| C2 datetime·ymdSeoul Intl 재생성 117배 (실측) | HIGH(성능) |
| C4-(b) deriveLevelPeriod 타임존 의존 | MEDIUM |
| C6 branch 숫자 class_number TypeError | MEDIUM |
| C7 computeExpectedArrival null 원소 TypeError | MEDIUM |
| C8 promote-enroll end_date 무시·batch 500·null 원소 | MEDIUM |
| C9 history-classifier 복귀 비대칭 | MEDIUM |
| C10 '종강' 단독 문자열 vs JSON 경로 불일치 | MEDIUM |
| C11 leave-cycles 동률 비결정성 | MEDIUM |
| C12 ime-input 가드·escAttr 계약 위험 | MEDIUM |
| C13 form-components 공백/비문자열 | MEDIUM |
| C14 학생번호 표기별 상이 발급 | MEDIUM |
| C15~C20 (귀가 라벨, 오프셋 정렬, regex 앵커, 전각 학년, 졸업 멱등, 주석) | LOW |

## 수정 방침 차이

- Codex action-plan은 expected-arrival·phone·문서 동기화·drift 스크립트 4묶음. Claude는 이를 포함해 확정 25건 전체를 수정하되, **정책·계약이 걸린 9건(P1~P9)은 사용자 결정 전 보류**.
- Codex의 "동기화 검증 스크립트" 제안 채택 → `scripts/check-drift.mjs` 신설.
- Codex의 deriveLevelPeriod 수정안(일 미달 시 1개월 차감)을 채택하고, 타임존 의존 제거(문자열 직접 파싱)를 추가.
