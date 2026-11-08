# MRX follow-up — compact customer scope, readable inspection pages and retained weekly context

## Authority and status

Addendum to `2026-11-07-mrx-uat-complete-remediation-design.md`, not a replacement for R01–R15 or U00–U12. Owner approved customer-selector direction A and explicitly requested these additions to the plan. Direction A is APPROVED; the expanded composition and implementation plan await owner review. This is design/planning evidence, not rendered or business acceptance. `.planning/WORK.md` is the only live task/evidence owner.

Scope: FR-MENU / FR-RECON / FR-WH / FR-CHEF; DOM-MODE-1; BR-MRX-EDIT / SERV / TRUTH / HIST invariants; DESIGN D6/D7, I1–I4, N1–N8, T1–T8, M1.2 and E1–E8. No business writes, credential use, new runtime restart, seed/migration, install, delegation, staging or commit is granted by this planning request.

## Impeccable design gate — assessed before implementation

Used Impeccable layout + shape against actual source, supplied screenshots, DESIGN and UI-KIT; assessment is direct-parent/source-and-screenshot, not independent dual-agent or live rendered certification. Existing Operate visual authority wins: flat workbench, semantic tokens in index.css, compact operational rows, one primary command. No new palette, card grid, ad-hoc styles, second UI kit or generic MultiSelectV2.

Spatial thesis: service date and coordinated-issue command establish the task; compact customer scope precedes ingredient search; Excel-only supplier/output is a distinct utility group; the allocation grid owns remaining space. On inspection pages, title/scope lead, provenance explains the dataset, search narrows it, table exposes actual quantities. Frozen detail reads section → service date → ingredient/unit/rate, not one undifferentiated text block.

| Evidence | Assessment | Design decision / acceptance consequence |
|---|---|---|
| b1b95866-e8ed-470a-bb6e-e413d55ff206 | One selected customer consumes roughly75px; legend and option have separate vertical tracks | Approved A: anchored searchable multi-checkbox panel; closed scope control36–40px, no full-width customer slab |
| 64243ed9-5455-49de-bb86-c35788e75282; f527ef38-6a6d-4b85-ac00-6706191e91ab | Current source/projection/version/link are a weak continuous sentence; format/hierarchy issue, not proven corruption of business values | Structured labelled provenance, distinct navigation affordance, separate search group; keep current-versus-frozen meaning |
| e205bf5d-9f70-406d-ad6a-31fbfe7eb80f | Generated MRX-SOURCE plan codes dominate repeated menu names | Remove plan-code rendering from inspection list only; retain DTO identity and exact row keys |
| 19551e3c-03ca-4a50-a2ff-4c949ab682d1 | Repeated varying dish counts compete with the actual action | Visible button exactly “Xem”; contextual accessible name identifies date/shift without exposing only identical names |
| fa1e19cc-9a40-40aa-b986-cb1606ca4ea7 | Section heading, date caption and column heading have similar weight/surface | Explicit section hierarchy, labelled date groups and quiet table headers, retained six-decimal facts |
| Cross-route return report | AppShell only copies weekly query coordinates while pathname is /weekly-menu; inspection reads URL only and does not remember a confirmed weekly pair | Preserve last confirmed weekly-menu pair in existing session owner; sidebar re-entry builds explicit scoped URLs from that pair |

Bounded source mechanical layout scan: installed detector on current preparation/inspection/frozen owners exited0 (D:/Temp/ipc-expanded-plan-layout-scan.json). This did not detect or dismiss the screenshot findings. Before editing each FE task, perform Impeccable craft-floor + scoped UI gate. After implementation, batched rendered inspection and layout detector, then at most one product-fix/confirmation round. No visual PASS from a clean scan alone.

## Additive requirements

### R16 — Approved customer-selector A (extends R14)

Use one feature-local `MrxPrepCustomerSelector` backed by the CURRENT preparation response and existing selected batch IDs. The input is batches, not the shared customer catalog. A customer can have more than one batch: selection remains by exact batchId; same-named customers must not collapse distinct batches.

Closed presentation: labelled control “Khách hàng”, count of selected/available batches, one short name when exactly one is selected or a concise multiple-selection summary. No unbounded chips. Zero selection says “Chọn khách hàng”. The closed control belongs to the compact scope/find area; it must not keep the old75px empty strip.

Open presentation: non-modal anchored panel, search by name/code, exact-batch checkbox rows and per-batch Chờ xuất / Chưa chuyển kho / Đã xuất state. Reuse installed @base-ui/react/popover for overlay positioning/focus rather than introducing a generic UI primitive or misusing single-select SearchableCombobox. Existing Checkbox/Input/Button/Badge/Num and tokens remain authoritative.

Selections apply immediately via existing onToggleBatch; no separate Apply/Save or second selection store. Search only changes visible options, never selected IDs or issue/export scope. Ineligible/already-issued batches remain visible with disabled selection and reason; pending/outcome-unknown disables changes. Escape/outside closes the panel, preserves choices and returns focus appropriately; no blocking Modal or nested confirmation. Scroll inside a bounded options panel when needed; no option truncation that makes later batches unreachable. Narrow/200% sizing stays within viewport and preserves complete accessible labels.

### R17 — Restore inspection provenance formatting (extends R10)

Same composed treatment for materials and plans:

```
Title + customer/week                                       Refresh
Nguồn: Hiện hành   Tính chất: Dự kiến   Phiên bản: 3   [Chuẩn bị lô đối soát]
                                                      Search (within same compact strip when space permits)
Main data grid / split workbench
```

Use visible label/value hierarchy and existing neutral status treatment. Make the preparation link a distinct secondary action rather than text glued to version number. Do not imply actual frozen/issued values or invent a status. Search remains visually and semantically separate from provenance; wrap as related groups on tablet/zoom, not one item per accidental row. No duplicated banners/cards/extra primary button. Loading, missing source,403,error+retry,partial and source revision change remain distinguishable.

### R18/R19 — Plans list presentation

R18: In MrxQuantityInspectionPage PlansTable, remove only IdentifierText(planCode) beneath menuName. Do not remove planCode from API, source identity, query keys, generated contracts or exports. Scope is the screenshot's list column; no global removal of document codes elsewhere.

R19: action's visible text is exactly “Xem”, without dish count or separator. Keep real detail opening and give accessible contextual identity from the row's serviceDate/known shift; no fixture or event handler that merely simulates opening. Reallocate freed column space so long Vietnamese menu names/headings remain readable; preserve table scrolling/frozen identifier when genuinely needed.

### R20 — Weekly scope survives leaving the route (extends R10/R06)

Explicit customer/week URL coordinates always win. Sidebar return to either inspection leaf from /warehouse,/chef,/ or another route must carry the last successfully resolved weekly-menu customer+Monday pair. Editing a service date on warehouse/chef must not change this remembered weekly pair. Never combine a remembered customer from one scope with a week from another.

Keep this pair inside existing workspaceSessionStore persistence/lifecycle, not a new global store or router state service. Add a dedicated nested weeklyMenuScope and setter rather than using mutable generic serviceDate/weekStartDate as historical weekly authority. Record only a resolved source whose customer/week matches the requested pair; source failures/late responses cannot replace the remembered pair. Batch workbench and both inspection leaves must participate so the first return works regardless of which weekly page last set scope.

Cold unscoped direct links with no confirmed saved pair still ask the user to select scope; do not choose today, first customer, another mode's scope or cached rows. This revises previous explicit-scope behavior only for intentional sidebar re-entry, whose generated URL becomes explicit. Do not auto-canonicalize an unscoped mounted workbench and repeat the known remount/inbox-loss regression. Existing logout/session reset clears the remembered pair; MRX memory must not surface on DEFAULT routes. F5, Back/Forward and manual explicit deep links remain truthful. Returning from another route is distinct from changing actual source version: refetch by explicit identity, not copied old data.

### R21 — Frozen daily material hierarchy (extends R13)

At MrxBatchDishesModal, section title “Định mức theo ngày” leads; distinct ingredient/unit count is supporting text. Each real service date has a labelled subgroup/caption distinct from its column headings. Ingredient name is primary, existing ingredient code secondary; owner only requested removing plan codes, not all ingredient codes. Keep unit and six-decimal grossQtyPerServing aligned, all real date/rate/unit/lineage differences, unknown dates/units explicit, and distinct count rather than summed per-serving rates. No merging dates or substituting current BOM. One dialog vertical scroll owner; long content, search selection, empty,403,retry and focus return stay usable.

## Remaining binding work, not removed by R16–R21

R01–R15/U00–U12 remain mandatory with current truthful evidence status. Finish the raw material dishSlot presentation and narrow inspection headings at the existing label/column owners; do not invent slot categories or alter raw API keys. Close the two conformance defects by real admin.bom surface and canonical MRX requirement records, not exemptions/false READY. Recheck importer recovery/current/new intent, whole-week preview, merged group controls, early servings, dirty navigation, frozen facts and cooking full-scope export/filtered printing using real owners. Current actor/read-only and actual-file/native-print evidence cannot be inferred from unit tests. U12 remains separately authorized; no automatic business writes to get green.

## Proof and exit

Automated tests at strongest existing boundaries; observed intended RED for cross-route scope regression; no CSS-class tests for spacing. Dedicated launchless headed browser fixture lane is labelled as such, all API writes fail closed; installed-only tools, no generic setup/teardown. Geometry at1440×900 and1024×768, zero/one/many/long-name batches, overlay keyboard/focus, actual200% browser zoom separately verified (viewport/pageScaleFactor is not zoom), native print/cancel and actor/request/reload where authorized. Record every R and exact evidence in WORK; no whole-scope completion until required evidence/owner acceptance. Blocked permissions/environment stay explicit.
