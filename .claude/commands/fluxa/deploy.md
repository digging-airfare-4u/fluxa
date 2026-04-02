---
name: "Fluxa: Deploy"
description: "Deploy Supabase Edge Functions to production"
category: Operations
tags: [deploy, edge-function, supabase]
---

Load the fluxa-ops skill and run the **Deploy** workflow.

Input: $ARGUMENTS (function name to deploy, e.g., "agent", "generate-image")

Follow the Deploy procedure in `.claude/skills/fluxa-ops/SKILL.md` exactly. Prefer CLI deployment, fall back to MCP if CLI fails.
