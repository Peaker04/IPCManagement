# Phase 5 Research Handoff

**Source:** `.planning/research/SUMMARY.md`
**Mode:** Reuse milestone research; no additional phase researcher

## Implementation findings

- Application service owns transaction/revalidation/versioning/audit; parser remains pure and controller remains thin.
- Reconciliation and cleanup classifier are distinct models but execute under one retention policy version.
- EF tracking must be explicit; bulk-load relevant rows before mutation to avoid N+1 and candidate drift.
- Completed history must be proven by stable snapshots/checksums, not by status filters alone.
- Staleness currently does not fully account for BOM changes; new change token/version must flow into demand generation and reports.
- Customer override semantics are ingredient-level overlay, not current full-set shadowing behavior.
- Broad `RemoveRange(all)`, `ReplaceBomCatalog` and `Clean_Legacy_Imported_Bom.sql` are forbidden production patterns.

## Likely code boundaries

- Phase 4 reconciliation service expanded from preview to apply
- Dedicated transaction coordinator/policy executor for version/archive/delete/block
- BOM change token/staleness integration in MaterialDemandService/Calculator
- Draft downstream reconciler for production/demand/purchase/inventory dependency order
- Post-commit cache/report invalidation
- Apply/controller contract and focused relational/MySQL integration tests

## Threat model inputs

- T-05-01: TOCTOU between preview and apply.
- T-05-02: partial transaction writes domain without audit or vice versa.
- T-05-03: broad/cascade delete damages history/stock.
- T-05-04: customer partial override removes global ingredients.
- T-05-05: stale/regenerate touches locked/completed or repeats twice.
- T-05-06: cache/report exposes mixed pre/post-commit state.

## Validation Architecture

| Layer | Evidence |
|---|---|
| Transaction | Relational/MySQL test with injected exception/cancellation proves 0 partial domain/audit rows |
| Idempotency | Same apply twice yields second no-op and no extra versions/audits |
| Retention | Mixed-state fixture: delete set equals true orphans, stock/reference blocks, immutable checksums equal |
| Demand | Tier/unit/overlay fixtures prove exact quantities and scope-aware staleness |
| Downstream | Draft/open rebuilt once in dependency order; locked/ordered/received/issued/returned unchanged/block |
| Cache/report | After-commit request sees new catalog; historical report snapshots unchanged |
| Repository | Per-symbol impact and per-commit detect_changes/ownership checks |

## Planner constraints

- Plan must contain stop/rollback gates around every mutation wave.
- No UI work or legacy surface removal.
- Every plan frontmatter must pass installed GSD plan schema and tasks need exact `<files>`.
- Threat model ASVS L1 blocks HIGH.
