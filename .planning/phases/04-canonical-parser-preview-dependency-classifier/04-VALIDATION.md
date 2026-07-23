---
phase: 4
slug: canonical-parser-preview-dependency-classifier
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-16
---

# Phase 4 — Validation Strategy

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | xUnit + FluentAssertions + ASP.NET Core controller/service integration fixtures |
| **Config file** | `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj` |
| **Quick run command** | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~PresetBomWorkbook|FullyQualifiedName~CanonicalBomDiff|FullyQualifiedName~BomLegacyCleanupClassifier|FullyQualifiedName~BomDependencyEvidence|FullyQualifiedName~BomReconciliationPreview|FullyQualifiedName~BomCanonicalPreviewApi"` |
| **Full suite command** | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore` |
| **Estimated runtime** | Measure in Wave 0; no watch mode |

## Sampling Rate

- After every task commit: focused parser/preview/classifier/security tests.
- After every wave: full backend suite.
- Before verify-work: full suite plus relational preview-purity checksum proof.
- Max focused feedback latency: 120 seconds.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|---|---|
| 04-01-01 | 04-01 | 1 | CAN-02, SEC-02, SEC-03 | T-04-01/02/03 | Phase 3 Gate A plus Phase 4 manifest/owned-path allowlist must pass before source edits | gate | Gate A + Phase 4 ownership + `detect_changes` command in plan | ✅ existing/planned Phase 3 evidence; Phase 4 artifacts created by task | ⬜ pending |
| 04-01-02 | 04-01 | 1 | SEC-02, SEC-03 | T-04-01/02 | Exact twelve security ceilings, linked 30-second cancellation, max+1 and no path leak | unit/security | `FullyQualifiedName~PresetBomWorkbookSecurityTests` | ❌ plan creates | ⬜ pending |
| 04-01-03 | 04-01 | 1 | CAN-02, SEC-03 | T-04-02/03 | Pure deterministic parser and physical source trace | unit | `FullyQualifiedName~PresetBomWorkbookParserTests` | ❌ plan creates | ⬜ pending |
| 04-02-01 | 04-02 | 2 | CAN-02, DATA-01 | T-04-04/05 | Separate canonical Unchanged/Create/Version scope diff and six-action legacy policy; unknown/incomplete/stock/history blocks | unit | `FullyQualifiedName~CanonicalBomDiffClassifierTests|FullyQualifiedName~BomLegacyCleanupClassifierTests` | ❌ plan creates | ⬜ pending |
| 04-02-02 | 04-02 | 2 | DATA-01, SAFE-01 | T-04-03/05 | Full-scope AsNoTracking dependency evidence with unchanged checksums | relational | `FullyQualifiedName~BomDependencyEvidenceReaderTests` | ❌ plan creates | ⬜ pending |
| 04-03-01 | 04-03 | 3 | SAFE-01, SAFE-02 | T-04-03/04 | Separate canonical/legacy dataset-wide counts, purity, manifest binding, TTL and every drift dimension | relational/integration | `FullyQualifiedName~BomReconciliationPreviewTests|FullyQualifiedName~CanonicalBomDiffClassifierTests` | ❌ plan creates | ⬜ pending |
| 04-03-02 | 04-03 | 3 | SEC-01, SEC-02, SEC-03 | T-04-01/02 | Admin-only hosted matrix; 26214401 bytes returns pre-parser 413; no destructive route/path leak | hosted API/security | `FullyQualifiedName~BomCanonicalPreviewApiTests` with required MySQL config | ❌ plan creates | ⬜ pending |
| 04-03-03 | 04-03 | 3 | CAN-02, SAFE-01, SAFE-02, DATA-01, SEC-01, SEC-02, SEC-03 | T-04-01..05 | Gate B requires all evidence, no silent skips and expected ownership/flows | gate/full suite | `scripts/Test-BomPreviewGate.ps1` + full backend suite/build | ❌ plan creates | ⬜ pending |

## Wave 0 Requirements

- [ ] Plan 04-01 creates the versioned exact `BomWorkbookSecurityLimits`, Phase 4 ownership allowlist, canonical parser and malformed/abusive/max+1 workbook fixtures before parser/API behavior is accepted.
- [ ] Plan 04-02 creates a separate canonical scope diff model plus the exhaustive pure legacy classifier and mixed relational dependency fixture before preview composition.
- [ ] Plan 04-03 creates separate canonical/legacy count, separate-context purity/drift and hosted authorization/exact pre-model-binding limit fixtures before Gate B.
- [ ] Hosted MySQL configuration is mandatory for Gate B; absence is BLOCKED, never a passing skip.

## Manual-Only Verifications

All Phase 4 behaviors should have automated evidence; large-file resource ceilings may additionally be observed in a bounded test environment.

## Validation Sign-Off

- [x] All tasks have automated verification or explicit predecessor-gate dependencies.
- [x] No three consecutive tasks lack automated sampling.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` after stable task mapping.

**Approval:** pending plan-checker verification
