---
name: impact7-shared-module
description: >
  impact7-shared에 새 순수 함수 모듈을 추가하거나 기존 모듈을 수정할 때 사용. 모듈 작성 → 테스트 → exports 등록 → 품질 검증 → 버전 bump 전 과정을 에이전트 팀으로 처리. "새 모듈", "모듈 추가", "함수 추가", "impact7-shared에 추가", "모듈 수정", "재실행", "보완", "이전 결과 기반으로"가 트리거.
---

# impact7-shared 모듈 추가 오케스트레이터

## 트리거

- "새 [모듈명] 모듈 추가"
- "impact7-shared에 [기능] 함수 작성"
- "공유 패키지에 [기능] 추가"

## Phase 1: 컨텍스트 확인

요청이 다음 중 어느 경우인지 판별한다:
- **신규 모듈**: 전혀 새로운 `.js` 파일
- **기존 모듈 확장**: 이미 있는 파일에 함수 추가
- **리팩토링**: 기존 함수 서명·구조 변경 (SSoT 계약 확인 필수)

## Phase 2: 모듈 작성 (module-author 에이전트)

`module-author` 에이전트를 호출한다:

```
Agent(module-author):
  - 모듈명: {name}
  - 기능 설명: {description}
  - 생성할 파일: {name}.js + {name}.test.js
  - package.json exports/files 업데이트 포함
```

## Phase 3: 품질 검증 (quality-guard 에이전트)

`quality-guard` 에이전트를 호출한다:

```
Agent(quality-guard):
  - 테스트 전체 실행
  - exports/files 정합성 확인
  - 외부 의존성 없음 확인
  - SSoT 계약 불변성 확인
```

품질 검증 통과 시 → Phase 4 진행
실패 시 → module-author에게 수정 위임 후 재검증

## Phase 4: 버전 bump 확인

사용자에게 최종 확인:
- 새 모듈 추가/기능 추가 → 패치 버전 bump
- breaking change → minor/major bump + 소비자 패키지 알림 필요

## 제약

- SSoT 계약(AGENTS.md "불변 계약" 항목) 변경 시 반드시 사용자 확인
- `promote-enroll.js` 처럼 Firebase 의존이 있는 경우 팩토리 패턴 강제
- 모든 새 모듈은 테스트 없이 완료할 수 없음
