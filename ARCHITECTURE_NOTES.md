# ARCHITECTURE_NOTES (Week 1 MVP)

This repo is a fork of Roo Code. The Week 1 MVP adds a **deterministic governance middleware** that:

- forces an **Intent Handshake** before any mutating action
- enforces **owned scope** (intent → allowed file globs)
- produces **AI-native trace artifacts** in a workspace sidecar directory: `.orchestration/`

## Where the extension builds the System Prompt

- `src/core/webview/generateSystemPrompt.ts`
    - calls `SYSTEM_PROMPT(...)` in `src/core/prompts/system.ts`
    - tool-use guidance comes from `src/core/prompts/sections/tool-use.ts`

MVP change:

- `src/core/prompts/sections/tool-use.ts` now includes the mandatory rule:
    - **call `select_active_intent(intent_id)` before commands or file mutations**

## Where tool calls are executed (the “tool loop”)

All tool calls are executed from:

- `src/core/assistant-message/presentAssistantMessage.ts`

This file:

- streams assistant blocks (`text`, `tool_use`, `mcp_tool_use`)
- validates tool calls (`src/core/tools/validateToolUse.ts`)
- dispatches each tool via a `switch (block.name)` (e.g. `write_to_file`, `execute_command`, etc.)

MVP changes:

- `presentAssistantMessage.ts` now wraps **every** tool execution with:
    - `preToolUse(...)` (governance gate)
    - `postToolUse(...)` (trace + intent_map updates)
- new native tool case added:
    - `select_active_intent`

## The Hook Engine (middleware boundary)

- `src/hooks/HookEngine.ts`

### PreToolUse (governance)

For complete tool calls, `preToolUse`:

- **requires an intent** before:
    - any mutating tool (`write_to_file`, `apply_diff`, `edit`, `edit_file`, `apply_patch`, `generate_image`, …)
    - `execute_command`
- **enforces owned_scope** for mutating tools (simple glob → regex matcher)
- blocks obvious destructive command patterns for MVP (e.g. `rm -rf`, `mkfs`, `dd if=...`)

### PostToolUse (trace + map)

For mutating tools, `postToolUse`:

- appends a JSONL record to `.orchestration/agent_trace.jsonl`
    - includes `intent_id`, `tool`, `mutation_class`, `content_hash` (sha256), and best-effort line ranges
- updates `.orchestration/intent_map.md` with `- INT-xxx: relative/path`

## The Intent Handshake tool

Tool definition (exposed to the model):

- `src/core/prompts/tools/native-tools/select_active_intent.ts`

Tool implementation (executed in the extension host):

- `src/core/tools/SelectActiveIntentTool.ts`

Behavior:

- reads `.orchestration/active_intents.yaml`
- validates `intent_id`
- sets in-memory task state:
    - `task.activeIntentId`
    - `task.activeIntent`
- returns a compact `<intent_context>...</intent_context>` block (constraints + owned_scope + acceptance criteria)

Task state storage:

- `src/core/task/Task.ts` now includes `activeIntentId` + `activeIntent` (MVP handshake memory)

## The `.orchestration/` data model (sidecar storage)

Utilities:

- `src/hooks/orchestration/store.ts`

Files:

- `.orchestration/active_intents.yaml` — authoritative list of intents and constraints
- `.orchestration/agent_trace.jsonl` — append-only trace ledger (AI-native attribution)
- `.orchestration/intent_map.md` — human-friendly map intent → files

The store utilities:

- ensure scaffold exists (create missing files)
- read/write YAML using the existing `yaml` dependency (already used in repo)
- append JSONL trace records

## Minimal execution flow (MVP)

1. User asks for a change.
2. Model calls `select_active_intent(intent_id)`.
3. Tool returns `<intent_context>` from `.orchestration/active_intents.yaml`.
4. Model calls mutating tools / execute_command.
5. HookEngine:
    - **PreToolUse** blocks if no intent or scope violation
    - **PostToolUse** appends trace + updates intent_map
