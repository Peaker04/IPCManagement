# MRX loading and render continuity

User authorizes spec, plan and native implementation of the five shared-flash audit findings, including actual callers with the same cause. WORK owns execution state. Existing design system and Operate mode remain authoritative.

## Decisions

Fix shared presentation owners rather than individual divider colors. Keep geometry from the first frame; defer only decorative skeleton marks for 150ms. Do not delay settled data, hide errors, extend tests or qualify operational gates by waiting longer. No forced minimum skeleton hold: a slow cold read can replace its placeholder immediately when ready. This removes the demonstrated 40/80ms fast-load flash, without claiming that no visible loading transition can ever occur at every possible latency.

Remove the top 2px progress strokes from StateBoundary and report tables. Preserve immediate aria-busy, screen-reader status and inert stale-row guards. Manual-refresh/mutation buttons keep their existing pending behavior. Do not dim the whole table. Header and table dividers keep their normal color throughout transitions.

WorkbenchSkeleton remains the single structural placeholder owner: it reserves header/row/pane geometry immediately, but all placeholder decoration (marks, header background/border, toolbar/pane and metric-card outlines) remains invisible before the delay. Otherwise a fast empty result can still flash a ghost table-header divider even with invisible text marks. The same policy covers direct audit/LocalizedBoundary use and existing custom skeletons in Dashboard, Warehouse and Chef. Reuse its real geometry; no generic blank full-page placeholder or second skeleton primitive.

HistoricalScopeFilter keeps the same controls/form nodes after applying a selection. Synchronize draft values when URL scope changes, including browser back/forward, without a keyed remount. Preserve validation, whole-range application and focus.

AppShell's unresolved-route fallback must contain a canonical route title and matching workspace geometry. Reuse RouteWorkbenchLoadingFallback and the route registry, without rendering enabled fake business controls. MRX primary pages are eagerly imported today; the lazy-shell defect is a shared-shell gap, not evidence that every MRX navigation suspends. Keep auth/role checks before protected content and preserve dirty navigation.

## Acceptance and verification

- With 40/80ms cold completion, no decorative skeleton marks become painted. Structural loading rows/header exist immediately. With a sustained read, marks become visible only after 150ms; settled data replaces them immediately, including empty/error.
- On 80/180/240ms scope switches the table remains at full opacity and no top progress stroke is painted. Previous-scope rows remain inert until exact data returns.
- Applying 2023/2024 and URL history changes retain form/input identity and focus, while request boundaries remain correct.
- Controlled lazy shell has a visible canonical title during module wait; no status-only blank canvas. Do not show unauthorized business data or actions in the fallback.
- Owner tests must fail before repair. Browser proof measures computed paint state per animation frame, not mere skeleton-container presence; existing table/header/scroll/error/permissions contracts remain.
- Run FE build/lint, contract/architecture gates, affected and full unit tests, then bounded Chrome fixture checks at representative widths with every business API intercepted. Production/authenticated MySQL and physical GPU behavior remain separately qualified.

No source DB writes, main restart, campaign/endurance/clone, dependency installation, subagents, external AI CLI or git mutation. Preserve OPERATIONAL_QUALIFICATION_BLOCKED.

## Approved caller sweep continuation

Remaining modal reads: the first import-source read and BOM-editor cold read follow the shared deferred decorative-paint policy too. Price-tier reads reserve their control height without inserting transient visible loading paragraphs. BOM-editor frame geometry remains stable across loading/ready/empty results, following the existing frozen-dishes modal pattern. Dish selection and identifier copying must be independent keyboard-operable controls, never nested buttons. Existing edit guards, error/retry, dirty-draft and copy behavior remain available.

Cross-scope safety refinement: retain blocker geometry/tone while a different customer or batch resolves, but suppress the previous batch's completion/blocking conclusion. A pending day read within the same batch may retain that batch's conclusion. Pending actions stay disabled in both cases. Initial unresolved scope must never manufacture a business status.

Preserve the resolved blocker-strip tone/action footprint during a pending read, retaining same-batch text only as described above; disable its actions and announce pending state without replacing the strip. An initial unresolved scope uses a neutral reserved slot rather than claiming a business status. Frozen-dishes modal cold loading uses the shared split placeholder and timing policy. Import history retains its real headers, reserves row geometry and defers placeholder row paint. A second import-source read keeps the prior read-only source table until replacement, with explicit previous-source attribution and busy status. A denied/missing/error response must resolve to its true error/empty state, never masquerade as a successful old source. Clear retained source on customer/history scope exit as before. Add exact deferred-response regressions, with no new mutations or business rules.
