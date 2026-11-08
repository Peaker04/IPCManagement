# MRX post-review follow-through — design for approval

Date: 2026-11-08

**Approval boundary:** owner đã duyệt chốt spec + plan, commit tài liệu và bàn giao trong lượt 2026-11-08. Đây không phải lệnh thực thi T1–T5. Không có quyền sửa source/tests, tạo fixture, migration/backfill, business write, restart/deploy, install, delegation hoặc commit mã sản phẩm từ tài liệu này. `.planning/WORK.md` là owner duy nhất của trạng thái; checkboxes trong plan chỉ mô tả công việc tương lai.

**Plan:** [implementation plan](../plans/2026-11-08-mrx-review-followthrough.md).

## 1. Intent, scope and approaches

Đóng đủ năm finding của lần review sau P1–P5, không chỉ làm test hiện tại xanh. Luồng vận hành nhiều vai trò, khách hàng và lô phải giữ cùng định danh từ URL → dữ liệu đọc → draft → command và từ bộ lọc → projection → file xuất. Ba blocker F1–F3 phải được sửa trước phát hành; F4–F5 cũng nằm trong phạm vi đề nghị duyệt này, không bị âm thầm để lại.

Các cách đã cân nhắc:
1. **Đề xuất: sửa tại owner hiện có**, thêm regression tại ranh giới thật và kiểm tra giao điểm giữa các tính năng. Ít thay đổi, giữ lịch sử và hợp đồng P1–P5 đã sửa.
2. Key-remount theo query, bỏ validation workbook hoặc nâng tất cả formatter lên cùng precision: ngắn nhưng làm mất pending/unknown fence, che dữ liệu thiếu hoặc thay đổi cả quantity/currency ngoài scope. Loại.
3. Router/state machine mới, framework mock/API mới, decimal transport mới: lớn hơn nhu cầu, thêm migration/callers. Không đề xuất.

Đây là một gói follow-through gồm các owner task tuần tự có thể kiểm tra riêng, không refactor toàn hệ thống. Cách đề xuất được chốt trong bộ tài liệu bàn giao; triển khai vẫn cần yêu cầu làm tiếp rõ ràng từ owner.

### Preserve / non-goals
- Giữ frozen conversion evidence; không đọc master data hiện tại để suy lại lịch sử, không chia rounded total cho servings.
- Giữ command identity, idempotency, sticky unknown-write recovery, CustomerId-keyed allocations, dashboard revalidation/generation fencing và bulk daily status.
- Không thay endpoint/DTO/schema nếu năm sửa này không đòi hỏi; không tạo migration mới, không apply migration trước đó. Generated contracts chỉ đổi nếu thực tế phát hiện wire change và được duyệt bổ sung.
- Không đổi customer code/name, giá/tier/BOM, role/permission, physical stock, source versions/date locks, Monday–Saturday policy hay historical Sunday read-only.
- Không chứng nhận SLA, production capacity, MySQL concurrency, live persisted write hoặc browser/print bằng unit tests.

## 2. Canonical contracts and responsibilities

Relevant requirements: `FR-WH`, `FR-CHEF`, `FR-RECON`; `DOM-MODE-1`/`BR-GLOBAL-01`; `BR-MRX-EDIT-3/7/9` (lineage, day locks, concurrency), `BR-MRX-TRUTH-1/2` (final quantities/evidence), `BR-MRX-SERV-1/2` (serving basis). `NFR-PERF-01/02` remain obligations, not acceptance inferred from bounded query count. Definitions reside in `docs/DOMAIN.md` and `docs/domain/material-reconciliation.md`; source/test contracts override stale architecture prose.

| Finding | Existing production owner and connected callers | Primary observable evidence |
|---|---|---|
| F1 | `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`; `MrxDailyIssueWorkbench.tsx`; existing `components/workbench/DirtyNavigation.tsx` only where needed for guarded navigation; `useWorkbenchQuery`/session/cache remain reused | Same-mounted route navigation, displayed batch/date, actual POST batch/date/daily-line IDs and request count |
| F2 | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationPreparationWorkbookExporter.cs`; `PreparationWorkbookBuilder.cs` retains strict checks | Real exporter → serialized XLSX; menu-only customer identities and zero allocations |
| F3 | Same backend Services directory: `ReconciliationKitchenExportService.cs`; FE `utils/formatters.ts`, `components/ui/num.tsx`, `features/chef/branches/MrxCookingDishListBranch.tsx`, `components/workbench/MrxBatchDishesModal.tsx` | CSV numeric field, XLSX numeric XML cell and rendered rate/total cells |
| F4 | `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx`; existing workspace owner as guard only if required | Actual enabled/disabled interactions and unchanged attempted fields through deferred POST/unknown response |
| F5 | `frontend/src/test/setup.ts`; existing HTTP fixtures/tests using it | Unexpected request fails even if caught; explicit expected reads, no unit-test network |

No parallel owner, V2 primitive, wildcard response registry or production test seam. Inventory every caller of changed exports before editing; extend existing test owners rather than duplicate every scenario at each layer.

## 3. F1 — coherent route scope without dropping write protection

### Authority and transitions
- Explicit nonempty `batchId` prop remains embedding authority; otherwise explicit URL `batchId` is authoritative on every same-mounted navigation, not just first render. URL/prop service date follows the same rule. Snapshot/session/catalog are fallback only when explicit scope is absent; no override from the first catalog item when an explicit ID is loading, absent from the current page, invalid or forbidden.
- Define one local scope transition in the existing workspace owner, used by route changes and header selection. Preserve unrelated search parameters and existing history semantics; do not create URL↔state replace/push loops. Re-entry/Back/Forward are not header selection events.
- During a clean transition, fence writes immediately until the requested scope, active scope and authoritative daily payload agree. Reset only old-scope transient state: initial quantities/reasons, supplemental material/quantity/reason/modal/error, success/error notices, inspected issue, page and attempted IDs **only when no write is pending/unknown**. Never submit a hidden old-scope draft.
- Unsaved editable drafts use the existing discard/cancel navigation confirmation. Cancel preserves scope/draft; confirmed discard clears transient old-scope state and follows the requested route. Retain existing intentional saved-draft recovery by exact actor/batch/date/sourceVersion; do not erase all localStorage or other batches' saved drafts.
- Pending initial/supplemental POST or either outcome-unknown state blocks scope change and discard. Back/Forward/sidebar/header cannot clear the fence. Keep attempted batch/date/command ID and visible values; recovery remains explicit authoritative reload/history, never automatic replay or a new command ID.
- If navigation reaches a new URL despite the normal guard, fail closed: no mutation while URL and active scope differ; retain attempted scope and recovery information. Restore the guarded route using the existing navigation owner; do not silently relabel old payload as the new batch or initialize a second editable workspace. No remount workaround.
- Keep existing late-response generation guards: delayed B data cannot replace A after Back. Missing/denied target shows its real error/unavailable state, not another customer's first batch.

### Acceptance
**AC1:** Same mounted A→B→Back→A and Forward→B have matching route/header/daily data; a fresh initial or supplemental POST uses the currently displayed `reconciliationBatchId`, `issueDate` and that scope's daily-line IDs. No command occurs during transition.
**AC2:** Dirty cancel/confirm behaves as above; pending and unknown variants cannot navigate/discard/reset/retry. Delayed old-scope response and explicit target absent from catalog cannot redirect the command to another batch. Existing F5-reload case remains.

## 4. F2 — union of identities, not relaxation of supplier scope

- Build filtered material detail and included frozen menu rows before finalizing customer definitions. Resolve identities from the already selected batches/menu versions plus material identities; menus do not invent customer codes from display names.
- Definitions are the union of **customers actually referenced by material rows or included menu rows**. With `IncludeMenus=false`, preserve material-only scope. With `IncludeMenus=true`, menu-only customers remain even when their matching material quantity is zero. All selected frozen menu rows survive supplier filtering; materials remain supplier-filtered.
- Deduplicate by CustomerId; stable code/ID ordering and `code · name` labels remain. Conflicting metadata for the same ID must not silently pick arbitrary first evidence; reject inconsistent identity. Different IDs with equal names remain distinct; repeated batches for the same customer aggregate once.
- Every material summary dictionary contains each defined CustomerId, using numeric zero for customers with no matching allocations. Keep totals as the sum of filtered material detail; adding menus/zero columns cannot change quantities.
- Keep builder validation of missing/duplicate/mismatched IDs. No name-key fallback, removal of menu validation, extra DB writes or live lookup for frozen dish facts.

**AC3:** Real SupplierName+IncludeMenus=true export with A matching supplier and B having only excluded-supplier materials yields both menus/definitions, A's filtered quantity, B=0, unchanged total, and valid XLSX bytes. If the supplier matches no materials, selected menus still export without invented material rows/totals. IncludeMenus=false retains existing material-only workbook. Duplicate-name and repeated-batch regression remains green.

## 5. F3 — per-serving rates are not final quantities

- Keep decimal frozen calculation and numeric API types unchanged. A canonical per-serving rate is not subject to six-decimal final quantity rounding. The backend export writes nullable decimal rates with up to the decimal type's 28 fractional places, invariant decimal separator and no fabricated zero (`0.############################`); null stays blank.
- Use separate rate serialization at both `BuildCsv` and `BuildWorksheet`. Existing final total/waste formatting is unchanged; XLSX rate remains a numeric cell, not locale text. Existing text/formula escaping remains.
- Extend existing `formatNumber` and `Num` with `format="rate"`, used by both real rate consumers. Use Vietnamese locale, `maximumSignificantDigits: 15`, without a competing fixed six-decimal cap; no fixed-20-place solution that can still turn smaller supported rates into zero. Omit `decimals` for the rate callers. Existing `plain`/`quantity`/currency behavior and final-total six decimals remain unchanged.
- Null/unavailable remains `—` and existing reason tooltip; missing unit remains unknown, never guessed kg. No strings parsed back into business calculations.
- Precision boundary is explicit: browser JSON numbers and Excel have roughly 15 significant decimal digits. This change prevents false-zero presentation and preserves backend decimal text/XML; it does not promise lossless 28-digit Excel/browser arithmetic or change wire transport. A future exact-decimal transport is separate scope.

**AC4:** Supported `0.0000004 kg/suất`, 1000 servings retains numeric CSV/XLSX rate 0.0000004, displayed `0,0000004`, final total `0,0004`. Check final bytes/cells and real DOM, not only JSON. A positive rate below 20 fractional places (e.g. `0.000000000000000000000001`) must not display zero. Ordinary 0.1 stays readable; null stays unavailable; quantity rounding remains six decimals and frozen totals are not recomputed.

## 6. F4 — preserve the visible attempted supplemental payload

- Apply the existing lock predicate `isSubmittingSupp || isOutcomeUnknown` to direct material Select, quantity Input, reason Input and every preset button. Prefer direct `disabled` props: custom primitives must be disabled semantically and behaviorally, not merely visually through an ancestor fieldset.
- Existing mode/by-dish controls, submit, Escape/overlay-close and scope navigation protections remain. Late reads may update source facts but cannot change attempted material/quantity/reason. No new payload store is needed if current controlled values remain stable; preserve command ID in the existing hook.
- Definite rejection (existing 400/409 path) remains editable after pending ends; unknown 502/503/transport/malformed receipt remains locked until existing explicit recovery. Do not disable the recovery action.

**AC5:** Deferred POST locks all direct controls before completion; attempts to type/select/click presets leave visible values and request payload unchanged. Unknown outcome retains those values and no second POST; definite rejection restores correction controls. Test through the real workspace/modal, not mocked business hooks.

## 7. F5 — fail closed at the unit-test network boundary

- Remove catch-all HTTP200/success/[] behavior. Default unhandled fetch records method+URL (no bearer/body secrets), rejects, and causes a post-cleanup test failure even if the component caught its rejection. Expected 401/403/5xx tests use explicit handlers and are not unexpected traffic.
- Keep the fail-closed baseline intact across current `restoreAllMocks`, `unstubAllGlobals`, per-test spies and global stub lifecycles. They must not restore native fetch and reach the running localhost backend. Verify actual hook ordering in installed Vitest before choosing the smallest setup mechanism; no new mocking dependency.
- Mock necessary background reads explicitly at HTTP/apiClient boundary in the responsible test/fixture, with real endpoint/method and backend-shaped DTO/envelope/page. Share identical DTO builders only for real repeated use; no endpoint-prefix allowlist or unbounded successful fallback.
- Extend the existing anti-fake support contract with a bounded isolated Vitest negative-control run: an unexpected fetch whose rejection is caught must still produce nonzero runner exit with method/URL diagnostics. An explicitly handled empty success and an explicitly handled server error pass. Include a restore/stub lifecycle case proving native network is not reached. The deliberately failing case is subprocess input, not a permanently failing normal suite test or skipped fixture.
- Existing invalid component/error contracts exposed by strictness are repaired at their genuine owner; do not just add success responses to silence an error the test should observe. No test deletion, weakened assertion, exemption padding, heap/timeout increase or test-only production export.

**AC6:** All FE unit tests finish using explicit intended responses; missing handlers fail reliably, including swallowed rejections, without external/live requests. Full-suite completion, not only focused tests, is required because setup affects every unit test.

## 8. Verification, delivery and remaining release gates

1. Each finding gets intended pre-fix RED then owner-level GREEN; compile errors/missing fixtures are not the regression proof. Extend existing cases/tables; each boundary has one owner.
2. Run focused Warehouse/Chef/Reconciliation/Primitives/API tests and preparation/kitchen backend tests, rebuilding changed backend code. Do not validate the fix using an old test DLL.
3. Run canonical full FE and approved filtered backend suites, build/typecheck/lint/dependency/conformance checks. Preserve excluded suite names and timeout/runner failures as limits, not PASS.
4. UI work must announce scoped pre-code gate before TSX edits; load UI/code-review and test-audit gates. Keep six states, current actual RBAC tokens, D6/D7/T7/T8/M1.2/N6 and index.css-only styling. No redesign is intended.
5. Dedicated mocked browser evidence should cover same-mounted Back/Forward and tiny-rate rendering at desktop/tablet; label fixtures as such. Existing missing `operationalPageContracts.test.ts`/`*.contract.test.tsx` stays NOT_PRESENT unless real owners are found; do not manufacture a replacement/exemption. Native200%, keyboard/print require separate genuine evidence.
6. Review the integrated route→write, filter→workbook and DTO→formatter paths after all five changes; run fresh full checks again after any final repair.

**AC7 / handoff:** report F1–F5 separately as PASS/FAIL/NEEDS_EVIDENCE/BLOCKED with commands/artifacts and no inferred rollout approval. Preserve inherited dirty files, HEAD and empty index. Stop for owner if scope expands (wire/schema, new dependency, unrelated behavior defect, live action or external consumer requirement).

Still separate: exact-target migration + matching backend/clients, backup/recovery authorization, authenticated accepted-write→persist→reload/lost-response UAT, MySQL provider/concurrency/load/SLA, external consumers, forced logout, native200%/print/U12. None is resolved by this spec or previous unit-test counts. Historical 481FE/1528API+49Application and latest 55FE/49BE are not fresh implementation evidence.
