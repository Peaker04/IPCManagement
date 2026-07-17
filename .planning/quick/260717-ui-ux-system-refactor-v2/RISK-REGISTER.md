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
