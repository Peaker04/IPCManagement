---
quick_id: 260802-ola
status: complete
mode: validate
date: 2026-08-02
---

# Synchronize FE/BE and establish Shipyard evidence baseline

## Goal

Prove the current checkout, generated API contracts, frontend/backend builds, guarded database lane,
Shipyard runtime, and canonical route/tab inventory all refer to the same project state before any UI edit.

## Constraints

- Do not open a roadmap phase or execute long waves.
- Do not reset, seed, import, restore, sanitize, or otherwise mutate `ipc_lane1`.
- Do not change business behavior, policy, API, cache, lifecycle, or route access.
- Use headed Chrome and the five viewports declared in `MEMORY.md` for visual evidence.
- Preserve unrelated worktree changes and do not push.

## Tasks

1. Run deterministic API-contract generation/check and the current root verification gate; require a clean diff.
2. Boot current-source API/frontend/Shipyard, verify `/health/ready` uses the guarded lane, and measure whether existing data is sufficiently dense without mutation.
3. Capture headed evidence for the authoritative route/tab/state inventory, recording final screenshots, requests/responses, console/page errors, CLS, and long tasks.

## Done

- FE/BE contract and build/test gates agree with the checkout.
- Shipyard renders meaningful current-lane data across the canonical inventory.
- Evidence is complete enough to authorize small, source-owned UI quick tasks.
- No production UI edit or database mutation occurs in this baseline task.
