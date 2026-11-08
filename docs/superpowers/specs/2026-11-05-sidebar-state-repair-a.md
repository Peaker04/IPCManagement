# Sidebar and page-state repair A — design

Owner selected A after the read-only audit: repair demonstrated defects at existing owners, preserve sidebar/design, add focused regressions, then identify remaining state evidence gaps. Existing native execution approval applies; no delegation, installation, DB access, worktree creation or commits.

## Behavior
- Explicit report URL view wins over remembered metadata. Metadata alone is not loaded data.
- A failed initial query settles into error with manual retry; rerenders do not restart it. Pending requests deduplicate and late results cannot repopulate a cleared session.
- Page changes retain previous data only inside the same user/mode/view/filter scope; new scopes never borrow previous rows. Pending rows are noninteractive and do not become empty prematurely.
- MRX reports respect cache expiry/invalidation without refreshing timestamps on cache hits.
- BOM and customer drafts use the existing Modal/dirty-navigation confirmation, including footer, Escape and backdrop. Confirmed discard clears the draft; successful writes retain their existing transport semantics.
- Logout and 401 share the existing teardown operations, including both query caches. No authority or backend changes.
- BOM coverage uses existing workbench hydration/SWR, preserving rows during refresh and showing errors honestly. No new cache engine or styling.

## Limits
DEFAULT/MRX, actor identity, RBAC, immutable historical evidence, quantities and frozen lineage remain unchanged. Verification uses existing DTO-shaped fixtures and isolated intercepted Chrome; no live persistence, global state certification or performance SLO claim.
