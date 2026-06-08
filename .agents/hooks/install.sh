#!/bin/sh
# pre-commit 훅 설치 — 레포 클론 후 한 번만 실행
set -eu

HOOKS_DIR="$(git rev-parse --git-path hooks)"
mkdir -p "$HOOKS_DIR"
HOOK="$HOOKS_DIR/pre-commit"

if [ -f "$HOOK" ] && ! grep -q 'impact7-precommit-quality-guard' "$HOOK"; then
  echo "[impact7] 기존 pre-commit 훅 발견: $HOOK"
  echo "[impact7] 백업: ${HOOK}.bak"
  cp "$HOOK" "${HOOK}.bak"
fi

cat > "$HOOK" << 'EOF'
#!/bin/sh
exec node "$(git rev-parse --show-toplevel)/.agents/hooks/impact7-precommit-quality-guard.mjs" --check
EOF

chmod +x "$HOOK"
echo "[impact7] pre-commit hook installed: $HOOK"
