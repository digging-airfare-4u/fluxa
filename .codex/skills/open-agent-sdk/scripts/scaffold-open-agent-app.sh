#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scaffold-open-agent-app.sh [target_dir] [--model MODEL] [--no-install]

Examples:
  scaffold-open-agent-app.sh ./open-agent-app
  scaffold-open-agent-app.sh ./open-agent-app --model claude-sonnet-4-6
  scaffold-open-agent-app.sh ./open-agent-app --no-install
USAGE
}

TARGET_DIR="open-agent-app"
MODEL="${ANTHROPIC_MODEL:-claude-sonnet-4-6}"
NO_INSTALL="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --model)
      if [[ $# -lt 2 ]]; then
        echo "[ERROR] --model requires a value" >&2
        exit 1
      fi
      MODEL="$2"
      shift 2
      ;;
    --no-install)
      NO_INSTALL="1"
      shift
      ;;
    *)
      TARGET_DIR="$1"
      shift
      ;;
  esac
done

mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

echo "[INFO] Working directory: $(pwd)"

if [[ ! -f package.json ]]; then
  echo "[INFO] Initializing package.json"
  npm init -y >/dev/null
fi

if [[ "$NO_INSTALL" == "0" ]]; then
  echo "[INFO] Installing dependencies"
  npm install @shipany/open-agent-sdk --ignore-scripts
  npm install -D typescript tsx @types/node
else
  echo "[INFO] Skip dependency installation (--no-install)"
fi

mkdir -p src

cat > src/agent.ts <<'TS'
import { createAgent } from '@shipany/open-agent-sdk'

const agent = createAgent({
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  cwd: process.cwd(),
  permissionMode: 'acceptEdits',
  allowedTools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash'],
  maxTurns: 40,
})

const prompt = process.argv.slice(2).join(' ') || 'Read package.json and summarize this project.'

const result = await agent.prompt(prompt)
console.log(result.text)
TS

if [[ ! -f tsconfig.json ]]; then
  cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
JSON
fi

if [[ ! -f .env.example ]]; then
  cat > .env.example <<EOF_ENV
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=${MODEL}
# Optional: Use a compatible provider endpoint
# ANTHROPIC_BASE_URL=https://openrouter.ai/api
EOF_ENV
fi

if [[ ! -f .gitignore ]]; then
  cat > .gitignore <<'EOF_GI'
node_modules/
.env
EOF_GI
else
  grep -q '^node_modules/$' .gitignore || echo 'node_modules/' >> .gitignore
  grep -q '^.env$' .gitignore || echo '.env' >> .gitignore
fi

if command -v npm >/dev/null 2>&1; then
  npm pkg set type=module >/dev/null || true
  npm pkg set scripts.agent='tsx src/agent.ts' >/dev/null || true
fi

echo "[OK] Starter app created"
echo "Next steps:"
echo "  1) cp .env.example .env"
echo "  2) Edit .env and set ANTHROPIC_API_KEY"
echo "  3) npm run agent -- \"Read package.json and summarize the project\""
