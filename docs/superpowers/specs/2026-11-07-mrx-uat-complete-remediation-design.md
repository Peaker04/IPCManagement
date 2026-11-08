# MRX UAT — complete remediation and acceptance design

## Status and authority

This consolidates the original16 screenshots, six follow-up screenshots and sidebar screenshot26287388. It supersedes the incomplete scope of `2026-11-06-mrx-uat-menu-workflow-design.md` for future repairs, without erasing prior implementation/evidence. WORK remains the only live approval/execution/evidence ledger; the tables below are static requirements and acceptance instructions.

**Binding owner correction (A):** MRX assumes sufficient stock and records reconciliation quantities only, with no physical-stock checks, provisioning, movements or balance changes. DEFAULT stock behavior and old persisted MRX history/receipts remain unchanged. Preparation must become read/export-only, with weekly menu/material export and supplier grouping, not auto-filled coordinated issue. This supersedes historical stock-guard/coordinated-issue preservation text below and in linked follow-ups. The companion implementation plan now maps R22–R27; their delivery/acceptance remains separately recorded in WORK.

**Approved preparation clarification:** multi-customer preparation supports **one selected day OR the whole selected week**. Full Excel is a **single worksheet**: the list of menu dishes for that exact scope at the top (customer, date, shift, menu variant, dish, servings), followed below by material lists separated into actual supplier groups, with same-unit totals/customer allocations. No week-only replacement, no separate-menu-sheet interpretation, no content-type selector instead of day/week. Existing page/components/exporter remain owners; full UI export always includes both sections. Retained ingredient-only API compatibility is not an extra user-facing workflow.

Source truth: docs/DESIGN.md (N6, T6–T8, D6/D7, M1.2), docs/UI-KIT.md, docs/ARCHITECTURE.md and docs/ENGINEERING.md. FR-MENU/FR-RECON/FR-WH/FR-CHEF plus FR-SYS capability delivery. Preserve BR-MRX-EDIT-1/3/4/6/8/9, BR-MRX-SERV-1/2 and DOM-MODE-1. No arbitrary new policy, price, recipe or business evidence.

## 1. Requirement-to-deliverable ledger

Each requirement must have its own source/automated/rendered/live result in WORK. An aggregate test count never closes this table. Screenshot identifiers refer to existing private `D:/Temp/pi-clipboard-<id>.png` files; do not copy them or credentials into published documentation.

| ID | Owner request / input | Required delivered result | Acceptance |
|---|---|---|---|
| R01 | Close/discard/reselect old menu;85283612/f46a33b2 | Preserve dirty cancel; discard clears only local session; same saved customer/bytes/tier resolves actual DRAFT week; explicit other-week intent; field-owned saved-week helper | U02 |
| R02 | Queued File contradicts native No file chosen | One truthful queue and existing upload/replace controls, no contradictory native chrome; actual File retained for request | U02 |
| R03 | c734b8a3 → menu like outside screen | Default preview is weekly date-column/shift-variant/slot matrix with dish names, not a row list or single-day replacement; source coordinates secondary; preserve real occurrences/merges | U03 |
| R04 |05d170e5/ac2ded80 late missing-servings check | Incomplete unlocked applicable cell blocks BEFORE review, focuses field; explicit0 valid; one real successful preview opens populated review; retry preserves draft | U04 |
| R05 |5323be77 initial-entry versus adjustment | First entry shows proposed servings, not null-as-zero/false saved comparison; later entry shows genuine old/proposed and available impact; reason remains mandatory under approved API contract | U04 |
| R06 |c0ae32db/b3fc8ab5 source/lifecycle outside menu | One external source/lifecycle context above matrix; actions not embedded in repeated menu; source published is not batch ready | U05 |
| R07 |6f7331d7 +9c050281 merged dish placement | One-line merged dishes centered horizontally AND vertically across actual spans; long copy wraps; retain table semantics and locked boundaries | U06 |
| R08 |689814f5 edit-group composition | Group label/picker/split action form a compact centered block within merged cell, not three controls stranded at its top; group and individual editing remain explicit | U06 |
| R09 |98e3dc02 +25f7faec shift naming | User-visible MORNING is exactly Sáng, AFTERNOON exactly Chiều, including filters, schedules, preview, source impact and new pages; no Ca1/2 or raw known enum | U05/U07 |
| R10 |82fe6b5b/69c5683a/c74c6711 +26287388 | Remove quantity-summary accordion/tabs from preparation screen; move Định lượng nguyên liệu and Kế hoạch theo ca to two real same-level nested sidebar leaves; standalone, guarded, scoped data pages | U01/U07 |
| R11 |85e3bb63 duplicate import buttons | One visible import entry in weekly workbench, with explicit new-week versus current-week intent inside existing importer; completed batch never offers current-week reimport | U02/U05 |
| R12 |Misleading Tạo lô nháp | Keep Lập lô đối soát label everywhere that names the action; actual DRAFT/freeze/transfer remain unchanged and separately explained | U05 |
| R13 |540d142f frozen material duplication | Distinct ingredient/unit count, actual-date/rate/unit grouping, Vietnamese schedules; retain differing frozen facts, no current-master fallback or summed per-serving rates | U07 |
| R14 |aca62b0b preparation redesign | Compact customer selection/export controls + search/context row + one main allocation grid; honest empty/prerequisite/outcome-unknown; no unnecessary empty bands | U08 |
| R15 |35d140c0/db5e9d15 cooking layout | Row1 scope and export/print actions; row2 search and contextual counts; body master/detail for dishes/ingredients; no empty third toolbar; exact group/total/export/print scope preserved | U09 |

R01/R02/R04/R05/R12 and some R13–R15 behavior already have historical automated evidence. Retain those owners; inspect/reverify, do not rebuild or manufacture a new regression merely to claim RED. R03/R06–R11/R14/R15 still have source or visual gaps. Approval of this proposal is not acceptance of any row.

## 2. Navigation and architecture of the two new pages (R10)

```
Thực đơn tuần
├─ Chuẩn bị lô đối soát     /weekly-menu?view=mrx-batch
├─ Định lượng nguyên liệu  /weekly-menu?view=mrx-materials
└─ Kế hoạch theo ca        /weekly-menu?view=mrx-plans
```

Proposed leaf/surface IDs: `mrx.materials`, `mrx.plans`. Both are MRX-only, same current Coordinator/Admin/Manager family and `reconciliation.source.read`; do not grant Chef/Warehouse extra source access. Update routeRegistry, WeeklyMenuPage dispatch, SystemOperationEligibility.pageTabs, workbenchSurfaceRegistry and conformance/table contracts together. Existing14 top-level paths remain14; these are views, not new top-level modules. Sidebar is the sole navigation authority; no duplicate local tabs. Check current canNavigate implementation instead of assuming backend pageTabs alone controls it.

Both views use WorkspaceFrame/WorkspaceHeader/TelemetrySubbar/StateBoundary/DataGrid or SplitView/PaginationBar, existing semantic tokens and formatters. URL carries customerId and Monday weekStartDate. Sidebar navigation preserves these coordinates only for the weekly-menu leaves; never forward transient action=import, preview token or an unrelated batchId. Direct URL/F5/back/forward must work without first visiting preparation. Invalid/missing scope gets a focused prerequisite/error, not an inferred other customer's cached dataset. Preserve intentional historical weeks.

### Data authority and pagination — no cosmetic relocation

Current `MrxBatchPreviewSection` consumes transient `MrxQuantityPreview`; its wrapper cannot simply be placed behind two new links. Existing PreviewAsync loads canonical source but also allocates a15-minute commit ticket; its automatic workbench effect swallows errors. New pages must neither depend on that cached ticket nor silently mount the whole mutation-owning useMrxBatchWorkspace.

Proposed minimal API addition: two read-only GETs on the existing ReconciliationBatchesController, backed by the SAME existing canonical snapshot calculation in ReconciliationQuantityImportService:
- `/api/reconciliation/batches/quantity-import/materials?menuVersionId=…&PageNumber=…&PageSize=…&SearchKeyword=…`
- `/api/reconciliation/batches/quantity-import/plans?menuVersionId=…&PageNumber=…&PageSize=…&SearchKeyword=…`

Reason for explicit read APIs: independent deep links, real server paging, visible errors and no unused commit ticket creation. No schema, new workflow, second BOM resolver or altered Preview/Commit contract. Proposed read capability IDs are `RECON.SOURCE_MATERIALS.READ` and `RECON.SOURCE_PLANS.READ`, mapped to the two actual new GET actions and existing source permission/policy (no new permission grants). Update generated contracts/action inventory. Controller/service naming and DTO fields are pinned in the companion plan. These endpoint additions are proposed scope, not already approved implementation.

Source lookup resolves actual menuVersionId for selected customer/week. Reads retain current published/completed-source prerequisites of LoadSnapshotAsync: absent/draft/incomplete source gets a truthful blocker with a link back to preparation; never auto-publish/save/complete to make the page load. Diagnostics remain visible even when partial projection rows exist. API/403/409/5xx are not converted into empty lists.

Page responses carry source version/fingerprint, diagnostics and a standard paged payload. Server filters/sorts/counts/pages after correct full-scope aggregation. Search changes visible results/counts only; no sum across incompatible units. On scope/source-version change clear selected detail and old-key data, reset page; ignore late responses. On detected fingerprint change while paging refresh/reset rather than mixing revisions. Two pages are explicitly labelled **Nguồn hiện hành · Dự kiến**, not Đã đóng băng. Existing frozen-modal/cooking views remain the authority for frozen records.

### New page composition

Materials: compact name+secondary code, unit and total-required columns, with selected-row contributor detail (actual date/shift/dish and exact source rate/unit). Remove the misleading single global per-serving-rate column; rates belong to contributor facts. Totals aggregate required canonical quantities only within ingredient+canonical-unit identity. No summing gross-per-serving rates or unlike-unit grand total.

Plans: date, Sáng/Chiều, actual source plan/menu context, API-owned servings and dish count; reuse existing shift-dish detail. Do not invent Mặn/Chay serving fields absent from that DTO. Whole-scope meal totals must not sum a meal again for every dish.

Both pages have50-row default server pages, stable sort, true totals and their own workbench geometry/table contract. Do not patch the old >500px/nested-scroll accordion into a new page unchanged. After the replacement is integrated, remove the old accordion and obsolete local tabs/container; move any sole precision/unit test to the real replacement owner before deleting dead presentation.

## 3. Weekly-menu interaction/layout (R01–R12)

Header: customer/week and refresh + ONE import entry. In editable context use Nhập Excel; within the existing modal show one clearly labelled scope selector: Tuần đang xem / Chọn tuần khác. Current-week mode keeps existing reimport protections. New-week mode permits authoritative draft recovery/manual Đổi tuần. For completed context only new-menu intent is available and the entry says Nhập thực đơn mới. Do not add another wizard or page-level duplicate button. All guarded/dirty/pending exclusions stay.

Below header: one source-version/readiness + batch-lifecycle strip, then mode actions and matrix. Detailed materials/plans live only in sidebar destinations, not a second embedded menu/summary. Required BOM diagnostics and lifecycle next command remain visible on preparation; moving views must not remove prerequisites to commit/freeze/transfer. R12 is copy-only, never a state transition change.

Preview: same weekly reading direction as outside matrix (days as columns, shift/variant sections, real slot occurrences); all service days in result, not arbitrary50-row cuts. Preserve actual duplicate slots and source grouping facts, no dummy edit scopes/servings to reuse an editor. Use horizontal table overflow within modal body if necessary, frozen identification/header, one vertical dialog body scroller. Raw file coordinates/diagnostics remain secondary and reachable.

Merged cells use semantic rowspan/colspan; centered content does not turn td into flex or lose table layout. Group edit block is centered inside the cell with a compact group count, picker and subordinate Tách để sửa riêng action. Retain group identity across date/shift/variant and locked scopes. Splitting then editing changes only intended occurrence; group replacement changes all and only its real slots. Long text must not overlap adjacent cells or force the entire dialog wider.

Dirty navigation is a required part of adding leaves: current shell has useDirtyNavigation/registerDirty, but the source workbench is not registered there. Wire actual unsaved source/reason and pending operations to the existing navigation owner; cancellation keeps source+reason+focus, discard only resets local edits. Guard sidebar clicks, customer/week changes and relevant back/forward/reload paths with supported router/browser mechanisms; native beforeunload does not guarantee a custom browser message. No auto-save or duplicate confirmation layers.

Initial-serving entry retains a required audit note (Ghi chú nhập số suất), explains why, and avoids old-null comparison. Later adjustments use genuine saved/proposed facts. No fabricated default reason, changed backend permission or bypassed source gateway. First missing unlocked field is identified/focused before actual preview request; explicit0 remains distinct from null; failed preview/apply/submit preserves editable values.

R09 uses one presentation label authority and removes scattered known-enum literals in affected owners. Raw MORNING/AFTERNOON payloads and keys do not change; unknown values receive an explicit unknown label, not a fabricated Sáng fallback. Do not change export/raw integration formats merely for UI wording.

## 4. Frozen BOM, preparation and cooking (R13–R15)

Frozen modal: retain existing daily facts, date headings and distinct ingredient/unit count. Coalesce presentation only when actual identity/date/unit/rate and lineage permit it; never sum per-serving rates or erase differing facts. Keep same dish across dates/rates distinguishable; unknown units/lineage remain explicit. Known shifts are Sáng/Chiều in both filter and weekly schedule. One dialog vertical owner, safe search/selection, denial/error/retry and focus return.

Preparation:
```
Row1  title + actual service date                         guarded coordinated issue
Row2  compact scheduled-customer selection + selection count
Row3  ingredient search                         Excel supplier filter/export (export-only label)
Body  one main ingredient grid + inline allocation detail / useful prerequisite state
```
Use wrapping at smaller widths, not rigid equal-width cards. Retain hidden selected batches, existing-issue/applicability disablement, stock guards, exact day, atomic coordinated issue and unknown-outcome refusal. In no-selection state keep necessary selection visible but do not surround the empty explanation with empty export/grid toolbars. No automatic selection of ineligible batches.

Cooking:
```
Row1  title + batch + shift + version                     CSV | Excel | In phiếu nấu
Row2  Tìm món/nguyên liệu …                              context counts
Body  compact dish master | selected ingredient detail
```
No separate telemetry-only intermediate row. At narrow/zoomed widths controls wrap, preserving order/reachability. Keep date×shift×variant×dish key, empty-search detail reset, exact six-decimal recipe facts, no guessed kg, unique-meal serving totals. Search filters dish groups while keeping their complete ingredient detail; CSV/XLSX remain whole batch and say so. Printing remains the currently filtered full dish set, not just selected detail; actual print preview/cancel/return must be checked, not only a beforeprint event test.

## 5. Live-test protocol — acceptance, not a demo

### U00 prerequisites, permission and evidence

Before browser testing record exact FE/BE URLs/listener processes/build paths, served new views and read APIs, disk/RAM, actor/permission, actual server mode/version/capabilities, target scope and file bytes identity. Historical running PIDs, Swagger or HTTP200 do not prove current UI. Confirm LifecycleOutbox remains intentionally disabled and exclude dependent delivery claims. Matching updated backend startup requires its explicit runtime permission; no silent replacement of owner processes.

Use a dedicated headed Chrome/profile with confirmed credentials; never reuse user tabs, fake production auth or plant sample rows. Real read-only navigation and write acceptance are separate permissions. Owner may perform real writes while assistant records authorized observations. Agent-driven fixture creation/business writes require an explicitly owned target and backup/recovery scope; none is granted by this plan. Never run generic E2E setup/teardown against main DB. No token/password/workbook contents in screenshots/log reports.

Each UAT row gets: R IDs; starting actor/mode/URL/customer/week/version; actual steps; independently expected outcome; observed outcome; screenshot/DOM/focus evidence; request path/status and sanitized identity; resulting reload state for writes; PASS/FAIL/NEEDS_EVIDENCE/BLOCKED. Record actual evidence links in WORK only. A screenshot of a success message without request+reload is not persisted proof.

| UAT | Execute on the real UI | Required check / likely failure |
|---|---|---|
| U01 | Open each new leaf directly, F5, sidebar switch, back/forward; change customer/week, fast switch with delayed response | Correct active leaf/page/scope; no redirect to mrx-batch, other-customer data or needed preparation visit; denied actor/mode cannot bypass via URL |
| U02 | Existing owner-approved file: close/cancel, discard/reopen, same bytes renamed, changed bytes same name; ambiguous/error history; choose new week; retry import | Actual persisted week, truthful file queue, no stale token/lookup override; one import entry with explicit intent; no duplicate commit on retry/publish failure |
| U03 | Open preview on real weekly file with horizontal/vertical merged dishes and duplicate slots; inspect final service date then source detail | Weekly layout matches target, every actual occurrence retained; no day cut, clipped long dish or dialog nested vertical scroll |
| U04 | Leave one applicable serving cell blank, click continuation; enter0 then complete; actual failed preview/retry; back and re-open | Missing field focused before request; zero accepted; one successful preview opens populated review; draft+reason retained on error/back; correct initial/adjustment copy |
| U05 | Published menu with no batch; existing DRAFT/READY/COMPLETED contexts as available; open import intentions | Source readiness distinct from lifecycle; only one import entry; completed current-scope edit unavailable; Lập lô đối soát does not claim already frozen/ready |
| U06 | View row/column merged dish; enter dish-edit, group-replace, split and edit one; cancel navigation while dirty | True vertical+horizontal center, compact controls, unchanged slot/lock identity; cancel retains data/focus, discard does not mutate server |
| U07 | Two inspection pages and frozen modal for known date/rate/unit differences; server search/page; source refresh; missing recipe/unit | New pages labelled current/draft projection; no rates summed, wrong-unit totals, silent recipe fallback or double-meal count; frozen facts remain original; Sáng/Chiều only for known shifts |
| U08 | Preparation with none/eligible/ineligible/already-issued selection; search that hides selected batch; export supplier filter | Compact layout, exact displayed day, selection/export/issue scope truthful; supplier filter affects Excel only; outcome-unknown cannot re-issue |
| U09 | Cooking long list; select two variants of same named dish; search to none; shift change; CSV/XLSX; print preview then cancel | Two-row header, useful master/detail, exact selected ingredients; no stale detail; counts/servings not duplicated; whole-batch exports versus filtered printing honest |
| U10 | Keyboard Tab/Enter/Escape/calendar and close/confirm/cancel; long Vietnamese customer/file/helper/dish names | Focus visible/logical/trapped where appropriate, no hidden action, clear saved-week association; one blocking interaction and one modal vertical body owner |
| U11 | State-specific authorized failures/fixtures: loading, empty/prerequisite,403,400/5xx+retry,partial,409/unknown outcome | Error never empty; stale data never editable as new scope; retry works without losing draft/duplicating writes. Browser interception belongs ONLY to an isolated fixture lane, not claimed live backend proof |
| U12 | Owner-approved control→request→transition→reload for import/source apply/submit/batch and, only if authorized, stock/export handoff | Correct persisted scope/version/quantity and unchanged old frozen batch; actual coordinator/manager path; no fake data/fallback and no stock writes merely to obtain a PASS |

Geometry pass:1440×900 and1024×768 at100%, then actual desktop browser200% zoom (record zoom and CSS viewport separately; a smaller viewport is not zoom). Check all changed surfaces, merged short/long/group cells, empty and error states and print. Inspect one batched pass, repair findings together, at most one confirmation pass; unresolved cases stay open, not silently excluded.

## 6. Completion and stop rules

Acceptance has separate columns: source implementation, automated contract, rendered behavior, real control/request/reload, owner acceptance. No single unqualified PASS. Any R row missing required evidence is NEEDS_EVIDENCE/BLOCKED and prevents claiming whole-scope completion. A matched-runtime restart only closes availability, not UI/business acceptance.

Stop for unidentified target/credentials, insufficient resources, unsupported fixture authority, source/frozen lineage ambiguity or unapproved domain change. Do not force-pass by mocked component, synthetic production rows, relaxed permissions, allowlist padding, deleting a failing owner or enabling background relay. Keep inherited dirty work/index intact; no installs, commits, migration/seed, delegation, unrelated cleanup or runtime changes implied by approval of design.
