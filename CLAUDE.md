# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See [AGENTS.md](./AGENTS.md) for the full project guide, architecture overview, commands, and coding conventions.

## Coding Guidelines

- **Think before coding**: State assumptions explicitly. If uncertain, ask. If multiple approaches exist, present tradeoffs rather than picking silently.
- **Simplicity first**: Write the minimum code that solves the problem. No speculative abstractions, no features beyond the ask, no error handling for impossible scenarios.
- **Surgical changes**: Touch only what you must. Match existing style. Clean up only what your own changes make unused; don't refactor unrelated code without asking.
- **Goal-driven execution**: Define verifiable success criteria. Prefer "write a test that reproduces it, then make it pass" over vague instructions.
