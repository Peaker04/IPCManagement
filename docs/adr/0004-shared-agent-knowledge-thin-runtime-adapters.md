---
title: Repository-owned agent knowledge with a Pi CLI adapter
status: accepted
owner: GSD
scope: ai-agent-harness
---
# ADR-0004: Repository-owned knowledge with a Pi CLI adapter

## Context

IPCManagement used root instructions and canonical docs alongside Pi project settings that referenced selected skills under `.codex/skills`. `MEMORY.md` had grown to include current state, domain contract and historical narratives. Pi using an OpenAI/Codex provider is still Pi runtime; it does not inherit Codex app tools or configuration.

## Decision

Use one repository-owned knowledge layer and Pi CLI as the sole active runtime:

- `AGENTS.md` remains the shared instruction entry point.
- `MEMORY.md` contains only current pointers and verified observations.
- Product/domain contracts remain under `docs/`; harness governance and runtime mapping live under `docs/harness/`.
- GSD `.planning/` is the only task-state owner; `.artifacts/` and `docs/EVIDENCE-INDEX.md` keep evidence authority.
- Project skills may be authored in `.agents/skills/` and activated by Pi project settings. Existing `.codex/skills` paths are retained as source locations only where Pi explicitly references them; this does not activate Codex app/CLI.
- Existing canonical paths may remain compatibility pointers until consumer and runtime evidence permits retirement.

## Consequences

Fresh Pi sessions load less stale narrative and route to one owner per fact. Using a Codex provider does not import another app/CLI workflow. Migration requires link, discovery, preservation and Pi cold-start checks; external runtimes remain out of scope unless Kỳ opens a separate task.

## Rejected alternatives

- Keep all content in root memory: preserves path compatibility but keeps stale context and mixed authority.
- Put every artifact under one hidden AI directory: breaks native discovery and mixes state/evidence with instructions.
- Add RAG/vector memory or background self-learning in v1: introduces another state owner and trust surface without measured need.
