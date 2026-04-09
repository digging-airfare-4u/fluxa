---
name: open-agent-sdk
description: Build and operate coding agents with @shipany/open-agent-sdk (in-process agent loop). Use when users ask to scaffold an agent app, migrate from @anthropic-ai/claude-agent-sdk, configure allowedTools or permissionMode, integrate MCP servers, add custom tools/subagents, run Open Agent SDK examples, or troubleshoot runtime errors. 也用于“用 open-agent-sdk 搭建智能体、迁移官方 SDK、配置 MCP、排查报错”等请求。
---

# Open Agent SDK

## Overview
Use this skill to scaffold, integrate, and harden agent workflows based on `@shipany/open-agent-sdk`.
Start from minimum permissions and minimum tools, then expand only when the task requires it.

## Workflow
1. Confirm runtime and provider settings.
- Require `Node.js >= 18`.
- Require provider environment variables:
  - `ANTHROPIC_API_KEY`, or
  - `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY` (plus optional `ANTHROPIC_MODEL`).

2. Choose implementation path.
- Bootstrap a new runnable app with `scripts/scaffold-open-agent-app.sh`.
- Integrate into an existing Node/TypeScript project by installing dependency and adding an agent entry file.
- Migrate from official SDK by following `references/migration-and-troubleshooting.md`.

3. Apply safe defaults.
- Prefer `permissionMode: 'acceptEdits'` for coding tasks.
- Set `allowedTools` to the minimum required set.
- Set `cwd` explicitly when scope isolation is needed.

4. Add advanced capabilities only when requested.
- Add `mcpServers` for filesystem/browser/external systems.
- Add custom tools for domain APIs.
- Add subagents (`agents`) for specialized parallel work.

5. Verify before completion.
- Execute at least one real prompt run.
- Report the exact command and output summary.

## Quick Start Commands
Install and run manually:

```bash
npm install @shipany/open-agent-sdk --ignore-scripts
npm pkg set type=module
export ANTHROPIC_API_KEY="<your-key>"
npx tsx src/agent.ts "Read package.json and summarize the project"
```

Bootstrap a full starter project:

```bash
bash scripts/scaffold-open-agent-app.sh ./open-agent-app
```

## Core Patterns
### Blocking prompt API
Use when you need one final result object:

```ts
import { createAgent } from '@shipany/open-agent-sdk'

const agent = createAgent({
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  permissionMode: 'acceptEdits',
  allowedTools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash'],
})

const result = await agent.prompt('Read package.json and summarize the architecture')
console.log(result.text)
```

### Streaming query API
Use when incremental tool events are needed:

```ts
import { query } from '@shipany/open-agent-sdk'

for await (const message of query({
  prompt: 'Find TODOs and propose a refactor plan',
  options: {
    allowedTools: ['Read', 'Glob', 'Grep'],
    permissionMode: 'plan',
  },
})) {
  if (message.type === 'assistant' && message.message?.content) {
    for (const block of message.message.content) {
      if ('text' in block) console.log(block.text)
    }
  }
}
```

## Resource Usage
Use `scripts/scaffold-open-agent-app.sh` to create a runnable starter app quickly.
Use `references/quickstart.md` for complete setup and common templates.
Use `references/migration-and-troubleshooting.md` for migration mapping and error handling.
