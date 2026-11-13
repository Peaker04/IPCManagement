# Frontend render continuity — specification

**Status:** Proposed for operator review; documents only, implementation not started.
**Execution:** Native Pi parent execution via executing-plans; no automatic subagents, external agent CLI, independent reviewer launch, commit or deployment.
**Scope:** All four findings of the transient-flash audit; cross-route diagnosis and repair only for reproduced defects. Shared NFR-UI-05/C1–C12/E1–E8 and FR-RECON; caller verification spans canonical routes and allowed views in routeRegistry.ts.

## 1. Problem and evidence

1. StateBoundary background-error rendering moves children to a different React parent than normal rendering. Source establishes a remount risk; regression must demonstrate lost DOM identity/state before repair.
2. MRX Page places LinesBranch/search/status toolbar inside an empty/error-replaceable boundary, then substitutes a separate weekday group outside it. Nonempty→empty→nonempty destroys local toolbar state and changes control ownership.
3. StateBoundary uses delay0/minimum0 despite comments claiming150ms suppression. **Correction to audit interpretation:** zero delay alone is not a defect. DESIGN §8 requires an immediate geometry-matched cold skeleton. Do not change that requirement to make an anti-flash test pass.
4. Existing class/slot assertions cannot establish temporal continuity, focus preservation or measured geometry. Existing five-suite audit baseline79/79 PASS does not certify no flash.

The Vite cached-empty-module incident is independently reproduced and recovered; its cause must not be generalized to production UI. AppShell/Suspense/StrictMode/auth bootstrap are hypotheses, not approved targets for blanket removal. ARCHITECTURE.md describes additional owners that differ from the current inspected entry; actual main.tsx→App.tsx→AppShell/guards and current callers govern implementation. Reconfirm intake before executing; do not silently migrate routing/query architectures.

## 2. Required behavior

### R1 — Stable shared content ownership

Within an allowed, already resolved scope, success→background-fetch→recoverable error→retry→success retains the same content parent, mounted stateful descendants, input values, focus and scroll. An inline error remains visible with retry. Add/remove explanation only; never promote a background refresh to full-page skeleton or remount to clear errors.

Do not preserve an unauthorized work surface to achieve continuity. Actual403, operational-mode isolation, invalid lineage and write conflicts keep their established blocking/recovery semantics. An action-level409 must preserve the user's modal/form draft for reconciliation, not bypass the conflict. A background error is not an empty result.

### R2 — Persistent MRX controls

One owner above the replaceable data body holds search term/open state/status selection. In the same batch, nonempty day A→empty day B→nonempty day A retains the control DOM, selected filter/query and predictable focus. Counts always refer to the authoritative displayed day; previous-scope counts must be marked pending, never presented as new-day truth. The weekday group has one production instance, not normal and fallback copies.

Keep approved composition: standalone readiness banner, one nonwrapping weekday/status row, search replaces only weekdays when open; close/Escape retains query/day/results and returns focus. Closed nonblank search visibly indicates Đang lọc. Empty days retain day navigation/search/status controls with authoritative zero counts and no enabled bulk/write action. Distinguish raw empty day from a nonempty day filtered to zero. Preserve existing status reset on batch changes; search is scoped to batch and resets on batch identity change, not day changes. Changing away from lines may unmount the line workspace deliberately; no promise to keep inactive routes mounted.

Bulk disposition always uses eligible lines of the authoritative day, not only search matches. Gate mutations/details/exports during previous-data transitions using existing guards; retained old data is read-only and visibly pending. Forbidden/mode/conflict states must not expose actionable unauthorized controls.

### R3 — Canonical pending policy (no cosmetic hiding)

- Cold first load/no usable data: immediate WorkbenchSkeleton with resolved toolbar/table/split geometry; no blank intermediate canvas. Canonical cold-load CLS <=0.05.
- Warm refresh: retain existing work object and controls; inline feedback only. No full-body skeleton, no setData(null) to clear a spinner.
- Pagination: retain old table until latest page resolves; canonical2px progress/mild dim treatment, animations <=150ms and reduced-motion support. Never flash final-empty before an unresolved response.
- Date/filter/scope changes: retain previous data when safe, mark previous scope and disable writes; atomic latest-scope commit, no stale response overwriting newer state. No cross-user/mode leakage.
- Mutations: pending state local to the submitted action/form; do not toggle full-page loading. No real business writes are authorized by this document.
- No arbitrary minimum skeleton duration, delayed data commits, global fade, blanket opacity, extra per-route timers or new cache/query framework. Correct misleading comments. Change pending animation behavior only for a reproduced timeline issue, keeping canonical feedback.

### R4 — Real regression ownership

Extend existing owner tests rather than adding a parallel suite. A remount regression compares actual DOM node references plus an edited stateful child/focus; a search regression uses real Page→HTTP DTO→DOM with delayed responses and verifies pending→resolved transitions. Use controllable network promises/fake timers only where timing itself is the contract. No mocked subject, test-only export, skip/allowlist, fabricated success, or weakened permission/error assertion.

Retain the immediate Frame0 skeleton test. Replace or narrow only class-only tests whose claimed anti-flash contract is superseded by stronger behavior evidence; keep independently valuable a11y/geometry contracts. Every claimed bug repair needs observed intended RED before GREEN.

### R5 — Browser proof and route coverage

Maintain a result row per canonical route/eligible view family: build/source, mode, actor role (not secret), URL, cold/warm cache, action, network condition, viewport, evidence and PASS/FAIL/BLOCKED/NEEDS_EVIDENCE. Cover public login/forbidden and all protected routes; skip no route silently. Probe BOTH DEV and production preview separately; do not compare their timing as equivalent.

Primary journeys: sidebar route→route and back/forward; MRX day A→empty B→A; filter/search open/close; slow refresh→500→retry; page transition; modal close/cancel and denied/conflict feedback. Start with concrete MRX journey, a cold lazy route such as reports in an eligible DEFAULT session, and shared-boundary refresh. Broaden all-route measurement without speculative source rewrites. For each new route defect capture a failing trace then patch its existing owner and rerun that journey.

Measure from before interaction until authoritative settlement: DOM continuity for same-workspace controls, blank/wrong-empty frames, work-object/header/control bounding boxes each animation frame, request ordering, errors and screenshots/video/trace. Observe layout-shift entries **including recent-input entries** for diagnostics; CLS alone excludes many interaction shifts. General CLS <=0.1; cold work-object CLS <=0.05; stable same-workspace control anchors differ <=1CSS px at fixed viewport except intentional state/viewport changes. Report raw displacement and frame gaps as well as CLS; zero CLS does not prove no flash. Test default motion and reduced motion,1440×900 and390×844. New routes may intentionally have different work objects; require stable shell and correct new-route loading, not identical page geometry or all routes staying mounted.

Reuse installed Playwright with a fresh dedicated browser context and operator-confirmed credentials/URLs. Browser suite must fail closed when credentials/backend are unavailable; no hardcoded credentials, synthetic token/user fallback, swallowed setup failures or mock-login bypass. Controlled HTTP interceptions are allowed for regression tests only, clearly labeled, never evidence of real business persistence. Use only existing authorized read-only data and known empty-day scope; if absent, mark blocked rather than seed or delete data. Live validation must not change server mode or submit business mutations. Both modes require separately authorized existing sessions/environments; no production-mode switch to get PASS.

Existing default browser configs inject a mock-login flag/reuse arbitrary servers and request reduced motion only. Use a dedicated flash config without webServer/mock-login/auto-install so the evidence attaches to confirmed running endpoints and tests both motion profiles. No service restart, new preview process or credential login without appropriate scope; request operator confirmation when missing. Do not copy credential values into artifacts.

## 3. Acceptance and boundaries

| ID | Acceptance | Owner task |
|---|---|---|
| AC1 | Recoverable-error/retry preserves actual content node, local edit, focus and scroll; blocking states stay truthful | T1 |
| AC2 | MRX controls/query survive nonempty→empty→nonempty; no duplicate date group, stale writes or wrong-day counts | T2 |
| AC3 | Frame0 cold geometry preserved; warm transitions have no full-body skeleton/wrong-empty; latest scope wins | T3 |
| AC4 | Every repaired bug has owner-boundary RED→GREEN; misleading class-only guarantees removed without weakening contracts | T1–T4 |
| AC5 | DEV+preview temporal evidence and explicit route coverage statuses; cold/general CLS thresholds satisfied | T4–T5 |
| AC6 | Full FE unit/contracts, lint/build/diff pass; native source/UI/test review; no mode/RBAC/quantity/lineage regressions | T5 |

Code verification alone is SCOPED_CODE_VERIFIED, never fully fixed. Missing browser/actor/data/preview evidence leaves LIVE_ACCEPTANCE_NEEDS_EVIDENCE or BLOCKED. Record lifecycle/results only in .planning/WORK.md; artifacts are measurements, not an additional task-state owner. Docs/plans contain design/checklists only.

No dependencies, blanket route rewrite, RTK/query migration, permanent diagnostic service, production data fixtures, backend/schema changes, deployments, force Git or automatic commits are in scope. Styles remain solely in frontend/src/styles/index.css; preserve incumbent Quiet Operational design, D6>=12px/D7/T7/T8/M1.2/N6. Prefer removal of duplicate render paths over new abstractions.
