# Active work

Status: IDLE

## Phase 1 Closed Task: Foundation & Design Tokens
1. Clean Workspace: Removed untracked `frontend.zip` at root, verified pristine git status.
2. F9 Warning Token Convergence: Unified `--ipc-warning: #b45309` (Amber-700), `--ipc-warning-soft: #fffbeb`, border `#fde68a`, foreground `#b45309` across `index.css` and `shell.css`.
3. F2 Table Density Name Drift Resolution: Synchronized `--table-row-height-compact: 40px`, `--table-row-height-standard: 48px`, `--table-row-height-comfortable: 56px`, and alias `--table-row-height-relaxed: var(--table-row-height-comfortable)` across `index.css` and `tables.css`.
4. S4 Z-Index Scale: Formalized layer scale tokens `--z-drawer: 40`, `--z-dialog: 50`, `--z-popover: 60`, `--z-toast: 100`, `--z-tooltip: 110`.
5. D6 Vietnamese Typography: Eliminated uppercase text-transform clipping on Vietnamese text in `ProductionPlanSection.tsx`; `src/vietnameseTypography.test.ts` passes 100% (8/8 tests).
6. NEW-6 Component Primitive Governance: Completely eliminated `.ipc-status-pill` in `.tsx` files (`MainLayout.tsx` migrated to `<StatusBadge>`). Preserved legacy CSS `.ipc-button` rules as a backward-compatibility bridge for older pages while routing new work to `<Button>`.
7. Phase 1 Verification Gates:
   - `node --test scripts/check-ignore-policy.test.mjs`: PASS (2/2 tests)
   - `node --test scripts/check-architecture-growth.test.mjs`: PASS (6/6 tests)
   - Vitest contract suites (`colorBridge.test.ts` & `vietnameseTypography.test.ts`): PASS (8/8 tests)
   - `npm run lint:fe`: PASS (0 errors, 1 warning)
   - `npm run build:fe`: PASS (Vite production client built cleanly)

## Next Phase: Phase 2 — AppShell & Unified Workspace Container
- Clean up `MainLayout.tsx`: standardize 248px sidebar, 48px header, breadcrumbs, zero double-headers across all remaining routes.
- Align page-level `OperationalFrame` and commands across remaining features.
