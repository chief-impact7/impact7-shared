---
name: release
description: >
  impact7-shared 릴리스를 수행할 때 사용. 버전 bump → 태그 push → GitHub Actions가 소비자 4곳 자동 업데이트까지 처리. "릴리스", "배포", "버전 올려", "태그", "소비자 업데이트", "publish"가 트리거.
---

# impact7-shared 릴리스 오케스트레이터

## 트리거

- "릴리스해", "배포해", "버전 올려"
- "소비자 업데이트", "태그 만들어"
- "patch/minor/major 릴리스"

## Phase 1: 컨텍스트 확인

먼저 판별한다:
- **어떤 bump 타입인가?** patch / minor / major
  - breaking change (시그니처·구조 변경) → minor 이상 필수. 소비자 영향 먼저 확인.
  - 새 함수·버그픽스 → patch
- 사용자가 명시하지 않으면 커밋 이력(`git log --oneline -5`)을 보고 제안한다.

## Phase 2: 사전 검증

릴리스 전 품질 기준 충족 여부 확인:

```bash
npm test
```

테스트 실패 시 → 릴리스 중단, 실패 항목 보고.

## Phase 3: 버전 bump + 태그 push

```bash
npm version <patch|minor|major> --message "chore: v%s"
git push origin main --tags
```

`npm version`은 자동으로:
1. `package.json` version 올림
2. git commit 생성
3. git tag 생성

`--tags` push로 GitHub Actions `notify-consumers.yml`이 트리거됨.

## Phase 4: Actions 실행 확인

```bash
gh run list --repo chief-impact7/impact7-shared --limit 1
gh run watch <run-id> --repo chief-impact7/impact7-shared
```

Actions 결과:
- ✅ 전체 성공 → 소비자 4곳 자동 업데이트 완료
- ❌ 실패 항목 → 원인 보고 후 수동 재실행 방법 안내

## 제약

- breaking change는 반드시 사용자 확인 후 진행
- `npm update @impact7/shared`는 태그 고정 방식에서 동작 안 함 — 항상 태그 push로 릴리스
- CONSUMER_UPDATE_TOKEN 시크릿이 만료되면 Actions 실패 — `gh secret set`으로 갱신 필요
