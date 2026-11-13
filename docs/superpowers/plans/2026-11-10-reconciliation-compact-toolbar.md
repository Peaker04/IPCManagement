# Reconciliation compact filter row

Approved design: operator approved in-chat wireframe. Readiness/status-action banner stands alone. Weekdays and four status filters share one nonwrapping row. Search icon replaces only the weekday region with existing input/clear and a close action. Closing retains query, selected day, status filter, and visible results; closed active search has explicit accessible indication. Opening focuses input; closing returns focus to trigger. Preserve empty-day navigation, status counts, permissions and bulk disposition across all day lines (not search subset). Narrow rows scroll horizontally rather than wrap. No API/backend changes/dependencies.

## Implementation plan
**Goal:** avoid dynamic readiness messages competing with weekday navigation while retaining compact table viewport.
**Architecture:** existing page creates date controls; existing LinesBranch passes them into existing filter toolbar as ReactNode. Page displays dates alone when empty/error boundary replaces branch. No new primitives.
**Stack:** React/TypeScript, existing Button/Input/lucide, canonical CSS.

1. [x] Extend existing HTTP-backed Reconciliation review search owner: opening/closing, retained query/day, explicit active-search indication, focus, clear/no network reads. Run RED before production changes.
2. [x] Remove obsolete context-row CSS/wrapper. Pass day navigation from Page through LinesBranch into toolbar. Keep empty-day fallback outside StateBoundary. Toolbar owns presentation-only open state/ref; branch retains search/filter/bulk behavior. Add single-row CSS using existing tokens.
3. [x] Run full FE unit suite (includes contract gates), lint/build/diff check; source-review empty/error/denial/loading/partial/readonly and real caller. Record evidence in WORK/IDLE. Browser geometry remains NEEDS_EVIDENCE without browser tooling. No commits, installs, delegation, DB or process changes.
