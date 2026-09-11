# Phase 35 — information uniqueness and closed-value projection ledger

Status: CLOSED_PASS_WITH_DECLARED_RESIDUAL. Scope: all mounted owners in `DEFAULT` and `MATERIAL_RECONCILIATION`.
Research inputs: read-only runs `ec805b2f-2443-439f-aea6-1d25aade68db`, `2e6b5e8b-76a2-4661-9932-30f19486d708`, `5b05fc4f-a9f7-4fb0-8e2b-57c02d1464c8`.

## Rule disposition

- Semantic duplicate same-problem messages: `RULE_AMBIGUITY`; clarified existing V3 rather than creating another invariant.
- Closed trigger versus opened option label: `EXISTING_RULE` (`P1`, `P3`, `L1`, `L2`, `L4`, `L11`) plus `ENFORCEMENT_GAP`; execution oracle added to harness step 10.
- Base Select one-line clamp without full-label disclosure: candidate `RULE_AMBIGUITY`; requires a primitive behavior/design decision and RED measurement before implementation.

## Confirmed information/state findings

| ID | Mode / mounted owner | Finding | Root owner | Rule | RED seam | Status |
|---|---|---|---|---|---|---|
| IU-01 | DEFAULT `/warehouse` | Purchase-order request error is shown while the child table infers ready-empty from `[]`. | `WarehousePage` ↔ `WarehousePurchaseOrdersPanel` phase boundary | E1/E2/V3/V6 | terminal query error => error replaces panel/false-empty | PASS_SOURCE_REGRESSION |
| IU-02 | BOTH `/weekly-menu` | `QueryViewBoundary` and `WeeklyMenuAlerts` both announce the same catalog request failure. | `WeeklyMenuAlerts` query-error ownership | E2/E7/V3/V9 | local alert RED; shared boundary remains sole owner | PASS_FOCUSED |
| IU-03 | DEFAULT `/approvals?view=queue` | Empty guidance alert and `ApprovalQueue` empty state describe the same empty queue. | `ApprovalQueueState` | E2/E3/V3/V6 | ready empty => one purposeful empty surface | PASS_FOCUSED |
| IU-04 | MRX `/reconciliation` | Candidate repeated all-matched count. Mounted behavior regression finds one visible matching fact in current composition. | result presentation model/callsite | P3/V2/V3 | `/nguyên liệu đã khớp/` visible exactly once | NOT_REPRODUCED_CURRENT_SOURCE |
| IU-05 | DEFAULT `/approvals` | One successful decision created both a local live announcement and announced toast. The toast is now the sole announcement; queue focus return remains. | post-decision feedback arbitration | E5/E8/A | success mutation => one live status announcement | PASS_FOCUSED |
| IU-06 | BOTH `/admin/advanced-settings` | Reset created persistent live `lastChange` and an announced toast with the same result. Reset now clears the local channel and uses one toast; ordinary toggle feedback remains local. | Advanced settings feedback arbitration | E5/E8/A | reset => one live completion announcement | PASS_FOCUSED |

Intentional summary/detail cases on DEFAULT dashboard, MRX dashboard and Chef multi-axis status were reviewed and not promoted.

## Confirmed closed-value findings

Source inventory: 30 Base UI `SelectValue` controls in 19 production files plus 10 native selects in 7 production files. This is a source occurrence count, not yet the mode/state browser denominator.

| ID | Mode / mounted owner | Finding | Root owner | Rule | RED seam | Status |
|---|---|---|---|---|---|---|
| CVP-01 | MRX `/warehouse`, `/reconciliation`, `/admin-data?view=audit` issue drawer | Closed issue-line choice said ordinal `Dòng N`; options identified ingredients. Closed and open now share `ingredient · Dòng N`. | `ReconciliationIssueDetailDialog` | P1/P3/L1 | RED ordinal-only → GREEN label parity | PASS_FOCUSED |
| CVP-02 | DEFAULT Chef excess-material dialog | Closed label dropped customer/shift/tier discriminator used to distinguish options. One canonical local projection now drives both states and canonical shift labels. | local material label projection | P3/L1/L4 | RED discriminator loss → GREEN; no raw shift enum | PASS_FOCUSED |
| CVP-03 | DEFAULT/MRX Admin surfaces | Audit area, menu version and approval-rule labels previously duplicated owning dictionaries; unknown audit area masqueraded as `Tất cả`. Options now derive from their owning maps/formatters and unknown audit scope is explicit. | existing presentation/options owners | P3/L4/S1.1 | existing mounted select tests plus source-derived complete option lists | PASS_FOCUSED |
| CVP-04 | Shared Base Select consumers | One-line clamp lacked full-value disclosure and empty `SelectValue` could initially project the serialized value before options mounted. Shared triggers now expose the complete projected label in `title`; all production callsites explicitly project closed labels, enforced by a source inventory guard. | `components/ui/select.tsx` + three empty callsites | P1/P3/L1/L4 | long constrained label + zero empty production `SelectValue` occurrences | PASS_SOURCE_REGRESSION |
| CVP-05 | MRX Admin Audit scope | Prior raw `MATERIAL_RECONCILIATION` projection fixed and regression-locked. | `AdminAuditPanel` | P1/L4 | existing test | PASS_SOURCE_REGRESSION |

## Claim accounting

Mode-specific denominators are frozen in `.artifacts/ui-ux-process-inventory/phase35-denominators/`:

- Closed-value projection: DEFAULT 37 mounted controls / 74 default+selected projection cells; MRX 13 / 26. All are `PASS_SOURCE`; browser composition remains a separate claim.
- Information uniqueness: DEFAULT 17 activated state/grain cells; MRX 5. DEFAULT headed evidence passes 16/17 and MRX passes 4/5 cells at all three viewports (60/66 combined observations). The successful protected approval mutation and naturally available all-matched batch cells remain `NEEDS_EVIDENCE`; no business state was fabricated.

The previous aggregate placeholder of one `NEEDS_EVIDENCE` cell is retired.

## First implementation receipt

- CVP-01/CVP-02 RED: 2 expected failures / 9 passes; GREEN 11/11.
- IU-02 RED: 1 expected failure; GREEN included below.
- IU-03 RED: 1 expected failure / 10 passes; GREEN included below.
- First consolidated focused gate: 6 files / 39 tests PASS; TypeScript and scoped quiet ESLint PASS.
- Second focused gate: Approvals/Advanced Settings/Admin label owners, 5 files / 39 tests PASS.
- IU-01 has a focused source ownership regression; headed error-state evidence remains required.
- IU-04 was not reproduced by the mounted behavior test and received no speculative production edit.
- IU-05/IU-06 and CVP-03: 5 files / 39 tests PASS.
- CVP-04 shared/select callsites: 3 files / 20 tests PASS; TypeScript and scoped quiet ESLint PASS. The guard
  prevents the raw serialized-value flash caused by an empty `SelectValue`, while shared `title` preserves the
  complete selected label when visual one-line clamping applies.
