---
phase: 16-persistence-and-reliability
plan: "01"
status: complete
completed: 2026-07-28
one-liner: Feature-owned mappings, resilient transactions, mapped business exceptions, canonical lineage and recoverability evidence now close Step 16 without resetting preserved data.
requirements-completed:
  - ARCH-16A
  - ARCH-16B
  - ARCH-16C
  - ARCH-16D
  - ARCH-16E
key-files:
  - backend/src/IPCManagement.Api/Data/Transactions/EfTransactionRunner.cs
  - backend/src/IPCManagement.Api/DependencyInjection.cs
  - backend/tests/IPCManagement.Application.Tests/PersistenceReliabilityConventionTests.cs
  - docs/DATABASE-RECOVERY-REHEARSAL-2026-07-28.md
key-decisions:
  - "Transactions: all manual transactions are owned by EfTransactionRunner and each mutable operation supplies a stable database verifier"
  - "Retry: EnableRetryOnFailure is safe only while convention coverage proves the runner is the sole transaction opener"
  - "Recovery: cross-volume mirror and disposable restore evidence close the code/rehearsal scope, while genuine physical off-site storage remains an operational gap"
---

# Phase 16 Summary

Step 16 completed all five work packages. Fifty-three EF mappings now live in feature-owned
`IEntityTypeConfiguration<T>` files; `IpcManagementContext` is a thin registration root. Business failures
use mapped domain/application exceptions. Canonical fresh/upgrade migration lineage and disposable restore
evidence are documented without rewriting applied migrations or mutating `ipc_lane1`.

`IEfTransactionRunner` owns every manual transaction through the provider execution strategy, clears tracking
before retry/commit verification and requires stable database verification. Commit `59add79` retired the unused
UnitOfWork transaction API, enabled `EnableRetryOnFailure` and added a convention test that locks production
source to exactly one `BeginTransactionAsync(` inside the runner.

Final gates: API 667 pass/1 skip, Application 49/49, frontend 416/416, Debug/Release 0 warnings/errors,
lint clean, no new dependency violations, production build pass, deterministic OpenAPI/TypeScript and no EF
pending model changes. No reset, seed or import was run; browser was not required because public API, route,
cache, UI and DOM behavior did not change.

The remaining non-blocking operational concern is a genuinely off-site production backup destination.
Matching C:/D: mirror hashes prove copy integrity, not separate physical media or site independence.
