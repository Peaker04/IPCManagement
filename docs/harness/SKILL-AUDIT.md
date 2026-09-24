# Skill inventory and routing audit

**Date:** 2026-09-22
**Scope:** repository skill catalog and Pi discovery/routing
**Reference:** `mattpocock/skills@c55ee46073ed923f86ce59a5eb3b6d895095d1b7`
**Process owner:** GSD; this audit does not create a second task system.

## Executive result

The main problem is not missing skills. It is a **discovery and routing mismatch**:

- The repository contains 46 project skills: 44 under `.codex/skills`, one under `.pi/skills`, and one under `.agents/skills`.
- Pi currently discovers only the explicitly allowlisted engineering subset plus user-level skills. Most installed project skills are intentionally hidden.
- The hidden catalog mixes useful disciplines with incompatible process routers, Claude-only automation, one-off setup tools, writing/design utilities, and overlapping interview skills.
- Making all 46 skills visible would increase ambiguity and would violate the Pi/GSD runtime contract. The correct fix is a small routed surface, not a larger menu.
- Local Matt Pocock copies differ from current upstream. They must be reviewed individually; no bulk overwrite or installer run is safe.

## Runtime inventory

| Location | Count | Runtime meaning |
|---|---:|---|
| `.codex/skills` | 44 | Retained source/provenance. Only explicit paths in `.pi/settings.json` are Pi-discovered. |
| `.pi/skills` | 1 | Project Pi skill: `frontend-checklist-global`. |
| `.agents/skills` | 1 | Project-owned shared skill: `harness-maintenance`. |
| User Pi packages | dynamic | Includes Ponytail and pi-subagents; governed separately from project copies. |

Current project-visible disciplines are intentionally narrow: harness maintenance, Karpathy guidelines, diagnosing bugs, TDD, UI styling, IPCManagement sketch findings, and the Front-End Checklist adapter.

## Disposition matrix

### A. Keep active by default

| Skill | Trigger | Notes |
|---|---|---|
| `harness-maintenance` | Pi/GSD/harness/configuration work | Repository-owned authority for this audit and later adapter work. |
| `karpathy-guidelines` | Any code write/review/refactor | Mandatory coding discipline. |
| `diagnosing-bugs` | Broken, failing, slow, runtime/repeated bug | Add after locking a red-capable seam. |
| `tdd` | Behavior change/regression or explicit test-first request | Behavior tests, not source-string tests where feasible. |
| `frontend-checklist-global` | Any frontend audit/change | Project adapter is the only active Front-End Checklist entry. |
| `ui-styling` | React/shadcn/Tailwind implementation | Not a general product-design router. |
| `sketch-findings-ipcmanagement` | SAP Fiori template/range/diagnostic work | Narrow project-specific knowledge. |

### B. Keep on demand, but adapt to Pi/GSD before discovery

| Skill | Use only when | Required adapter |
|---|---|---|
| `code-review` | Reviewing a fixed diff/base | Replace assumed parallel agents with optional Pi reviewer lanes; parent runs gates; GSD owns verdict/checklist. |
| `codebase-design` | Designing/deepening a module API | Vocabulary only; no independent planning state. |
| `improve-codebase-architecture` | User explicitly requests architecture/codebase audit | Replace HTML/report/subagent assumptions with a bounded GSD finding ledger; no speculative refactor execution. |
| `request-refactor-plan` | User explicitly requests a refactor plan | Write to the active GSD checklist; never auto-create GitHub issues or tiny-commit programs. |
| `domain-modeling` | Domain language, invariant, aggregate, glossary, or ADR actually changes | Use project domain docs; do not require `CONTEXT.md` or a new ADR tree. |
| `grill-me` | User asks to stress-test a plan | Interview only; no state ownership. |
| `grill-with-docs` | User requests interview plus domain-doc updates | Composition of grilling + domain modeling; docs remain project/GSD-owned. |
| `research` | High-trust external research is explicitly needed | Store bounded findings in approved docs/artifacts; no new research state system. |
| `prototype` | A disposable experiment can answer a design question | Require throwaway location and explicit non-production status. |
| `resolving-merge-conflicts` | Merge/rebase is already in progress | Preserve dirty work and project Git boundaries. |
| `handoff` | Session/context handoff is required | Map output to the project handover contract; no background-agent assumption. |
| `wizard` | Human-only provisioning/manual steps are requested | Generated script requires separate review and execution authorization. |
| `to-questionnaire` | A decision must be delegated to a human/stakeholder | Output only; does not create task state. |
| `writing-great-skills` | Editing project skill instructions | Pair with `harness-maintenance`; current copy has no matching current upstream path. |

### C. Merge or alias; do not expose as separate routine choices

| Skills | Canonical entry |
|---|---|
| `grilling`, `grill-me`, `batch-grill-me`, `loop-me` | `grill-me`; batch mode only when explicitly requested. |
| `domain-modeling`, `ubiquitous-language` | `domain-modeling`; glossary extraction is one mode. |
| `design`, `design-system`, `brand`, `banner-design`, `slides` | On-demand `design` family router, outside product UI by default. |
| `writing-fragments`, `writing-shape`, `writing-beats`, `edit-article` | One writing workflow, outside routine coding discovery. |
| `codebase-design`, `improve-codebase-architecture`, `request-refactor-plan` | Explicit sequence: vocabulary → audit → plan; never auto-chain all three. |

### D. Retain installed but keep hidden

| Skill | Reason |
|---|---|
| `claude-handoff` | Claude Code/background-agent workflow is outside the active runtime. |
| `git-guardrails-claude-code` | Claude-only hooks; project already has Git safety rules. |
| `setup-matt-pocock-skills` | Assumes issue-tracker/domain-layout setup and may create competing process state. |
| `setup-pre-commit` | Toolchain mutation requires its own explicit task. |
| `setup-ts-deep-modules` | Adds dependency-cruiser architecture and is not a routine discipline. |
| `migrate-to-shoehorn` | Narrow dependency-specific migration; only surface if explicitly requested. |
| `scaffold-exercises` | Training-content utility, unrelated to application delivery. |
| `qa` | Issue collection only; cannot replace GSD execution or verification. |
| `obsidian-vault` | Personal knowledge workflow, not repository delivery. |
| `teach` | User education utility, not coding workflow. |
| `ui-ux-pro-max` | Optional pattern lookup only; must not override Fiori/project contracts. |
| `design-an-interface` | Assumes broad parallel design generation; use only by explicit request. |

## Matt Pocock upstream fit

Current upstream adds process-heavy skills such as `implement`, `to-spec`, `to-tickets`, `triage`, `wayfinder`, and `ask-matt`. They are intentionally **not imported into the active Pi surface**:

- `implement`, `to-spec`, `to-tickets`, `triage`, and `wayfinder` overlap or conflict with GSD ownership of specification, tickets, sequencing, and state.
- `ask-matt` is a router over the upstream catalog; IPCManagement already needs a project-specific router that understands Pi, GSD, database safeguards, UI evidence, and role boundaries.
- Current upstream in-progress skills are experimental and often Claude-oriented; they are not production routing dependencies.

## Why skills appeared underused

1. **Most are not discoverable in Pi.** This is intentional configuration, but the catalog did not clearly distinguish hidden reference material from callable disciplines.
2. **Triggers overlap.** Four grilling skills, several design skills, several writing skills, and three architecture/refactor skills compete for similar prompts.
3. **Upstream process assumptions conflict with local governance.** GitHub issues, ADR/`CONTEXT.md` layouts, automatic parallel agents, background handoff, and implementation routers cannot own work here.
4. **No invocation telemetry exists.** Repository text mentions are not reliable proof that a skill was loaded. Future measurement must record selected disciplines in GSD checkpoints, not infer usage from filenames.
5. **The active surface favors frequently needed disciplines.** This is correct; rarely used skills should remain callable on demand rather than being forced into unrelated tasks.

## Routing rule

Use the smallest matching set:

1. GSD selects delivery level and owns state.
2. Add one primary discipline for the task type.
3. Add at most two supporting disciplines when the work genuinely crosses domains.
4. Project contracts override generic skill advice.
5. A skill may advise, review, or provide vocabulary; it may not create a second plan, issue tracker, state machine, commit policy, or acceptance authority.

## Acceptance for the audit

- `PASS`: full repository skill inventory classified.
- `PASS`: Pi discovery mismatch identified from `.pi/settings.json`.
- `PASS`: current upstream inspected at an exact commit without installing or overwriting anything.
- `PASS`: incompatible routers/setup/Claude assumptions kept out of active discovery.
- `NEEDS_EVIDENCE`: actual historical invocation frequency; there is no authoritative telemetry.
- `OPEN`: build and validate Pi/GSD adapters for the on-demand group before exposing any of them.
