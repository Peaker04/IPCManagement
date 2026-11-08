# MRX cold-entry layout stabilization — approved design

Owner approval: “Duyệt xử lý” following the nested-layout audit. Keep the current visual world and nested AppShell/Sidebar/Outlet; native inline execution, no approval loop or delegation.

## Problem / evidence
The production intercepted audit retained the same sidebar DOM node and main/header anchors. Cold completed-register layout-shift sum was ~0.00835 versus 0 warm. LocalizedBoundary inserts an inset generic skeleton; delayed Inter adds a much smaller ~0.000114 shift. AuthProvider can initially expose stored/DEFAULT mode before the server snapshot, allowing a wrong mode-dependent branch to mount.

## Design
- AuthProvider owns explicit authoritative mode readiness/error. ProtectedRoute does not mount its Outlet until authenticated mode bootstrap succeeds. Pending uses existing bootstrap presentation; failure is honest and manually retryable. Public login and logout remain reachable. Do not change permissions, default mode, server checks or bypass errors using stored data.
- LocalizedBoundary reuses WorkbenchSkeleton with optional declared geometry instead of a second inset skeleton implementation. Report callers declare actual column layout. Shared loading accessibility and persistent page headers remain intact. Fresh-load geometry must not change padding after a timer.
- Declare MRX source/daily/cooking loading geometry at their existing owners; use the existing customSkeleton slot for the dashboard's KPI/pipeline/queue composition, without fake business values. Reserve Chef's existing badge anchor before data arrives.
- Preload only the installed Inter normal Latin/Vietnamese subsets if the production build resolves them correctly. Do not invent fallback font metrics, block all rendering on fonts, change typography, or claim zero CLS under arbitrary network delays.

## Scope / limits
FR-AUTH, FR-MENU, FR-WH, FR-CHEF, FR-RECON, FR-DASH; DOM-MODE-1, DESIGN C1–C6/NFR-UI-05/4-tier feedback and existing N6. No route code splitting, KeepAlive, new cache/framework/dependency, sidebar redesign, backend/DB operations, credential access, commit or process replacement. Preserve previous repairs and inherited dirty work.

## Owner-approved residual completion
The owner subsequently requested thorough completion. Replace the font import with canonical index.css @font-face declarations pointing to the exact same seven installed subsets/ranges and weight100–900, using native font-display:optional. This intentionally keeps fallback typography for a slow first visit rather than doing a late swap; no JS font wait or copied assets/build plugin.

Dashboard loading must distinguish the backend report-role visibility shapes (decision4 / source-or-warehouse1 / other0). This is placeholder geometry only, never authority for actual metrics or commands. Keep the actual static, permission-filtered pipeline mounted across loading/ready. Reserve the existing potential next-action slot and render unknown batch total through the same Num as known values (“—” while unknown) so asynchronous facts do not introduce a new header/telemetry row or line-box shift. Reserve KPI structure immediately and inner scrollbar width at the Dashboard owner; no new loading/cache engine.

The rendered390px check additionally exposed the responsive shared header's title/context flex groups squeezing a customer select to45.6px. Full mobile flex basis at those existing groups makes labels readable without a new header/prop or page-specific DOM selectors. Desktop and fixed/nonresponsive header behavior remain unchanged; shared callers inspected, no shell redesign or unrelated visual polishing.

## Acceptance
- A stale DEFAULT snapshot cannot mount mode-dependent route content while authoritative MRX is pending; failed bootstrap remains blocked and retry recovers.
- Existing auth/login/logout/RBAC, loading/error/empty and same-scope cached content contracts remain valid.
- Cold MRX loading uses declared work-object geometry; no new business rows/numbers in placeholders. Production probe preserves sidebar identity/main anchor; compare cold/warm and report residual font shift honestly.
- Focused tests RED→GREEN, adjacent state contracts, scoped lint/build and isolated intercepted production browser verification. No full-project or real-DB certification.
