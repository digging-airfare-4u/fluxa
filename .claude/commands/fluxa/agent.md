---
name: "Fluxa: Agent"
description: "Tune Agent planner/executor prompts, adjust behavior, and deploy changes"
category: Operations
tags: [agent, prompt, tuning, planner, executor]
---

Load the fluxa-ops skill and run the **Agent** workflow.

Input: $ARGUMENTS (what to tune, e.g., "make planner prefer image generation", "add tool X")

Follow the Agent procedure in `.claude/skills/fluxa-ops/SKILL.md` exactly. Read current prompts first, make targeted edits, deploy immediately, then commit after verification.
