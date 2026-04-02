---
name: "Fluxa: Model"
description: "Manage AI model configurations — switch defaults, enable/disable, add new models"
category: Operations
tags: [model, config, ai-models, system-settings]
---

Load the fluxa-ops skill and run the **Model** workflow.

Input: $ARGUMENTS (what to change, e.g., "switch image model to gemini-2.5-flash", "show current config")

Follow the Model procedure in `.claude/skills/fluxa-ops/SKILL.md` exactly. Always survey current state before making changes, and ensure both ai_models table and system_settings are aligned.
