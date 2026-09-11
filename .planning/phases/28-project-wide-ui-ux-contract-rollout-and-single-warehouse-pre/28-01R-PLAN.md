---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 01R
type: execute
wave: 2
depends_on: [28-01]
files_modified:
  - .planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json
  - frontend/tests/uiAuditBaselineDelta.test.ts
  - frontend/tests/uiAuditRemediationAttribution.test.ts
  - frontend/src/features/auth/pages/LoginPage.feedback.test.tsx
autonomous: true
requirements: [PUX-01, PUX-02, PUX-05, PUX-06]
estimate: {tokens: 30000, raw_tokens: 30000, tasks: 3, confidence: low}
must_haves:
  truths:
    - "The lost manifest SHA-256 a0dcb1d2ea24a6ff562510d6f1dc1af3204480f1607e870ea2fa3214ac648c51 and canonical-combined SHA-256 b72c9a17e783c11ce49d6ec5e232afd5d6be5440abac95972fb6711c7ae05a5a remain preserved as historical expected hashes with status LOST_NO_BACKUP; no authority claims those bytes were restored."
    - "Tracked 28-01 plan and summary remain byte-exact at eef897ba23cb5be8ac3ee019c11acd9ebf9ce8ad3e1850f5f7b769cdc426200d and fd7e45d65c1b503c121d0cba14bfee597181f4c7edd235c3b2341fa233a9d342 with zero diff."
    - "A fresh immutable attempt under .artifacts/phase28-ui-audit/baseline-recovery/attempt-N is generated only from authenticated production-route read-only measurement/reconciliation; every observed request is GET or HEAD and any other method fails the attempt."
    - "The recovered result preserves the exact six-part identity set, all 32 rules, 2,142 identities, 68,544 findings, and disposition semantics; NEEDS_EVIDENCE remains honest and no result is manufactured as PASS."
    - "New artifact/member hashes and totals are pinned in tracked mutable 28-BASELINE-RECOVERY-AUTHORITY.json before 28-02 may consume findings."
    - "Commit a8a4a9dc remains an incomplete RED execution fact; recovery reconciles its obsolete lost-byte assumptions without declaring Task 1 or Plan 28-02 complete."
  artifacts:
    - {path: .planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json, provides: tracked fail-closed loss declaration and selected recovered-attempt pins}
    - {path: .artifacts/phase28-ui-audit/baseline-recovery/attempt-N, provides: immutable production-route read-only recovered evidence outside Playwright cleanup scope}
  key_links:
    - {from: immutable 28-01 authority, to: recovery authority, via: preserved old hashes plus explicit LOST_NO_BACKUP disposition}
    - {from: recovered attempt manifest, to: 28-BASELINE-RECOVERY-AUTHORITY.json, via: exact SHA-256 member pins and identity/rule/totals reconciliation}
    - {from: 28-BASELINE-RECOVERY-AUTHORITY.json, to: 28-02, via: selected-attempt hash gate before remediation resumes}
---

<objective>
Recover executable Phase 28 baseline authority after Playwright deleted the ignored sealed bytes, without rewriting history or claiming restoration.

Purpose: Establish the smallest additive fail-closed bridge from immutable 28-01 historical authority to a newly measured, hash-pinned baseline before any remediation implementation resumes.
Output: One tracked recovery authority, one immutable attempt-scoped read-only evidence root outside Playwright cleanup, and reconciled RED tests that remain incomplete until 28-02 executes.
</objective>

<execution_context>
@$HOME/.codex/gsd-core/workflows/execute-plan.md
@$HOME/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@MEMORY.md
@LESSONS.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-CONTEXT.md
@.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-SPEC.md
@.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-UI-SPEC.md
@.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01-PLAN.md
@.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01-SUMMARY.md
</context>

<tasks>

<task type="tracer" tdd="true">
<name>Task 1: Seal the evidence-loss declaration and safe-root preflight</name>
<read_first>.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01-PLAN.md, .planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01-SUMMARY.md, frontend/playwright.config.ts, frontend/tests/uiAuditBaselineReconciliation.ts, frontend/tests/uiAuditEvidence.ts</read_first>
<files>.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json, frontend/tests/uiAuditBaselineDelta.test.ts, frontend/tests/uiAuditRemediationAttribution.test.ts</files>
<behavior>
- Historical expected hashes are retained verbatim with status LOST_NO_BACKUP and deletion cause PLAYWRIGHT_CONFIGURED_OUTPUT_CLEANUP; restored=false and byteEqualityToLostArtifacts=false.
- The tracked 28-01 plan/summary hashes match and both paths have zero Git diff.
- Recovery root is canonicalized under repository `.artifacts/phase28-ui-audit/baseline-recovery/attempt-N`, is absent before atomic creation, and is neither equal to nor nested under Playwright configured outputDir/frontend/test-results.
- Existing root, symlink escape, path traversal, cleanup-scope overlap, or attempt reuse fails before browser launch.
</behavior>
<action>Create the tracked recovery-authority JSON schema and initial loss declaration. Record the two old artifact hashes only as historical expected values, user confirmation `no backup`, deletion cause, `restored: false`, and `status: LOST_NO_BACKUP`; retain the immutable 28-01 file pins. Add RED assertions that canonicalize the configured Playwright output path and proposed attempt root and prove disjointness in both directions before launch. The attempt root must be a new absent directory under `.artifacts/phase28-ui-audit/baseline-recovery`, created atomically and never cleaned, overwritten, reused, renamed into place from `frontend/test-results`, or treated as byte-equivalent to the lost baseline.</action>
<acceptance_criteria>The tracked declaration preserves historical truth, immutable 28-01 bytes pass, and unsafe/reused/cleanup-overlapping roots are rejected before Playwright runs.</acceptance_criteria>
<verify><automated>npm run test:unit -w frontend -- --run tests/uiAuditBaselineDelta.test.ts tests/uiAuditRemediationAttribution.test.ts --maxWorkers=1</automated></verify>
<done>Loss and safe-root authority are fail-closed without claiming restoration (PUX-02, PUX-05, PUX-06).</done>
</task>

<task type="auto">
<name>Task 2: Regenerate by production-route read-only measurement and reconcile exact scope</name>
<precondition>Read LESSONS.md; use the current authenticated production-route lane without reset, seed, restore, import, or business mutation.</precondition>
<read_first>LESSONS.md, MEMORY.md, frontend/tests/ui-audit.spec.ts, frontend/tests/uiAuditBaselineReconciliation.ts, frontend/tests/uiAuditEvidence.ts, .planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json</read_first>
<files>.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json</files>
<action>Launch headed Chrome only after the disjoint-root preflight, with both Playwright runner output and audit evidence directed to distinct children of the same new immutable attempt root outside `frontend/test-results`. Exercise only the explicitly authorized production-route baseline bridge and protected production-route cohort using authenticated read-only fixtures. Record every request method and abort on anything other than GET or HEAD, any mutation control activation, reset/seed/restore/import, runtime mismatch, missing provenance, or partial capture. Reconcile the output against immutable 28-01 authority for the exact six-part identity universe, 32-rule set, 2,142 identities, 68,544 findings, expected/reason/owner schema, and verdict vocabulary. Preserve `NEEDS_EVIDENCE` wherever production measurement is absent or unsafe; do not infer, coerce, copy, or broaden PASS from old totals or screenshots. Differences from historical verdict totals are allowed only as explicitly enumerated fresh-measurement deltas with production-route provenance; otherwise fail.</action>
<acceptance_criteria>One complete immutable attempt exists outside cleanup scope; all network methods are GET/HEAD; identity/rule/schema coverage is exact; every verdict is backed by fresh deterministic evidence or an honest non-PASS disposition.</acceptance_criteria>
<verify><automated>set -o pipefail &amp;&amp; ATTEMPT="${PHASE28_RECOVERY_ATTEMPT:?new attempt-N}" &amp;&amp; PARENT=".artifacts/phase28-ui-audit/baseline-recovery" &amp;&amp; mkdir -p "$PARENT" &amp;&amp; ROOT="$PARENT/$ATTEMPT" &amp;&amp; test ! -L "$PARENT" &amp;&amp; test ! -e "$ROOT" &amp;&amp; case "$(realpath "$PARENT")/" in "$(realpath frontend/test-results)/"*) exit 1;; esac &amp;&amp; mkdir "$ROOT" &amp;&amp; test ! -L "$ROOT" &amp;&amp; UI_AUDIT_OUTPUT_ROOT="../$ROOT/evidence" npm exec -w frontend -- playwright test tests/ui-audit.spec.ts --grep "Phase 28 (login production-route baseline bridge|protected production-route ready cohort)" --headed --workers=1 --output="../$ROOT/playwright" &amp;&amp; node frontend/tests/uiAuditBaselineReconciliation.ts --recovery-root "$ROOT/evidence" --historical-authority .planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01-SUMMARY.md --require-identities 2142 --require-rules 32 --require-findings 68544 --require-network-methods GET,HEAD --reject-pass-without-fresh-evidence</automated></verify>
<done>The new baseline is freshly measured and reconciled without mutation, restoration fiction, or manufactured PASS (PUX-01, PUX-02, PUX-06).</done>
</task>

<task type="auto" tdd="true">
<name>Task 3: Pin recovered hashes and reconcile the existing RED commit without completion</name>
<read_first>.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json, frontend/tests/uiAuditBaselineDelta.test.ts, frontend/tests/uiAuditRemediationAttribution.test.ts, frontend/src/features/auth/pages/LoginPage.feedback.test.tsx</read_first>
<files>.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json, frontend/tests/uiAuditBaselineDelta.test.ts, frontend/tests/uiAuditRemediationAttribution.test.ts, frontend/src/features/auth/pages/LoginPage.feedback.test.tsx</files>
<behavior>
- Recovery authority pins selected attempt path, manifest/canonical/member SHA-256 values, exact totals, GET/HEAD-only proof hash, schema/tool/runtime provenance, and immutable attempt status.
- Consumers reject missing authority, unpinned members, hash drift, root reuse, unsafe root, old lost-byte substitution, identity/rule drift, or evidence promotion.
- Commit a8a4a9dc is recorded as RED_RECONCILED_NOT_COMPLETE; no production implementation exists and no 28-02 summary is created.
</behavior>
<action>After the complete attempt validates, atomically finalize the tracked recovery authority with all new hashes and totals; commit the attempt path as immutable and forbid later mutation/reselection without a new additive recovery authority. Update the three tests introduced by `a8a4a9dc` so their baseline consumer resolves only the selected hash-pinned recovery authority while still asserting the historical lost hashes/status. Preserve their RED intent: baseline/attribution guards may become green, but Login production behavior remains failing until 28-02 implements it. Record `a8a4a9dc` as reconciled execution history, not task completion; do not create 28-02-SUMMARY.md, amend/squash the RED commit, or modify production code.</action>
<acceptance_criteria>Tracked authority pins all new bytes before downstream use; tampering fixtures fail; the Login behavior test remains RED for the unimplemented production correction; Plan 28-02 remains pending.</acceptance_criteria>
<verify><automated>npm run test:unit -w frontend -- --run tests/uiAuditBaselineDelta.test.ts tests/uiAuditRemediationAttribution.test.ts --maxWorkers=1 &amp;&amp; ! npm run test:unit -w frontend -- --run src/features/auth/pages/LoginPage.feedback.test.tsx --maxWorkers=1 &amp;&amp; test ! -e .planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-02-SUMMARY.md &amp;&amp; git diff --check</automated></verify>
<done>Recovered authority is pinned and consumable while the historical RED task remains honestly incomplete.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|---|---|
| Lost ignored bytes → tracked history | Absence must not be represented as restoration or silently replaced. |
| Playwright cleanup → recovery evidence root | Runner cleanup must be provably disjoint from immutable evidence. |
| Production routes → recovered verdicts | Only GET/HEAD read-only measurement can create new evidence provenance. |
| Recovered artifacts → remediation | Tracked hash pins must exist before any finding authorizes production work. |

## STRIDE Threat Register
| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|---|---|---|---|---|---|
| T-28-01R-01 | Tampering | historical loss record | critical | mitigate | Preserve old hashes with LOST_NO_BACKUP/restored=false and immutable 28-01 pins. |
| T-28-01R-02 | Tampering | Playwright output cleanup | critical | mitigate | Canonical path-disjoint preflight and absent immutable `.artifacts` attempt root. |
| T-28-01R-03 | Spoofing | fresh baseline verdict | critical | mitigate | Production-route provenance, GET/HEAD-only ledger, exact identity/rule reconciliation, reject unsupported PASS. |
| T-28-01R-04 | Repudiation | RED execution state | high | mitigate | Pin a8a4a9dc as RED_RECONCILED_NOT_COMPLETE and forbid summary/task completion. |
| T-28-01R-SC | Tampering | package installs | high | accept | No package install exists. |
</threat_model>

<verification>Run immutable 28-01 hash/diff checks, safe-root path tests, headed production-route read-only capture, GET/HEAD network reconciliation, exact six-part identity/32-rule/totals gates, recovery-authority hash validation, RED-state proof, secret/stub scan, and git diff --check.</verification>

<success_criteria>
- Historical old hashes remain truthful LOST_NO_BACKUP facts and no text claims restoration.
- New immutable evidence is outside Playwright cleanup and complete under exact identity/rule semantics.
- Every request is GET/HEAD and every PASS has fresh deterministic provenance.
- New artifact hashes are tracked before 28-02 resumes.
- Existing RED commit is reconciled but remains incomplete with no production implementation or 28-02 summary.
</success_criteria>

## Source Coverage Audit
| SOURCE | ID | Feature / constraint | Plan coverage | Status |
|---|---|---|---|---|
| GOAL | Phase 28 evidence-backed remediation | Restore executable authority after evidence loss without rewriting history | Tasks 1-3 | COVERED |
| REQ | PUX-01 | Exact whole-route identity inventory | Task 2 | COVERED |
| REQ | PUX-02 | Single measurement/reconciliation harness | Tasks 1-2 | COVERED |
| REQ | PUX-05 | Exact finding authority before remediation | Tasks 2-3 | COVERED |
| REQ | PUX-06 | Fail-closed evidence and verification | Tasks 1-3 | COVERED |
| RESEARCH | Accessibility/evidence honesty | Deterministic production-route measurement and honest NEEDS_EVIDENCE | Task 2 | COVERED |
| CONTEXT | Exact identity, 32 rules, screenshot non-oracle, no guessed PASS | Reconciliation and pin gates | Tasks 1-3 | COVERED |
| CONTEXT | Deferred warehouse consolidation | No warehouse/backend/database/production work | Excluded | DEFERRED/OUT OF SCOPE |

<output>Create `.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01R-SUMMARY.md` when done.</output>
