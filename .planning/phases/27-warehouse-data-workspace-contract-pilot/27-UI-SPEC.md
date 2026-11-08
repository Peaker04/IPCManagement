---
phase: 27
slug: warehouse-data-workspace-contract-pilot
status: approved
shadcn_initialized: true
preset: ipc-current
created: 2026-08-22
---

# Phase 27 — UI Design Contract

> Visual, semantic and interaction contract for the Warehouse Data Workspace pilot. This contract preserves the current IPCManagement visual identity and implementation stack. It does not authorize a new page framework, component library or redesign mockup.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Existing shadcn implementation; no re-initialization |
| Preset | `ipc-current` — current IPCManagement tokens and primitives |
| Component library | Base UI through the existing local shadcn wrappers |
| Enterprise references | SAP Fiori for page UX/IA; Carbon only for data-intensive patterns |
| Icon library | `lucide-react` only |
| Font | Inter variable through the existing `--ipc-font-sans` / `font-sans` owner |
| Implementation owner order | token → existing primitive → shared component → layout → route |

### Adoption boundary

- Adopt information architecture, hierarchy and data-workspace reasoning from Fiori/Carbon only after translating it to existing IPCManagement owners.
- Do not install SAP UI5, Carbon components or another component stack.
- Do not add a generic `DataWorkspacePage`, floorplan renderer, UI DSL or speculative registry.
- The weekly-menu Template Studio sketch findings are not applicable: they describe a separate customer-template workflow and do not override this Warehouse contract.

---

## Page Archetype and Region Contract

**Archetype:** Data Workspace

**Primary user question:** “Tồn kho hiện tại là bao nhiêu, và những bút toán nào giải thích trạng thái đó?”

**Work object:** Warehouse stock snapshot with supporting movement history and warehouse documents.

| Region ID | Semantic role | Existing owner | Contract |
|-----------|---------------|----------------|----------|
| `warehouse-shell` | Route/page shell | `MainLayout` + `OperationalFrame` | Exactly one page H1 at shell level; no nested H1 |
| `warehouse-tabs` | View selection | `ViewSwitcher` + `KeepAliveTabPanel` | Three tabs, one active tab, accessible names, keyboard access, preserve visited state |
| `warehouse-current-stock` | Primary dataset | `SectionPanel` + `TableViewport` + `PaginationBar` | Heading, search, query presentation, semantic table, pagination and stable geometry |
| `warehouse-movement-history` | Supporting history dataset | `SectionPanel` + `StockMovementTable` | Lower hierarchy than current stock; independent search/query/pagination ownership |
| `warehouse-document-rail` | Supporting document region | `SplitWorkbench` + `DocumentRail` | Tab-level rail independent of row selection; visible exactly once |

### Heading order

1. Shell-owned `h1`: current route title.
2. Operational frame/title group may use `h2` only when it contributes a distinct visible heading; it must not duplicate the shell title.
3. `Tồn kho hiện tại` and `Luân chuyển kho` are `h3` regions under the Warehouse operational context.
4. `Phiếu kho` has an accessible region name and a visible/associated label without introducing a skipped heading level.

### Action hierarchy

- This read-oriented tab has no required mutation CTA.
- Search, pagination and `Mở phiếu` are supporting controls, not primary page actions.
- The contracted surface must contain no competing primary action.

---

## Responsive Layout Contract

Canonical browser matrix remains: `1920×1080`, `1440×900`, `1366×768`, `1365×900`, `1280×900`.

| Mode | Expected structure |
|------|--------------------|
| Wide | Primary/supporting dataset stack and document rail display side by side |
| Narrow desktop | Document rail moves below the dataset stack |
| Transition | The baseline measurement designates the exact adjacent canonical viewports at which the transformation occurs; that expected value is recorded in the contract manifest before production edits |

Invariants:

- DOM and reading order are always primary dataset → supporting history → document rail.
- Focus order follows DOM order and never uses positive `tabindex` or CSS visual reorder.
- The rail exists once; responsive layout must not duplicate or hide a second copy.
- Document-level horizontal overflow is zero. Table overflow, if needed, remains local to `TableViewport`/table owner.
- No region, heading, search control, table control, pagination control or rail action is clipped or overlapped.
- The rail remains visible and named after stacking.
- Responsive changes alter layout only; they do not alter query, selection, route or lifecycle behavior.

### Contracted layout spacing

Only these layout-level values are blocking:

| Relationship | Token/expected value |
|--------------|----------------------|
| Primary dataset → supporting history | `--ipc-space-4` (16px) |
| Dataset workspace → document rail | `--ipc-space-4` (16px) |
| Stacked rail separation | `--ipc-space-4` (16px) |
| Region boundary padding | existing `SectionPanel`/rail owner: 16px base, 20px at existing `sm` rule |

Geometry comparison tolerance: ±0.5 CSS px for browser rounding. Internal Base UI/shadcn spacing not listed here is outside the pilot gate. Source-level hardcoded-token checks remain owned by existing source scans.

---

## Spacing Scale

The phase creates no new scale and uses the current IPC source values.

| Token | Value | Usage |
|-------|-------|-------|
| `--ipc-space-1` | 4px | Compact inline separation |
| `--ipc-space-2` | 8px | Control/icon spacing |
| `--ipc-space-3` | 12px | Compact section internals |
| `--ipc-space-4` | 16px | Contracted workspace and rail gaps |
| `--ipc-space-5` | 20px | Existing responsive panel padding |
| `--ipc-space-7` | 24px | Existing major section spacing only |

Exceptions: no new exceptions. Existing 12px and 20px tokens are retained as current identity; the pilot must not redesign the global scale.

---

## Typography

Use `frontend/src/lib/typography.ts` and existing CSS tokens; no page-local typography system.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 600 | 1.333 |
| Caption | 12px | 400 | 1.333 |
| Section heading | 14.4px (`0.9rem`) | 700 | 1.25 |
| Page heading | 16px | 700 | 1.25 |
| Numeric cells | Body token | 400 | 1.5; tabular figures |

Hierarchy is expressed through semantic heading levels, weight and region placement—not oversized display typography.

---

## Color

Preserve current semantic tokens. Values document the implementation source; components consume semantic roles/tokens, not copied Fiori/Carbon colors.

| Role | Value | Usage |
|------|-------|-------|
| Primary | `--ipc-primary` / `#1a56a8` | Active tab, focus/selected emphasis and existing primary semantics |
| Surface | white + `--ipc-slate-50` | Page, panel and neutral supporting surfaces |
| Text | `--ipc-slate-800` | Main readable content |
| Muted text | `--ipc-slate-600` | Secondary context with required contrast |
| Border | `--ipc-slate-300` | Region/table separation |
| Success | `--ipc-success` | Valid completed/safe states only |
| Warning | `--ipc-warning` | Attention/pending states only |
| Destructive | `--ipc-danger` | Errors/blocking states only |

Accent is reserved for active selection, focus and existing action semantics. Color is never the only status channel. No new palette or page-local hex is authorized.

---

## Copywriting Contract

Current Vietnamese operational vocabulary remains authoritative.

| Element | Copy |
|---------|------|
| Primary dataset heading | `Tồn kho hiện tại` |
| Primary search label | `Tìm trong snapshot tồn kho hiện tại` |
| Supporting history heading | `Luân chuyển kho` |
| History search label | `Tìm bút toán theo chứng từ nguồn` |
| Document region | `Phiếu kho` |
| Document action | `Mở phiếu` |
| Primary empty row | `Chưa có dữ liệu tồn kho` |
| Primary error heading | `Không tải được tồn kho hiện tại` |
| Primary error guidance | Explain that empty presentation is a load failure, not proof that stock is exhausted, and offer retry |
| History error heading | `Không tải được sổ luân chuyển kho` |
| Forbidden headings | `Không có quyền xem tồn kho hiện tại`; `Không có quyền xem sổ luân chuyển kho` |
| Refreshing status | `Đang cập nhật...` |

Rules:

- Empty, error and forbidden remain distinct.
- Technical IDs and raw enums are not promoted to primary labels.
- Fixture long labels remain valid Vietnamese/domain values, not meaningless stress strings.
- This phase does not rewrite business vocabulary unless a contract finding proves a violation.

---

## Evidence and State Contract

### Actor/state matrix

| Evidence tier | Actor/state | Viewports |
|---------------|-------------|-----------|
| Browser | warehouse keeper / representative upper-bound `ready` | all five |
| Browser | warehouse keeper / `mixed-empty` (current stock empty; history and rail populated) | all five |
| Browser | actor without read permission / `forbidden` | all five |
| Structural/component | `loading`, `refreshing`, `error`, all-empty | viewport-independent contract tests |

A structural state is promoted to multi-viewport browser evidence only after deterministic evidence proves viewport-dependent geometry.

### Representative upper-bound fixture

- Reused unchanged at all viewports.
- Stable record IDs map each finding to a fixture row/document.
- Eight rows activate table/pagination behavior.
- Includes valid short/long warehouse, ingredient and document labels; valid small/large quantities; varied statuses; multiple documents.
- Values remain within real domain constraints.

### Evidence manifest per browser capture

Required: route, tab, actor, state, viewport, fixture version/record IDs, screenshot path, `ariaSnapshot({ mode: "ai", boxes: true })`, explicit geometry probes, whitelisted computed styles, active element/focus order, console errors and page errors. Network/trace is attached only when required by a finding or performance diagnosis.

Screenshot supports review but never independently decides PASS/FAIL.

---

## Deterministic Rule Contract

A rule is blocking only when expected value, machine-readable evidence and owner are all known.

| Rule family | Blocking assertion | Owner |
|-------------|--------------------|-------|
| Semantic | Exactly one H1; no heading skip in declared regions | Shell/region owner |
| Regions | Every required region exists once and has the declared accessible name | Region manifest owner |
| Ownership | Rendered region maps to expected source/component owner | Semantic locator → test manifest → source map |
| Geometry | No document overflow, overlap or clipping | Lowest measured layout/primitive owner |
| Focus | Keyboard path and focus order match DOM/semantic order; focus remains visible | Tab/control/layout owner |
| Responsive | Rail side/stack transformation matches recorded expected viewport; one visible rail | `SplitWorkbench`/layout owner |
| Actions | Zero competing primary actions in detailed surface | Route/command owner |
| Runtime | No console/page error | Source owner from error evidence |
| Spacing | Only contracted region gaps/padding, with ±0.5px tolerance | Region/layout owner |

Ownership resolution order is semantic locator → test-owned region manifest → source-aware mapping → local production metadata as last resort.

Any deterministic violation is `FAIL` and makes the Phase 27 gate fail. Severity only orders remediation. Missing oracle/evidence/owner yields `NEEDS_EVIDENCE` or `UNRESOLVED`, never PASS.

---

## AI Review Contract

### Selection manifest

The evidence manifest retains all 15 browser captures. AI receives only:

- `ready`: wide, transition and narrow;
- `mixed-empty`: narrow;
- `forbidden`: one representative viewport;
- any additional capture whose geometry is near a threshold, whose rail transformation is notable, or whose deterministic finding needs context.

Each selected capture records a selection reason. AI cannot expand scope beyond the selection manifest. Viewport/state dependence outside the reviewed set yields `NEEDS_EVIDENCE`.

### Allowed review dimensions

AI may review hierarchy, grouping, visual balance and information architecture. It must state expected, actual, evidence, severity, owner level and confidence.

AI may not select replacement components, write CSS/layout solutions, change tokens, auto-fix or create a default implementation plan.

### AI verdict policy

`FAIL` requires all of:

- evidence selected by manifest;
- concrete expected and actual;
- owner level identified;
- no dependency on an unreviewed state/viewport;
- confidence `>= 0.8`.

`NEEDS_EVIDENCE` applies to plausible hypotheses lacking viewport/state/geometry/context or evidence unable to distinguish interpretations. `UNRESOLVED` applies when expected outcome, owner or required business semantics cannot be established. AI `FAIL` makes the gate red and enters planning; it never edits production automatically.

### Fresh re-review

A fresh reviewer receives only current contract, selection manifest, new evidence, old finding ID and expected outcome. It does not receive implementation rationale, solution diff or implementer explanation. Re-review verdicts: `RESOLVED`, `STILL_FAILING`, `REGRESSED`, `NEEDS_EVIDENCE`, `UNRESOLVED`.

---

## UI Considerations

Applicable state considerations resolved: 8 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Primary current-stock dataset | ✅ covered | Browser mixed-empty keeps history and document rail populated; all-empty remains a structural contract and uses Copywriting Contract text |
| loading | Both datasets | ✅ covered | Structural tests require stable table/skeleton geometry and prohibit empty-state copy while loading |
| refreshing | Both datasets | ✅ covered | Existing data and geometry remain visible with the named refreshing status; no collapse or table replacement |
| error | Both datasets | ✅ covered | Error is distinct from empty/forbidden, preserves the bounded region, uses Copywriting Contract guidance and exposes retry |
| forbidden | Both datasets | ✅ covered | Forbidden actor is captured at all five viewports with named accessible feedback and no false empty state |
| populated | Workspace and rail | ✅ covered | One domain-valid upper-bound fixture with stable identities is reused across all five viewports |
| partial | Mixed-empty workspace | ✅ covered | Independent region ownership is proven when primary dataset is empty and supporting regions remain populated |
| zero-one-many | Document rail and paged tables | ✅ covered | Browser fixture includes multiple documents and eight rows; structural tests cover empty rail/table without changing ownership |
| long-text | Table labels and document rail | 🧪 backstop | Representative upper-bound valid labels must remain readable/non-clipped in the selected screenshot/geometry evidence |
| overflow | Tables, split workspace and rail | 🧪 backstop | Five-viewport geometry must prove zero document overflow and only owner-local table scrolling; near-threshold captures are selected for AI context |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Existing local shadcn wrappers | `Button`, `Input`, `Dialog`, `Select` as already imported | Existing lint/unit/build gates |
| Existing common primitives | `OperationalFrame`, `ViewSwitcher`, `KeepAliveTabPanel`, `SplitWorkbench`, `SectionPanel`, `TableViewport`, `PaginationBar`, `DocumentRail` | Focused contracts plus dependency and production build gates |
| Third-party registries | None | New registry/library additions are prohibited |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — Vietnamese state distinctions and recovery paths are explicit.
- [x] Dimension 2 Visuals: PASS — hierarchy, regions, responsive transformation and evidence matrix are testable without mockup invention.
- [x] Dimension 3 Color: PASS — current semantic palette is preserved; no new page-local palette.
- [x] Dimension 4 Typography: PASS — existing token roles and semantic heading hierarchy are locked.
- [x] Dimension 5 Spacing: PASS — only owner-level contract spacing is blocking with explicit tolerance.
- [x] Dimension 6 Registry Safety: PASS — no new component library/registry/framework is allowed.

**Approval:** approved 2026-08-22
