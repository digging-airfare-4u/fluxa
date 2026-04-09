# Open Agent SDK Quickstart

## Prerequisites
- Node.js 18+
- npm available
- Valid model provider credentials

## Provider Environment
### Anthropic direct
```bash
export ANTHROPIC_API_KEY="<your-key>"
```

### OpenRouter or compatible provider
```bash
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_API_KEY="<your-openrouter-key>"
export ANTHROPIC_MODEL="anthropic/claude-sonnet-4-6"
```

## Quick Project Bootstrap
Run the bundled scaffold script from this skill directory:

```bash
bash scripts/scaffold-open-agent-app.sh ./open-agent-app
cd ./open-agent-app
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY
npm run agent -- "Read package.json and summarize the project"
```

## Manual Setup
```bash
npm init -y
npm install @shipany/open-agent-sdk --ignore-scripts
npm install -D typescript tsx @types/node
npm pkg set type=module
```

Create `src/agent.ts`:

```ts
import { createAgent } from '@shipany/open-agent-sdk'

const agent = createAgent({
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  cwd: process.cwd(),
  permissionMode: 'acceptEdits',
  allowedTools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash'],
})

const prompt = process.argv.slice(2).join(' ') || 'Read package.json and tell me the project name.'
const result = await agent.prompt(prompt)
console.log(result.text)
```

Run:

```bash
npx tsx src/agent.ts "Find duplicated utilities and propose a cleanup plan"
```

## Pattern Snippets
### Multi-turn session
```ts
import { createAgent } from '@shipany/open-agent-sdk'

const agent = createAgent({ model: 'claude-sonnet-4-6' })
await agent.prompt('Analyze repository structure')
const result = await agent.prompt('Now refactor error handling in the API layer')
console.log(result.text)
```

### Add MCP server
```ts
import { createAgent } from '@shipany/open-agent-sdk'

const agent = createAgent({
  mcpServers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    },
  },
})
```

### Add budget guardrails
```ts
import { createAgent } from '@shipany/open-agent-sdk'

const agent = createAgent({
  maxTurns: 30,
  maxBudgetUsd: 2,
})
```
