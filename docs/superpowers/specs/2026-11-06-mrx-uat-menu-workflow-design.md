# MRX UAT — menu scope and operational layout design

## Authority and approval

Owner approved the proposed draft-week recovery and prioritized screenshot-led repairs. Additional condition: “Đang dùng bản nháp tuần …” must pass design review, not become an arbitrary extra banner. This document fixes its composition and review criteria. Implementation plan: ../plans/2026-11-06-mrx-uat-menu-workflow.md. WORK is the only live task-state owner.

Preserve docs/DESIGN.md, docs/UI-KIT.md and existing Quiet Operational identity. This is an Operate refinement, not a new visual world. FR-MENU/FR-RECON/FR-WH/FR-CHEF; DOM-MODE-1, BR-MRX-EDIT-1/3/4/6/8/9 and BR-MRX-SERV-1/2 remain binding. Source/self-review is not rendered acceptance.

## 1. Evidence and chosen approach

MenuVersion already persists WeekStartDate, CreatedAt and SourceChecksum. Upload currently requires an explicit week before preview; it does not resolve an existing draft when the same file is reselected. Native file inputs reset after enqueueing, causing “No file chosen” while the queue still has a real File. Missing servings are counted in MrxBatchWorkbench, but its changed-lines continuation bypasses that gate. Frozen materials are daily-line projections, not duplicate master BOM records: never blindly sum or deduplicate across dates.

Use existing modal, import-item hook, paged history query, preview/commit ticket, workbench and UI primitives. Reject filename-only matching and browser-persisted import-session recovery: they cannot establish a persisted draft. Reject a new wizard/global store, new banner rail, schema migration or alternate import endpoint.

## 2. Draft-week recovery and intentional change

- After a file, customer and supported tier are selected, compute the file's SHA-256 using native Web Crypto and query authoritative matching DRAFT history. The server validates checksum/customer/tier, filters before paging, and returns only extant draft versions with actual draft schedules at that tier. No filename-based match, truncated client scan of the first history page, latest-week guess, or match to a cancelled preview.
- One match: adopt its saved Monday, version ID and CreatedAt as read context. Never call CreatedAt the service date. Recover a nonempty explicit existing reimport scope without silently replacing it with another week's match.
- More than one match: require a choice from the paged matching drafts. No write/preview acceptance until resolved or the user explicitly chooses a new week.
- None: normal explicit Monday entry. Missing legacy checksum does not justify guessing. Read failure remains an error with retry or explicit manual week choice, not a false “no draft”.
- “Đổi tuần” changes the field to manual selection, retaining the old value until edited. It means use this file for another target week, not relocate/delete/update the source draft. Fixed workbook dates still obey existing file-versus-request mismatch validation.
- Any file/customer/tier/week change invalidates preview/token. Late lookup/preview responses cannot overwrite newer scope or a manual choice. Commit still reparses and validates the existing file/customer/week/tier ticket; no lock, approval or MRX batch admission bypass.
- Closing an unsaved session discards only local input after confirmation. A persisted draft remains persisted. Cancelling discard preserves the current inputs. Reopening has no stale accepted-preview token.

## 3. Field-level composition — mandatory design gate

The status belongs to the existing week field group, not Modal.description, InlineBanner, TelemetrySubbar or a new card. Use the existing label/control/helper hierarchy:

```text
Khách hàng                         Tuần bắt đầu (Thứ Hai)
[ANV — AMANN                    ]   [16/11/2026, chỉ đọc] [Đổi tuần]
                                   Đang dùng bản nháp tuần 16/11/2026
```

- The date control remains the primary value. The contextual sentence is secondary neutral helper text, >=12px, associated via aria-describedby; no success badge, icon, colored box, duplicate top-level message or extra primary button.
- Reserve the helper area within this field group for lookup status, recovered context, ambiguity instruction or date validation. Errors take precedence, and do not appear simultaneously as a second contradictory helper. Long Vietnamese text wraps normally within the column; no nowrap/min-width forcing the dialog wider.
- Lookup loading says “Đang kiểm tra bản nháp…” in the same helper area. Ambiguity selection stays within the existing body, not another blocking dialog. A readonly date remains readable by keyboard/screen reader; “Đổi tuần” is a secondary/ghost action disabled during writes.
- Manual mode keeps the same control location and helper geometry. No field disappears or moves to a separate row merely because a draft matched. On a tablet the customer/week groups stack in logical order; the date and secondary action wrap without overlap.
- Keep the existing fixed modal header/footer and one body scroll owner. Replace raw file input presentation with existing Button/input affordances and a truthful selected-file queue; do not show “No file chosen” beside an accepted queued file.

Design acceptance: inspect 1440×900 and 1024×768 at normal scale, plus 200% zoom on desktop, with long customer/file/helper text. Check no clipped date/action/error, no horizontal dialog overflow, stable neighboring controls, focus order and safe-close focus return. A source detector cannot establish these geometry facts. Authenticated browser writes require separate permission; use the authorized owner-led flow if no browser target/credentials are available.

## 4. Menu preview, main surface and servings

- Preview presents dishes as a menu grouped by date, shift and variant, with slot labels secondary. Raw source coordinates and diagnostics remain accessible in a clearly named secondary view, not the default flat row list. Preserve each occurrence and any source merge semantics; never infer Mặn/Chay from dish names.
- Keep rendering bounded in complete date groups rather than splitting a day's menu at an arbitrary 50-row boundary. Do not claim server pagination for an already received preview.
- Main workbench reading order: customer/week scope → source version/readiness and batch lifecycle → mode/actions → menu matrix → next action. Source and batch readiness are distinct; do not duplicate “Vòng đời lô” inside the menu group or repeat the entire menu in an impact panel. Retain necessary blockers once, above the affected work surface.
- Missing applicable unlocked Mặn/Chay cells are reported before leaving entry. Zero is an explicit valid value, null is missing. “Tiếp tục xem ảnh hưởng” stays in the current step on incomplete input and identifies/focuses the first missing cell; the hook also refuses preview. Preserve locked dates and all drafts.
- Initial entry uses “Kiểm tra số suất” and a proposed-servings view without suggesting that null means zero. Later edits show saved/proposed/difference. Keep reason and role approval requirements of the existing source-change API; do not invent an automatic user reason or remove backend validation just to simplify first entry.
- The primary preview transition performs the actual impact request rather than navigating to another screen that requires pressing the same action again. Failed preview retains entry and exposes retry; success opens the review panel with the returned result. Returning preserves inputs and returns focus to the trigger.
- Replace user-facing “Tạo lô nháp” with “Lập lô đối soát”; retain the actual DRAFT state and explicit pending validation/freeze steps. Never label a batch ready merely because its menu is published.
- Merged dishes stay inside date/shift/variant and compatible locked scope. Align multiline merged content consistently; do not duplicate dishes to fill cells or break slot lineage/edit targets.

## 5. Frozen BOM and downstream operational layout

Frozen BOM: keep the existing list/detail dialog. Detail groups materials by their actual service date, with clear date headings and one ingredient row per returned daily material fact. “Loại nguyên liệu” counts distinct ingredient/unit identities, not number of date occurrences. Show Vietnamese shift labels through existing MRX constants. Different dates/rates/units stay distinct; no master-BOM reread, averaging or sum of per-serving rates. Preserve missing/ambiguous lineage errors. Existing payload does not attach each material to a shift, so do not pretend a shift-filtered recipe can be reconstructed from date alone.

Preparation: keep daily selected batches/customer applicability, stock command and unknown-outcome guard. Use one compact selection/filter area and the existing main ingredient grid with allocation detail, not stacked empty cards. Excel supplier filter remains export-only and visibly distinguished from grid filtering. Search never changes hidden selected batches or command/export scope.

Cooking: keep exact batch/date/shift/variant/dish grouping. Use existing SplitView to select a compact dish entry and inspect its ingredient table, instead of repeating full-width headers and ingredient tables for every dish. Selection follows real groups; searching/filtering has an honest empty state and does not change whole-batch export semantics or total-servings ownership. No fabricated units or frozen facts.

## 6. Scoped UI gate and design-review result

| Route | Single work object | Mode and existing guard boundary | Reused surface |
|---|---|---|---|
| `/weekly-menu?view=mrx-batch` | OperationalFrame through existing WorkspaceFrame | MATERIAL_RECONCILIATION; existing route/role guards and reconciliation source-read/write capability checks remain authoritative | Modal, VietnameseDateInput, Button, Num, StateBoundary, existing matrix and PaginationBar |
| `/warehouse?view=mrx-preparation` | OperationalFrame through existing WorkspaceFrame | MATERIAL_RECONCILIATION; existing warehouse issue/export action guards, no permission expansion | existing selector, DataGrid and allocation detail |
| `/chef?view=mrx-cooking` | SplitWorkbench through existing WorkspaceFrame/SplitView | MATERIAL_RECONCILIATION; existing Chef route/read/export guards, no permission expansion | SplitView, Button, Num, IdentifierText, StateBoundary |

Keep DEFAULT importer caller compatibility, without introducing MRX navigation or workflow into DEFAULT. For each surface preserve loading, empty, error, permission-denied, partial and write-reconciliation states. Pledges: D6, D7, T7, T8, M1.2 and N6 as defined by the canonical design owner. Record exact current permission/capability tokens in WORK at execution before touching TSX; names must come from actual guard owners, not be invented here.

Source/design self-review: field ownership, semantic priority, existing primitives, one scroll owner and copy provenance are specified; no free-standing draft banner is approved. Rendered review remains NEEDS_EVIDENCE until the real geometry/focus checks in §3 run. Readonly recovery must also prevent the calendar trigger from changing the date until “Đổi tuần”, not merely set readOnly on the text input.

## 7. Verification and exclusions

Reuse current owner tests; protect behavior, not classes or exact decorative copy. Genuine RED→GREEN for regression fixes, network-boundary frontend fixtures grounded in C# DTOs, and persisted history tests for draft identity. Preserve existing lock/frozen/approval/concurrency tests rather than duplicating matrices. Run relevant build/lint/contracts/architecture gates sequentially with installed tools and measured resources.

No dependency install, staging/commit, migration/seed, UAT data mutation, unprompted delegation, runtime restart or background-relay enablement. Browser/business-write acceptance remains NEEDS_EVIDENCE until actually exercised. Source/self-review can approve composition intent, not certify rendered layout.
