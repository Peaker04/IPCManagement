# Native shared loading repair plan

Spec: `docs/superpowers/specs/2026-11-13-mrx-shared-loading-policy.md`. User has authorized execution and asks to avoid another isolated caller-patch cycle. Execute inline, preserve inherited dirty tree, no new worktree/commit/DB/process-main operations.

1. Map MRX and SHARED route leaves from routeRegistry to real query/boundary/modal callers. Classify decorative read feedback separately from business/error/mutation feedback. Record exact exclusions and evidence limits in the spec map.
2. Reproduce at owners. Add hook regression for visible→ready→loading without advancing timers; add StateBoundary regression using an unmarked custom placeholder. Run focused tests before product repair and retain the failing log.
3. Fix the shared lifecycle. useDeferredSkeleton owns the default threshold and resets default-policy state before paint. StateBoundary wraps whole custom/widget decoration in its existing visibility gate, preserving size and accessible status. WorkbenchSkeleton and standalone import-history decoration consume the same default. Remove now-redundant custom-caller tags in Dashboard/Chef/Warehouse.
4. Align the remaining direct read-status callers found by the complete inventory: source telemetry and BOM batch import. Keep them sr-only inside reserved structures; preserve disabled actions/error/retry. Do not introduce new loading wrappers or regex exemption lists.
5. Verify once broadly: focused RED/GREEN, full canonical FE suite, build/lint, strict architecture, conformance, diff checks and Impeccable. Extend existing headed Chrome tests for computed unmarked-subtree visibility and repeated read timing at960/1920. Keep API interception path-scoped; do not hit a DB. If the shared change exposes a real layout defect, fix the owner and perform one bounded confirmation round.
6. Stop only the owned temporary Vite process, document actual counts/limitations and close in WORK. Keep OPERATIONAL_QUALIFICATION_BLOCKED.
