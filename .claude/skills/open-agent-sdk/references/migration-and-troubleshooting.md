# Migration and Troubleshooting

## Migration from `@anthropic-ai/claude-agent-sdk`

## API Mapping
- Keep `query({ prompt, options })` usage for stream-style workflows.
- Use `createAgent(options)` for reusable sessions.
- Keep `allowedTools` and `permissionMode` semantics aligned.
- Keep environment contract (`ANTHROPIC_API_KEY`, optional base URL/model).

## Migration Steps
1. Replace dependency with `@shipany/open-agent-sdk`.
2. Keep prompts and tool policy unchanged initially.
3. Run one smoke prompt in read-only mode (`Read`, `Glob`, `Grep`).
4. Re-enable write tools (`Edit`, `Write`, `Bash`) only after smoke pass.
5. Add MCP/custom tools/subagents incrementally.

## Common Errors
### `401 Unauthorized` or `Invalid API key`
- Verify `ANTHROPIC_API_KEY` is present in the process environment.
- Verify `ANTHROPIC_BASE_URL` format when using third-party providers.
- Check provider-side model access permissions.

### `Tool not allowed` or unexpected no-op
- Add required tool to `allowedTools`.
- Confirm `permissionMode` is not too restrictive for the task.

### `spawn ENOENT` for MCP command
- Ensure `npx`/binary exists in PATH.
- Test command manually outside the SDK first.

### `Cannot find module ... scripts/create-shims.mjs` during `npm install`
- Install with `npm install @shipany/open-agent-sdk --ignore-scripts`.
- Keep runtime usage on ESM by setting `npm pkg set type=module`.

### Process exits before response completes
- Ensure the script awaits `agent.prompt(...)` or fully drains async generator from `query(...)`.
- Confirm Node runtime is 18+.

## Production Hardening Checklist
1. Pin explicit model via config.
2. Set conservative `maxTurns` and `maxBudgetUsd`.
3. Limit `allowedTools` to the minimum set.
4. Restrict `cwd` to the intended workspace.
5. Add logging around prompt input, tool errors, and final usage.
