# ChatCanvas Product Overview

ChatCanvas is an AI-powered design generation platform that enables users to create visual designs through natural language conversation.

## Core Concept

Users describe their design needs in chat, and AI generates canvas operations (ops) that are executed on a Fabric.js canvas. The system follows an ops-driven architecture where all canvas modifications are represented as discrete, replayable operations.

## Key Features

- **Conversational Design**: Chat-based interface for describing design requirements
- **AI-Generated Ops**: LLM generates structured canvas operations from prompts
- **Real-time Canvas**: Fabric.js-based infinite canvas with pan/zoom
- **Project Management**: Multi-project support with documents and conversations
- **Asset Management**: Upload, AI-generate, and export images
- **Async Job Processing**: Background jobs for image generation

## User Flow

1. User creates a project from the home page (optionally with an initial prompt)
2. Project opens in the editor with canvas and chat panel
3. User describes designs in chat → AI generates ops → ops execute on canvas
4. User can manually edit, export, or continue iterating via chat

## Target Users

Designers and non-designers who want to quickly create visual designs (posters, social media graphics, marketing materials) using natural language.
