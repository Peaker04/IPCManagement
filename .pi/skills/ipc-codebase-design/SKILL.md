---
name: ipc-codebase-design
description: Design or refactor an IPCManagement module using real callers, explicit contracts and small behavior-preserving steps. Use when evaluating boundaries, interfaces or architectural friction.
---

# Design and refactoring

Advisory capability under [AGENTS](../../../AGENTS.md); [WORK](../../../.planning/WORK.md) remains the only task-state owner. This skill grants no execution or delegation authority.

Start with [ARCHITECTURE](../../../docs/ARCHITECTURE.md), the affected owner and actual callers. Load DOMAIN and a bounded contract only if terminology, grain or business behavior is involved. Use existing project vocabulary, not a new glossary or ADR framework.

## Find the real problem

- Name the observed cost: scattered edits, ambiguous responsibility, repeated branching, hidden I/O or a contract that callers cannot use safely. Cite current code; do not restructure a repository for an aesthetic score.
- Describe what callers must know: inputs/results, invariants, ordering, failure modes, permissions, concurrency, configuration and side effects. A type signature alone may omit the important contract.
- Identify where responsibilities actually vary in production. Do not add adapters, exports or injection seams used only by tests, or generalize for a hypothetical second implementation.
- Ask whether removing a wrapper would eliminate needless complexity or merely distribute necessary coordination to its callers. Prefer the existing owner when it already contains that coordination.

## Choose the smallest useful shape

Keep related knowledge and changes local; expose only what real callers need. Separate deterministic calculations from I/O where it clarifies ownership, without hiding required transactions or creating generic frameworks.

When a trade-off is material, sketch two small alternatives with real call-site examples. Compare misuse risks, migration work, error/concurrency semantics, duplication and maintenance cost. Include keeping the current design; do not mandate multiple agents or speculative flexibility.

Look up facts locally. Ask the owner only for unresolved decisions that affect the design, explaining alternatives and downstream impact. Clarify overloaded domain terms or cardinality against the existing DOMAIN/bounded owner; discussion scenarios are not business evidence or consent to change policy.

## Refactor safely

Name the allowed owners and exclusions in WORK. Move one coherent responsibility at a time, preserve observable behavior and migrate real consumers before removing superseded code. Compatibility layers need an actual live contract and authorized scope, not inertia.

Use [ENGINEERING](../../../docs/ENGINEERING.md) and existing owner-boundary checks after each meaningful step. Apply test-audit before changing tests; do not automatically delete old tests or replace them with test-only seams. A behavior change is not a pure refactor and needs explicit scope and the correct canonical contract update.

Return the chosen shape, evidence, affected callers, smallest migration/verification steps and unresolved decisions. Do not generate architecture reports, tickets, state files or commits by default.
