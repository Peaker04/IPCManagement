# Weekly menu — bounded planning contract

Source/tests own implemented behavior; this owner defines planning arithmetic, source readiness and scoped preview boundaries. Shared grain/lifecycle: [DOMAIN](../DOMAIN.md); presentation: [DESIGN](../DESIGN.md); verification: [ENGINEERING](../ENGINEERING.md). `/weekly-menu` source authoring is shared intentionally by DEFAULT/MRX, but downstream records/commands remain separate.

## Menu, servings and BOM truth

- BOM quantity preserves up to six decimals per serving in its owned unit. Quantity × reference price is multiplied unrounded, then currency total rounded to whole VND; do not round BOM first. Estimated/reference cost is not physical issue, actual purchase or receipt proof.
- Locked shift headcounts split 85% savory/15% vegetarian by contract; unlocked/imported counts apply directly. Compute variant costs separately before daily totals. Servings are shift-grain inputs, never independently duplicated on each dish row.
- Customer/week/tier are shared coordinates. URL/server authority owns restored business scope, never localStorage. Every present schedule menuPrice must be finite/supported and unique; zero/negative/nonfinite/mixed invalid prices block analytical BOM/cost/projected export. Only absent schedule rows permits contract/default fallback. Otherwise valid physical handoff is not blocked by an unrelated analytical tier error.
- BOM lookup retains dish/customer/tier/effective date and source-line/unit identity. Gross per-serving quantity is not consumption, and API does not supply an independent net value; no invented net/loss calculation. Missing BOM is not zero; nonpositive reference prices mean incomplete checking, not free ingredients. Partial missing BOM is excluded explicitly, not presented as complete zero-cost total.

## Commands and production boundary

Production navigation/work is owned by actual shell and `/weekly-menu`. Gated planning candidates do not replace it. Current preview is the five-destination hybrid with independently capability-gated local Cost/BOM views; a proposed sidebar taxonomy or accepted drawing is not mounted cutover permission. Do not duplicate the same workspace set in sidebar and page tabs.

Workspace navigation remains available without customer/week, but scoped queries/writes fail closed. One prerequisite surface names/focuses the first missing coordinate: customer first if absent, otherwise real week input. Import/editor/publish/export retain their own explicit permission-gated commands; customer/week/menu/plan checkpoints are not an ambiguous command dropdown.

Daily demand reading never narrows weekly calculation command scope. `Tính nhu cầu tuần` / `Tính lại nhu cầu tuần` targets customer/week; current backend processes one serviceDate + customerId + FULLDAY per request and frontend orchestrates dates. Not atomic week persistence.
- Preflight uses weekly sources/per-date staleness, not only viewed-day completeness.
- Confirmation names week, updateable/read-only dates/reasons and pending serving inputs that existing handlers save/complete first.
- Results report each date's success/failure/unchanged/locked disposition; never claim full-week success for partial outcome or promise unsupported selective retry/rollback.
- Keep date/shift/customer/tier/ingredient/unit grain and physical/projected meaning; remaining-to-issue does not establish purchasing entitlement.

## Demand work-object and source ordering

Demand view reads one selected service day. Day selector, approval, handoff counters, warnings and document rails stay day-scoped. With generated material rows, lead with ledger and closed/openable KHSX source disclosure. Without rows/incomplete shifts, lead with shift editor and useful empty explanation, completion controls above source rows. Without rows/completed shifts, lead with compact calculate state and collapsed source. No universal ordering regardless of readiness.

Material requirements are read-only multi-actor facts; generic cross-role CTA columns do not invent warehouse/purchasing commands. Existing role workbenches own them. Document rail has one Day/Week scope; draft KHSX stays day-only, weekly lists finalized backend documents.

## Scoped sandbox query and interaction contract

Current preview behavior does not certify production cutover or global theme/accessibility:
- Scoped planning-demand-preview-tokens.css binds DESIGN targets without replacing global theme/portal calendar/confirmation interiors. Natural multiline labels grow; quantities stay right aligned/tabular/six-decimal. No arbitrary desktop minimum, clipped values, synthetic rows or fabricated page height; native zoom needs separate evidence.
- Existing StatusBadge owns approval label/tone beside day; query activity never replaces it. Pending/approved/rejected use existing semantic treatment; handoff is plain text with exact mapper label/actor hint, not a redundant badge. No color implies shortage or purchase eligibility. Required quantities are emphasized, physical progress remains precise/uncolored. Missing BOM/error/denial/locked/stale sources retain separate explicit reasons; no new business states are inferred.
- Search/handoff filters are **current fetched page only**, not server-wide search. Inputs respond immediately; nondefault filtering settles after shared 250ms debounce. Clear/day/page changes reset immediately and cannot replay queued old filter. Local filtering issues no request; server paging/query-key isolation remains owned separately.
- Uncached day/page transition may retain committed presentation only explicitly read-only and distinct from requested key. Source failure, denial/error or customer/week change clears it. Initial loading separate; never previous-key `.data` or fake geometry as requested data.
- Same-key refetch locks weekly calculation/serving writes, cancels confirmation and never reopens it automatically. Source/draft state keeps exact date/shift/dish and existing scheduleWorkflow.quickServingInputs/save/complete/permission/readiness owners. Disclosure/navigation does not implicitly query/save.
- Controls remain reachable and real focus/document scroll anchor preserved. Short page can clamp scroll to zero; do not manufacture space to keep pagination fixed. Week conditions have command-adjacent summary and separate full-width disclosure; bounded desktop scrolling/natural low-height flow does not prove every browser/version or zoom.
- One activity marker with accessible requested-target/committed-readonly announcement; reduced motion static. No changing redundant refresh prose or extra page-state line. Approval remains business truth.
- `PaginationBar.preserveFocusWhilePending` opt-in keeps available directions focusable with aria-disabled plus pointer/keyboard activation guard; boundary directions/page-size/jump and other consumers retain native disabled. Completion restores available focus; pending cannot request another page.

### Failure, denial and recovery

Preview recoverable refetch failure (network/timeout/HTTP5xx) may retain read-only content only when all three active-key `currentData` values exist. Mark stale/retry, keep generation/serving/confirmation unavailable. Any 401/403 or missing current-key source suppresses content; never use another day/page/customer/week `.data`. This opt-in does not change the legacy page error contract. Confirmation cancels on lost readiness and does not auto-reopen after retry.

Serving-query errors disclose retry and mark readiness unverified/danger; successful retry clears cached warnings. production.read denial is explicit 403, not “no plan” or active day filters. Authorized valid customer/week with no plans says “Chưa có kế hoạch sản xuất trong tuần đã chọn”, not reselect already-valid coordinates.

Confirmation has one DialogBody primary scroller with title/scope/actions outside. Busy guards veto closing/reentry; focus retargets from disabled child to enabled child/root and returns exact opener. Pending opener restoration must stop on deliberate navigation/focus, another modal, removal/disposal; bounded observer cleanup is not a readiness SLA. Existing nested-confirmation applicability remains OWNER_DECISION_REQUIRED under DESIGN, not authorization to add layers.

Quick-serving feedback uses existing InlineAlert severity/live role, replacement and scope reset. Failed save retains date/shift draft and existing blur/Enter/completion retry owner. Unsaved indicator alone is not failure feedback. Actual control mechanics/source hooks are implementation owners, not a new parallel workflow.

## Template Studio

Default fallback immutable; customer override/source/version explicit. Parsing/preview/diagnostic navigation never persists menu; save explicit, errors block, acknowledged warnings distinct. Diagnostics retain sheet/cell/range; A1 and drag ranges normalize identically with keyboard parity. Sketch widths/themes are not business authority.

## Gated planning candidates

`/__kit/planning/*` entries remain in the same frontend app with DEV/exact-preview-flag, ProtectedRoute, coordination.read, SystemOperationProvider and matching capability checks **before** queries. DEFAULT read-oriented dish-materials/cost/production-plan/purchase-summary entries do not replace production navigation or the schedule/demand candidates; MRX material-demand/meal-order owners are separate.

| Candidate | Truth and exclusions |
|---|---|
| Schedule | Four shift×variant matrices reuse import merge source cells/order |
| Demand | Page-flow projected/history/server suggestion fields additive; SuggestedPurchaseQty is not current stock/entitlement; sources attach to ingredient and commands reuse guards |
| Production | Persisted plans, PlanId/MenuVersion/lifecycle/date/shift/dish; sentToKitchenAt is fact, not a new send action or altered generic status |
| Cost | Existing costModel rounding; per-dish effective BOM × factor follows selected row; incomplete BOM/reference prices explicit |
| Dish materials | One dish/serving/effective gross BOM, reference prices, six decimals; CSV selected dish, no invented net/consumption |
| Handoff | Physical report family only, no analytical catalog/BOM reads; date/customer/tier/ingredient/unit, whole-filter server counters/search/page; metadata cannot invent document-source IDs |

ReadPlanningPreviewPage composes committed customer/week, schedule/contract tier and existing servings/BOM model without import/editor/mutation/hidden Demand queries. Active workspace mounts only its read family; active-key currentData, denial/error precedence and scope reset apply. Analytical BOM date remains active service date or first displayed day, not a new selector.

`Xuất BOM dự kiến` reuses unchanged buildWarehouseCsv projection from real customer code/week/committed rows/servings/effective BOM, never UNKNOWN/hardcoded date. LT/TT legacy columns are projections, not issue/receipt/consumption; disclose provenance and block missing/denied/invalid/no-material sources. It does not create durable handoff. Physical handoff CSV is **current page**, not full-week/BOM; successful physical empty never becomes analytical BOM.

usePurchaseSummary rejects previous-key data on uncached search/page/scope; permitted same-key ready refresh remains fail-closed on denial. This pending behavior is also used by legacy WeeklyMenuPage, not whole-legacy acceptance. Read-only handoff pager can retain same-scope/search navigation metadata—not rows/counters—during pending; search/scope/denial/error clears it and repeat activation remains guarded.

Shared CommandBar/inline ContextStrip/quiet TableViewport variants own scoped surfaces, not global theme adoption. Density stays OWNER_DECISION_REQUIRED. Production cutover requires mounted functional/accessibility/data/performance acceptance and explicit permission; unit/build/parser/screenshots alone do not certify it.
