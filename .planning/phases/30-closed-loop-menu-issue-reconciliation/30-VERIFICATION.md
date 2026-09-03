# Phase 30 Verification: Reopened Mode-Level E2E Gap

**Verified code HEAD:** `6bfbd9f96046b28a200056916b3d2a1b7afe3a8d`

**Preceding state-closeout HEAD:** `e7187df5870956bdba12e36cc1af4f88a07d6ac6` (docs-only descendant of the verified code HEAD)

**Canonical closeout-artifact HEAD:** `0efb8012f4979ee17e61fa11e717b6bdde1c753d` (docs-only descendant that committed this verification record and the canonical closeout summaries)

**Local deterministic contracts:** **PASS**

**Warehouse issue seam:** **PASS — issue/stock/lineage/idempotency and `TRANSFERRED → IN_PROGRESS` proven**

**Aggregate Material Reconciliation mode E2E:** **GAPS_FOUND — production source/preview/freeze surfaces now run, but the corrected headed multi-line lifecycle has not yet completed Warehouse → reconciliation → completion/resume**

## Scope and authority

This verification closes deterministic source-family contracts and the Warehouse issue seam. Production implementations now also close the previously missing quantity preview/commit, explicit `DRAFT → READY`, reconciliation-mode Weekly Menu source editing/readiness, and batch-scoped source-change surfaces at focused-test/build level. Complete mode-level E2E remains reopened under `.artifacts/audits/material-reconciliation-mode-e2e-research.md` until the new disposable headed harness completes every downstream stage. Kỳ subsequently granted explicit MRX-06P authorization on 01/09/2026 for protected backup, migration, mutation E2E, five-viewport headed browser evidence and final restoration to `DEFAULT`, with fail-closed handling and no reset/seed/cleanup to rescue a test.

The authorized attempt ran on merge HEAD `577dc926`. Read-only preflight confirmed `ipc_lane7` at migration 75 and `DEFAULT / 5`; a fresh database checkpoint was created and verified. The migration defect was reproduced, fixed with metadata-driven FK discovery, regression-tested, and proven against a disposable restore of that exact checkpoint before protected application. Protected `ipc_lane7` is now at migration 76. A fresh 55-line public-API source reached `TRANSFERRED / version 3`; stable concurrent import/create identity, forbidden coordinator issue (`403`), zero-stock issue/replay rejection (`400`), DB zero lineage effect, and final `DEFAULT / 7` restoration were recorded. The actual source ingredients have no positive operational current stock, so no seed/direct repair was used.

On 02/09/2026, a fresh backup-first protected resume at HEAD `c5c91b35` reconfirmed migration 76, the retained `TRANSFERRED / version 3` batch with 55 lines, and zero positive operational stock across `currentstock`. The populated reconciliation detail dialog then passed headed Chrome at exactly `1920×1080`, `1440×900`, `1366×768`, `1365×900`, and `1280×900`: 55 rows rendered, initial focus remained inside the dialog on `Đóng`, dialog and focused control were viewport-contained, Escape closed it, trigger focus was restored, and there were zero console/page/request failures or page horizontal overflow. The browser ledger contained GET/HEAD only; no issue/reconciliation mutation was attempted. Final protected mode was restored to `DEFAULT / 17`. Evidence: `.artifacts/shipyard-live/phase30-mrx06p-resume-20260902-184502/browser/populated-focus-evidence.json`. Historical workbook status remains **MISSING / NOT RECOVERED**.

## Plan and commit matrix

| Plan | Local verdict | Exact implementation / certification commits |
|---|---|---|
| 30-08 | PASS | `fda7aa9e`, `8099bf54` |
| 30-09 | PASS | `cf4bb0d9`, `dba27223`, `7f9c6b0b`, `61208edd`, `30080c44`, `f2748c4d`, `e553eabe`, `24707ca6`, `63ad189b`, `002a8872`, `566d7132`, `b4e0ad35`, `ce339ba9`, `ceac9a07`, `aa891806` |
| 30-10 | PASS | `6630fdbf`, `e1f31895`, `183fa0b9`, `a0e82c36`, `24389060`, `b6ef8a53` |
| 30-11 | PASS | `a9e58aa0`, `be7ccac0`, `79e538d1`, `ddbc129c`, `c2475fbb`, `eea626a5` |
| 30-12 | PASS | `ba7ec4c9` |
| 30-13 | PASS | `ddbacfbb`, `c01c0c82`, `7b774591`, `26c529b9`, `4cfb0497` |
| Phase-level local remediation | PASS | `cf81c313`, `2af9006a`, `2e6a60ce`, `e003b12f`, `6260463e`, `4300fa95`, `bf3fe8e6`, `d24591f3`, `995fbafc`, `8e4e1f71`, `346b866f`, `82297726`, `3cef3e0a`, `c80a6354`, `4bd806dc`, `8015cd1d`, `f092dc81`, `6bfbd9f9` |

The failed aggregate and route-legitimacy attempts preceding this final range remain preserved in runtime reports. They are historical failed attempts, not PASS evidence and not erased by the final certification.

## Final local gate matrix

| Gate | Verdict | Exact result |
|---|---|---|
| Canonical frontend unit command | PASS | 203 files / 1,276 tests / exit 0 |
| Frontend production build | PASS | 2,309 modules |
| Critical eager-route ownership | PASS | 7/7; required initial owners are eager and only inactive/user-opened owners remain dynamic |
| Route gzip budgets | PASS | 10/10 under unchanged checker and thresholds; Warehouse 262,031 B / 263,168 B |
| Frontend lint | PASS | Exit 0 |
| Front-End Checklist integration | PASS | Exit 0 |
| Architecture tests / strict growth | PASS | 6/6; accepted production baseline retained, zero test debt |
| dependency-cruiser | PASS | 485 modules / 1,840 dependencies / 0 violations |
| Workflow API boundary | PASS | Zero forbidden runtime/type imports |
| API generation/parity | PASS | Generated OpenAPI/schema unchanged |
| TS request fixture generation/parity | PASS | Deterministic tracked fixture remained byte-clean |
| C# request fixture consumer | PASS | 2/2 |
| EF pending-model check | PASS | No pending model changes |
| Backend build | PASS | 0 warnings / 0 errors in normal Debug build |
| Backend Application tests | PASS | 49/49 |
| Backend API tests | PASS | 1,196 passed / 1 intentional environment-dependent skip |
| Whitespace hygiene | PASS | `git diff --check` exit 0 |
| Secret/stub/debt scan | PASS | No closeout secret, credential, TODO/FIXME/placeholder implementation, or protected target introduced |

The known skipped backend integration test is `WorkflowLifecycleE2ETests.Auth_Menu_Demand_Issue_Report_Lifecycle_Should_Run_EndToEnd`; it is reported rather than counted as executed.

## Requirement disposition

| Requirement | Status | Basis |
|---|---|---|
| MRX-01..05 | Locally implemented/evidenced | Plans 30-01..13 and final local gate remediation; aggregate protected proof still pending |
| MRX-06L | **COMPLETE** | Canonical local gate matrix above at exact HEAD `6bfbd9f9` |
| MRX-06P | **PARTIAL / REOPENED** | Disposable evidence proves only the issue/completion seam. It bypasses menu import, dish/BOM/serving corrections, quantity preview/commit, contributor materialization, ready/freeze and batch-scoped change history. |
| MRX-06 | **GAPS_FOUND** | Full mode E2E must follow the corrected lifecycle and sufficient-stock isolated fixture; protected stock availability is not the intended test prerequisite. |

## Protected checkpoint matrix

| Protected item | Status |
|---|---|
| Fresh operator authorization | GRANTED 01/09/2026 for the bounded MRX-06P run |
| Canonical local `ipcmanagement` migration | APPLIED after retained backup |
| Protected checkpoint | CREATED and archive/manifest verified before migration |
| `ipc_lane7` authorized attempt | READ-ONLY PREFLIGHT + BACKUP + FAILED FIRST MIGRATION STATEMENT; zero lineage schema effect |
| Phase 30 migration on `ipc_lane7` | APPLIED — migration 76 after disposable-checkpoint proof; metadata-driven FK compatibility regression passes |
| Full menu-source → freeze → issue → comparison/change-log run | GAPS_FOUND — protected and disposable attempts did not execute the complete intended lifecycle; corrected sufficient-stock isolated E2E remains required |
| Five-viewports protected browser matrix | PASS — populated 55-line detail dialog at the five canonical desktop viewports |
| Populated reconciliation dialog focus | PASS — initial focus, containment, Escape, and trigger-focus restoration verified |
| Final protected operation mode restoration/new test | PASS — restored to `DEFAULT / 17` |
| Historical workbook | MISSING / NOT RECOVERED |

## Evidence policy

The canonical final verifier reports are `.artifacts/runtime/phase30-final-route-legitimacy.close-final-route-legitimacy.md` and `.artifacts/runtime/phase30-final-route-legitimacy.verify-final-route-legitimacy.md`. Runtime artifacts are intentionally not hashed or added to `docs/EVIDENCE-INDEX.md`: the index policy reserves hashes for selected canonical evidence, while current gate truth belongs in `MEMORY.md` and this verification record.

## Final verdict

Phase 30 deterministic local code work is closed at `6bfbd9f9`; the preceding state closeout is committed at `e7187df5`, and the canonical closeout artifacts are committed at docs-only descendant `0efb8012f4979ee17e61fa11e717b6bdde1c753d`. Protected `ipc_lane7` is at migration 76, and the backup-first resume at HEAD `c5c91b35` closed the populated five-viewport dialog focus gap before restoring operation mode to `DEFAULT / 17`. Aggregate MRX-06 mode-level acceptance is reopened. The one-line disposable run remains valid only as issue-state regression evidence and cannot close the full lifecycle. A legitimate protected receipt now provides `0.000800 kg` Cá hố, but it does not belong to the retained batch. On disposable `ipc_mrx06p_e2e`, an explicitly synthetic one-line batch fixture reused that official receipt stock and exposed a real production defect: issue creation persisted lineage but left the batch `TRANSFERRED`, making completion unreachable. The fixed owner now advances the batch atomically to `IN_PROGRESS / version + 1`; issue replay is idempotent and completion/reload remain `COMPLETED/MATCHED`. This technical PASS must not be represented as protected retained-batch evidence.
