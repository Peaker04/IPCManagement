# Phase 29: System Operation Mode and Material Reconciliation - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver one audited global server-authoritative operation mode, a bounded immutable reconciliation-batch workflow for required/purchased/issued quantities, and evidence-backed clarity remediation across both modes without replacing the default golden path or creating procurement/stock lifecycle records from reconciliation entry.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**13 requirements are locked.** See `29-SPEC.md` for full requirements, boundaries, prohibitions, edge coverage and acceptance criteria.

Downstream agents MUST read `29-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Durable global operation-mode read and Admin mutation contracts with audit and safe client propagation.
- Frontend navigation, route, preload and action eligibility plus backend operation enforcement.
- The approved retained/excluded route matrix.
- Draft reconciliation batch creation from committed Weekly Menu import and meal-quantity sources.
- Ready/freeze lifecycle, immutable required quantity/tolerance/source contributors and canonical-unit grain.
- Batch-owned purchased/issued actual entry, append-only corrections, comparisons, dispositions and completion.
- Reconciliation report/history/export surfaces needed to inspect immutable batches.
- Bounded project-wide clarity remediation and complete role/mode/API/DB/browser verification.

**Out of scope (from SPEC.md):**
- Replacing or deleting the `DEFAULT` golden workflow.
- Per-user, per-role or browser-authoritative mode selection.
- Granting permissions through mode.
- Creating PR/PO/receipt/issue/stock lifecycle from reconciliation actual entry.
- Automatic legacy unit normalization, counted-unit rounding or ingredient merging by name.
- Rewriting historical batches after source/config changes.
- Component-stack replacement, broad brand redesign, generic renderer/UI DSL or second audit framework.
- Deleting workflow data when mode changes.

</spec_lock>

<decisions>
## Implementation Decisions

The `/goal` continuation authorized autonomous selection of recommended implementation decisions after interactive specification locked the product behavior.

### Global mode authority and propagation

- **D-01:** Persist the active mode in one database singleton row with an explicit concurrency/version token; configuration files and browser storage are consumers neither mutation authority nor fallback. — **Reversibility:** one-way — changing the persisted singleton/API contract later requires a migration and coordinated backend/frontend contract change.
- **D-02:** Expose a small authenticated configuration read contract containing the stable mode token, user-language label and version/updated timestamp. Keep stable internal tokens out of user-facing copy.
- **D-03:** Admin mutation uses explicit expected-version concurrency, confirmation and a reason field that becomes mandatory when server-side work-in-progress detection reports active work. The server, not the client, decides whether reason is required.
- **D-04:** Frontend boot reads mode through the existing RTK Query architecture. Mode mutation invalidates only the configuration/mode tag and dependent eligibility projections; do not reset the API reducer or reload the document.
- **D-05:** When a route becomes unavailable, relocate to the first retained route the actor is permitted to read, preferring Dashboard. If no retained protected route is permitted, show a dedicated mode/permission-safe unavailable shell rather than looping redirects.
- **D-06:** Backend mode enforcement belongs in a shared policy/service/filter seam used by commands and queries, not repeated string comparisons in controllers/services. Each endpoint/action family receives explicit eligibility metadata or a centralized operation key.
- **D-07:** A request mutation revalidates mode inside the server mutation/transaction boundary before commit. Cached frontend mode is presentation guidance only and cannot authorize a stale operation.

### Route and action eligibility

- **D-08:** Maintain one typed route/operation eligibility registry that covers navigation, direct routes, intent preload and route-owned actions. Existing permission metadata remains separate and is evaluated after mode eligibility.
- **D-09:** Excluded direct routes render the locked mode-unavailable message in the application shell, preserving navigation to retained work; they do not redirect to `/403`.
- **D-10:** Retained routes require an action-level inventory. A retained page may hide/block default-workflow actions that are not part of reconciliation mode even though the route itself remains available.
- **D-11:** `DEFAULT` is an explicit allowlist/contract, not an untested `else` branch. Regression locks current routes, permissions, preload behavior and golden-path backend operations.

### Reconciliation batch lifecycle and identity

- **D-12:** Use explicit lifecycle states `DRAFT`, `READY`, `IN_PROGRESS`, `COMPLETED`. `DRAFT` is diagnostic/mutable source preparation; `READY` freezes authority; first actual entry transitions to `IN_PROGRESS`; successful completion transitions to `COMPLETED`.
- **D-13:** A committed import creates one draft batch identity linked to menu import/version and meal-quantity source identities. Reimport creates another batch; it never overwrites or reuses a prior batch identity.
- **D-14:** Ready confirmation performs one transactional validation/snapshot operation: resolve material contributors, canonical identity/unit, required decimal quantity and tolerance source/value/version, then freeze them together. — **Reversibility:** one-way — the frozen snapshot and public historical contract cannot be recomputed without violating immutable-history requirements.
- **D-15:** Batch-line uniqueness is `(batchId, ingredientId, canonicalUnitId)`. Contributors remain separate child/source records carrying original BOM/menu/meal-quantity identities and quantities; aggregation never uses ingredient name.
- **D-16:** Draft batches with missing BOM, unresolved ingredient identity, unresolved canonical unit or zero valid material lines expose diagnostics and cannot become ready. Do not auto-normalize legacy units during readiness.
- **D-17:** Completed batches are immutable. Correction after completion requires a new batch/version rather than reopening or mutating the completed authority.

### Tolerance and comparison

- **D-18:** Resolve tolerance precedence as ingredient-specific override → canonical unit-group override → system default. Persist the selected source kind, source identity/version and exact decimal value on each frozen line.
- **D-19:** Compare stored canonical-unit decimals without using display-rounded values. Preserve exact signed values for the three differences; status uses absolute difference and strict `>` tolerance.
- **D-20:** A line is exceptional if any of the three comparisons exceeds its applicable frozen tolerance. The UI shows which comparison(s) triggered the verdict rather than collapsing all gaps into one unexplained badge.
- **D-21:** Default batch view sorts unresolved exceptions first, then resolved exceptions, then within-tolerance lines using stable ingredient label/identity ordering. `Hiện tất cả` is secondary and does not change stored status.

### Purchased and issued actual entry

- **D-22:** Purchased and issued values use separate role-owned entry records/projections on the same batch line. Purchasing cannot write issued values; Warehouse cannot write purchased values; Admin does not bypass the underlying operation permission merely because Admin changed mode.
- **D-23:** An initial actual entry and every correction records exact canonical-unit quantity, actor, timestamp and version. Corrections additionally require reason and append old/new revision records.
- **D-24:** Use optimistic concurrency per batch line/side. Stale writes return a user-language conflict with current server value and require reload/review; never silently merge or last-write-wins.
- **D-25:** Entry surfaces support explicit zero and distinguish it from missing/null. The UI must require deliberate confirmation for zero because it can produce a large exception but zero remains valid business input.
- **D-26:** Reconciliation actuals are isolated from PR/PO/receipt/inventory issue/stock tables. Reporting may link to source identities for context but must not infer reconciliation actuals from those documents in this phase.

### Completion and dispositions

- **D-27:** Each exceptional line requires a structured disposition category plus a non-empty human reason. Keep the category vocabulary centralized and user-facing; preserve exact differences alongside the disposition.
- **D-28:** Completion is one server transaction that rechecks every line for purchased/issued presence, exception disposition and current version. It rejects empty, stale or incomplete batches and writes completion actor/time audit.
- **D-29:** Completed-batch report/export is a historical snapshot containing full IDs and provenance; filters/presentation never change its comparison authority.

### UI placement and interaction

- **D-30:** Place global mode control in Admin-only Advanced Settings. Show current mode as passive context in the main shell for all authenticated users, without exposing a non-Admin switch control.
- **D-31:** Put reconciliation work inside retained Weekly Menu/Purchasing/Warehouse/Reports work areas rather than creating parallel top-level routes: Weekly Menu owns draft/readiness, Purchasing owns purchased actuals, Warehouse owns issued actuals, Reports owns comparison/history/export.
- **D-32:** Use existing query boundaries, table primitives, dialogs/drawers and status vocabulary seams. Do not introduce a reconciliation-specific component framework.
- **D-33:** Readiness, mode change and batch completion use focused confirmation dialogs because they establish immutable or system-wide transitions; quantity entry/correction remains in the work area or a single page-level drawer, not one modal per row.

### Project-wide clarity remediation

- **D-34:** Inventory copy/table/empty-state candidates before editing and group them by lowest demonstrated owner: shared vocabulary/formatter/primitive, feature mapper/section, then route-local residue.
- **D-35:** Execute clarity work in at most three owner waves: shared vocabulary/identifier/table contracts; shared feature seams; route residue plus headed verification. Do not turn every route or rule into a separate plan.
- **D-36:** Short identifier presentation uses recognizable Vietnamese document type plus a collision-safe distinguishing segment. Full value is available through inspect/copy and server/client search by full value; API/export/audit values remain unchanged.
- **D-37:** Empty-state reduction preserves four query meanings (initial absence, filtered absence, load error, permission/mode unavailable) while removing duplicate prose. One authorized next action is rendered only when one exists.
- **D-38:** Existing Phase 27/28 identity/evidence harness remains authoritative. New rules/fixtures extend it with known-bad and known-clean proof rather than creating a second scanner.

### Verification and rollout

- **D-39:** Implement database changes first on an approved disposable mutation lane with preflight, rollback checkpoint, migration/model verification and postflight lineage; promotion to the operational base is a separate authorized checkpoint.
- **D-40:** Verification is layered: unit/domain and authorization matrices; API/generated-contract parity; migration/DB invariants; frontend semantic/route/query tests; headed role×mode flows across the five desktop viewports; immutable-history and zero-stock-mutation postflight.
- **D-41:** Browser mode-change proof includes two active role sessions: Admin changes mode while another user is on a newly excluded route, then evidence confirms relocation, request behavior and persisted/audited mode.
- **D-42:** Reconciliation E2E uses a newly controlled import/batch scope and source-line IDs. Do not reset/seed existing lanes or reuse ambiguous historical documents to obtain a green result.

### the agent's Discretion

- Exact class/component/type names, endpoint paths and migration names, provided they preserve the locked contracts.
- Exact presentation of the passive mode context and comparison-detail disclosure within existing SAP Fiori compact visual identity.
- Pagination size and filter control arrangement using current project conventions.
- Internal structured disposition categories, provided they are centralized, concise, auditable and do not alter exact numeric verdicts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase 29 authority
- `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-SPEC.md` — Locked requirements, boundaries, edge coverage, prohibitions and acceptance gates.
- `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-RESEARCH.md` — Source-grounded seams, constraints and risks.
- `.planning/notes/system-operation-mode-and-material-reconciliation.md` — Approved discovery language, mode matrix, reconciliation formulas and clarity direction.
- `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-SPEC-SEED.md` — Original phase seed and planning constraints.

### Business data and lineage
- `docs/DATA-GRAIN-MATRIX.md` — Required demand/document/stock grains, source-line rules and anti-double-count invariants.
- `docs/DOMAIN.md` — Business terminology and workflow context when resolving new mode/batch vocabulary.
- `docs/GLOSSARY.md` — Canonical Vietnamese user-facing terminology and status labels.

### UI and evidence
- `docs/DASHBOARD-UI-RULES.md` — Normative user-language, table, query-state, hierarchy, accessibility and performance rules.
- `docs/UI-UX-EXECUTION-HARNESS.md` — Required audit→owner fix→test→headed evidence process.
- `docs/UI-UX-MEASUREMENT-PROTOCOL.md` — Semantic DOM/geometry/browser measurement oracle.
- `docs/UI-PHILOSOPHY.md` — Project-specific UI application principles.
- `frontend/README.md` — Frontend development and test entry points.

### Database/runtime operations
- `docs/DEPLOYMENT.md` — Promotion and runtime configuration constraints.
- `docs/SHIPYARD-OPERATIONS.md` — Preflight→boot→health→database-sync→test→browser→evidence→teardown workflow.
- `docs/EVIDENCE-INDEX.md` — Authoritative artifact registration and hashes.
- `MEMORY.md` — Current lane, ports, viewport matrix, credential source and active gate; verify against runtime before mutation.

### Process and architecture
- `AGENTS.md` — GSD ownership, GitNexus opt-in, database/browser safety and documentation rules.
- `.planning/ROADMAP.md` — Phase placement and requirement mapping.
- `.planning/REQUIREMENTS.md` — OPM, MRC and CLR milestone requirements.
- `.planning/STATE.md` — Current phase state and continuity.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/lib/routeConfig.ts`: canonical route constants for the mode matrix.
- `frontend/src/routes/RoleGuard.tsx`: existing permission boundary to compose after mode eligibility.
- `frontend/src/routes/routeLoaders.ts` and `routeDataPreloaders.ts`: intent preload seams that must consume mode eligibility.
- Existing RTK Query API/store architecture: operation mode/bootstrap and reconciliation endpoints must preserve one API cache identity.
- Existing `AuditLog`: actor/time/reason persistence pattern for mode and lifecycle transitions.
- `MaterialDemandService` and Weekly Menu import/version sources: reusable calculation/source identities, but not mutable historical authority after batch readiness.
- Existing inventory source-line entities and operational warehouse resolver: provenance and singleton fail-closed precedents.
- Phase 27/28 UI audit fixtures, table/query primitives, formatters and workflow vocabulary: extend rather than duplicate.

### Established Patterns
- Server authorization remains authoritative; frontend guards improve UX but never grant access.
- Singleton operational configuration fails closed on zero/multiple/invalid authority.
- Business mutations are transactional, audited and use source IDs rather than display names.
- Historical document/source identity remains intact while UI may expose concise labels and progressive disclosure.
- Browser verdict requires frontend control → API → DB transition → reload render; screenshot alone is reviewer evidence.

### Integration Points
- Backend persistence/context/model snapshot and migrations for mode, tolerance and reconciliation aggregates.
- Auth/policy/controller/service pipeline for mode-aware operation eligibility.
- Weekly Menu import commit and meal-quantity completion/readiness projection.
- Purchasing and Warehouse retained work-area tabs/actions for actual entry.
- Reports API/page for immutable comparison history and export.
- Main layout/navigation/route loader for mode bootstrap, passive context and relocation.
- Generated OpenAPI/frontend types and focused source-contract tests.

</code_context>

<specifics>
## Specific Ideas

- UI labels are exactly **Mặc định** and **Đối chiếu nguyên liệu**; internal tokens never appear in normal user copy.
- Excluded-route copy is exactly: **“Chức năng này không sử dụng trong chế độ Đối chiếu nguyên liệu.”**
- Batch readiness is an explicit user transition named **“Sẵn sàng đối chiếu”**.
- Exception label is **“Cần kiểm tra”**; within-tolerance concise label is **“Khớp”**; secondary all-row control is **“Hiện tất cả”**.
- Short codes use recognizable document language such as `Phiếu bổ sung …B182`, with full-value access and collision protection.

</specifics>

<deferred>
## Deferred Ideas

- Physical merge/deletion of historical warehouses or removal of warehouse IDs.
- Automatic legacy unit normalization and counted-unit rounding decisions.
- Deriving reconciliation actuals from the full procurement/receipt/issue lifecycle.
- Per-user/per-role operation modes.
- New component stack, brand redesign, generic page renderer or second audit system.

</deferred>

---

*Phase: 29-system-operation-mode-and-material-reconciliation*
*Context gathered: 2026-08-25*
