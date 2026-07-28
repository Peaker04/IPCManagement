# Requirements: architecture workflow 11–18

The detailed contract is Part F of `docs/ARCHITECTURE-AUDIT-2026-07-26.md`. This file exists only to keep active GSD context aligned; the old v1.1 requirements are archived under `.planning/archive/v1.1-legacy/`.

## Active requirements

- [x] ARCH-11 — Shared query-state algebra and lint guardrail.
- [x] ARCH-12 — Live Material Demand/Warehouse pilot evidence.
- [x] ARCH-13 — Query-state rollout across all data-owning pages.
- [x] ARCH-14 — Enforced VSA dependency boundary.
- [x] ARCH-15 — Use-case and functional-core decomposition.
- [ ] ARCH-16A — Feature-owned EF mappings with a thin registration root.
- [ ] ARCH-16B — Execution-strategy-aware transaction runner with duplicate-side-effect protection.
- [ ] ARCH-16C — Mapped domain/application exceptions for business failures.
- [ ] ARCH-16D — Explained and tested canonical fresh/upgrade migration lineage.
- [ ] ARCH-16E — Off-site backup plus disposable-clone restore rehearsal evidence.
- [ ] ARCH-17 — Explicit frontend endpoint/layout/page-model ownership and zero unapproved dependency debt.
- [ ] ARCH-18 — Test decomposition, growth gates, full verification and synchronized documentation.

## Preservation requirements

- No push, reset, seed or import into an existing database.
- No rewrite, deletion or movement of applied migrations.
- No public API, route, cache, generated-contract or UI drift unless explicitly approved.
- GitNexus impact precedes symbol edits; staged `detect_changes` precedes every commit.
