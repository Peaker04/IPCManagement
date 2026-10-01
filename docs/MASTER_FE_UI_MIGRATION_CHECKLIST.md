# FE redesign using the adopted IPC UI Kit — migration roadmap

**Status:** replanned; supersedes the former 01–34 sequential checkbox campaign in this file. **Execution state:** [single GSD plan/checklist](../.planning/notes/FE-UI-KIT-REDESIGN-PLAN.md). This document is a roadmap, not a second task tracker. [Execution rules](MASTER_ITEM_EXECUTION_RULES.md) define gates. Do not infer that former `[x]` items certify kit migration; the pre-replan text is preserved in the intake backup under `.artifacts/fe-kit-replan-intake/` and prior Wave/Gate notes remain historical evidence.

## Goal and authority

Replace the mounted frontend experience with the **adopted UI Kit's page grammar, identity, navigation, states, visual tokens and component mechanics**, not a sequence of cosmetic fixes to legacy pages. Reuse existing FE/BE behavior when it matches `docs/domain/**`; rebuild or remove legacy FE composition and CSS after its last consumer is migrated. Specimens are visual/interaction references, **not production JSX, business data, or permission authority**. `docs/DESIGN.md` is the target design authority; domain and backend contracts decide business semantics. Existing shadcn/Base UI/Tailwind primitives can implement the kit without creating parallel V2 families.

The existing route `/weekly-menu?view=schedule` is the current mount, not the mandatory final information architecture. DESIGN §7 describes target Weekly Menu workspaces; changing routes/sidebar, preserving deep links, actor permissions and query scope needs an explicit architecture cutover gate, not a silent CSS change. FE can be rewritten or deleted where the replacement is verified. BE can be corrected or removed **only for a specific demonstrated contradiction with domain/product authority**, after tracing consumers, persisted data and deployment/migration consequences; never delete BE merely because a new UI does not use an endpoint. No DB/schema/data change, seed, restore, mode switch or destructive cleanup is implicitly authorized by this roadmap.

## Canonical execution pipeline

This roadmap has no independent execution flow. Every page family must pass the single GSD-owned pipeline in `docs/harness/DELIVERY.md`:

`SOURCE LOCK → DESIGN LOCK → IMPLEMENT → VISUAL CONFORMANCE → FR/NFR/PERF → EVIDENCE`.

Before JSX/layout/CSS changes, the active GSD checklist must contain `DESIGN_TEMPLATE`, `CANONICAL_SPECIMEN`, `ZONES`, `SHARED_PRIMITIVES`, `TOKENS`, `SKILLS_READ`, and `ALLOWED_DEVIATIONS`; otherwise `NO_EDIT`. Campaign stages below describe dependencies only and cannot override or duplicate those gates.

## Campaign stages (dependencies, not a rigid page order)

1. **Rebaseline the kit and mounted product.** Compare the 23 accepted specimen images and `docs/DESIGN.md` against real route×mode×actor×state screens. Reuse Wave 0 inventory as discovery, not migrated acceptance. Identify concrete target floorplan, design tokens, states, responsive behavior and workflow per page family. Inventory existing FE owners and backend contracts, classifying keep/rebuild/retire and unresolved domain conflicts.
2. **Lock target IA and executable foundation before broad page migration.** Decide sidebar/workspace topology (including Weekly Menu), backward-compatible/deep-link behavior and URL scope; map kit tokens into real CSS/primitive owners with opt-in consumers; define shared shell, table/matrix, form and overlay mechanics. This stage may run alongside one bounded reference page if it does not force temporary duplicate navigation, but cannot be postponed until every legacy tab has been polished.
3. **Build full-page reference workspaces.** Select real T3 Schedule, T4 Demand, T2/T7 Approvals, T5/T6 Warehouse, T8 Admin, T1 Dashboard, T10 Reports and MRX where applicable. Each reference is a **page-level reconstruction** of its declared work object, including directly owned command, context, main surface, overlays and states. Reuse proven shared owners; do not transplant another page's floorplan. The Schedule reference is first under review, not deemed complete by its prior header clip.
4. **Roll out proven patterns to remaining workspaces.** Batch by coherent consumer/owner and dependency, not by an inflexible route number. Keep one writer per owner, protect legacy consumers until their cutover, and expand shared patterns only after two real consumers prove them. FE removal follows verified replacement and consumer scan.
5. **Resolve domain/BE discrepancies as separate decision cells.** For each alleged wrong BE behavior: state expected domain outcome, current endpoint/policy, callers, persisted-data impact and migration/rollback; get the required owner/DB authority before changing or deleting it. Presentation changes do not authorize backend schema or data destruction.
6. **System acceptance and retirement.** Cover naturally available states/permissions/actions, keyboard/focus, supported desktop widths and relevant responsive/zoom behavior; prove authorized mutations UI→request→BE→persistence→reload. Run owner and integration regressions, inspect every final screenshot in the locked envelope, retire legacy CSS/components/routes only after final consumer cutover, then close full-system coverage. Missing actors/data are `NEEDS_EVIDENCE`, not fabricated PASS.

## Success is not a styled legacy screen

A reference is accepted only when its mounted composition matches the Kit/DESIGN floorplan for its work object, target tokens are computed on production elements (not only specimens), interaction/state and actor guards remain correct, keyboard and viewport oracles pass, and the old composition's retirement or intentional coexistence is recorded. A single CSS defect fix, green unit suite, or screenshot does **not** complete a reference. Historical approvals and Demand read-state evidence remain useful but must be re-evaluated against this page-level criterion.

**Next:** run the [GSD plan](../.planning/notes/FE-UI-KIT-REDESIGN-PLAN.md) preflight/target-IA decision and rebrief Schedule before any further Item 08 implementation. Do not advance to the former Item 09 or auto-resume paused Phase 36/MRX work.
