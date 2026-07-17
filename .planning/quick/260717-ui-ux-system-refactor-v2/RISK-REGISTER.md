# Risk Register — UI/UX Refactor v2

| ID | Risk | Impact | Trigger | Mitigation | Gate |
|---|---|---:|---|---|---|
| R1 | Dirty user work is mixed into UI commit | Critical | File differs before task | Separate worktree/stash only with verification; stage allowlist only | Before every commit |
| R2 | CRITICAL shared table primitive breaks routes | Critical | GitNexus >15 symbols/processes | Add canonical replacement beside old primitive; migrate pilots; defer deletion | Wave 2 |
| R3 | Local pagination hides server data | High | UI page changes but query payload does not match contract | Explicit controller type and tests for totals/query invariants | Wave 2 |
| R4 | Cursor UI shows numeric/local semantics | High | Cursor endpoint has generic pager | Dedicated cursor copy and stack behavior | Wave 2/3 |
| R5 | Visual fix changes business mutation | High | Action handlers moved or payload changed | Preserve handlers and API hooks; mutation regression tests | Every route |
| R6 | Auth/backend unavailable makes smoke fail | High | Login stays at `/login` | Classify fixture vs environment; run backend/auth preflight; never mask with selector relaxations | Wave 0/4 |
| R7 | Global style dirty blocks trustworthy visual audit | High | `index.css` modified before task | Freeze global style until baseline; use scoped canonical tokens for new work | Wave 0/1 |
| R8 | Duplicate compatibility layers survive indefinitely | Medium | New consumer uses old adapter after migration | Deprecation comments, consumer inventory and cleanup deadline | Wave 5 |
| R9 | Snapshot updates hide regressions | Medium | Snapshot changed without issue record | Require before/after reason, viewport list and UI audit evidence | Wave 4 |
| R10 | Copy refactor removes traceability | Medium | Code identifiers disappear from operational UI | Keep code + semantic label pair where audit/support needs it | Wave 1/3 |
| R11 | Shared HIGH component migration breaks multiple role workflows | High | GitNexus reports 4–6 direct callers | Change only controller/viewport implementation; preserve props/DOM actions; run unit/lint/build/UI audit; commit per component | Wave 3 |
| R12 | Dirty AdminDataPage blocks compatibility cleanup | High | Existing 613-line user-owned diff overlaps six legacy tables | Freeze file; reconcile ownership and diff before migration; do not remove compatibility export while it remains a consumer | Wave 3/5 |
| R13 | Legacy adapter diverges from canonical viewport | Medium | Compatibility wrapper owns separate DOM/CSS behavior | Delegate adapter to `TableViewport`; retain only public prop/class compatibility until final consumer migration | Wave 3/5 |
| R14 | Semantic copy changes confuse exports or operational traceability | Medium | UI label is reused as backend enum/value | Change labels only; retain enum/value fields and technical codes in exported data | Wave 1/3 |
| R15 | Shared copy change affects multiple role workflows | Medium | Shared component has HIGH upstream callers | Keep vocabulary-only change, preserve DOM/action contracts, run shared UI audit and route regression gates | Wave 1/3 |
| R16 | Pagination mode contract is weakened by optional fields | High | A cursor consumer receives numeric total semantics or local consumer mutates query | Use discriminated union factories; keep local math pure; preserve legacy hook only as compatibility API | Wave 2/3 |
| R17 | Critical table shell migration changes interactive checklist behavior | Medium | Component has checkbox/action handlers inside shell | Migrate only wrapper, add caption, preserve row keys/handlers/disabled rules, run component and UI audit gates | Wave 3 |
| R18 | Expandable Chef table loses accessible relationship during viewport migration | Medium | Expanded content has button-controlled region | Preserve `aria-controls`, `aria-expanded`, row keys and nested region label; add viewport caption only | Wave 3 |
| R19 | Chef production action becomes detached from table surface | Medium | Daily plan table shares section-level send action | Change viewport wrapper only; preserve section badge action, row readiness mapping and route-level action callback | Wave 3 |
| R20 | Dashboard lane vocabulary obscures existing action semantics | Medium | Shared lane table uses technical short labels | Centralize semantic labels only; preserve lane IDs, active state and action renderer contract | Wave 1/3 |
