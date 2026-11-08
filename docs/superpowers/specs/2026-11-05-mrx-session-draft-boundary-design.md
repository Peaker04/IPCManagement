# MRX session/draft boundary — short design

Date: 2026-11-05. The owner selected approach A and subsequently approved this short design. Implementation is subject to review of the bounded native plan; this document is not execution evidence. WORK remains the only live task ledger.

## Intent and trade-off

Unblock MRX verification without changing authentication or retaining sensitive browser state across an invalidated session. Separate recoverable transport/reload failures from session termination. Explicit cost: uncommitted browser drafts are lost after401, even if the same actor signs in again; do not advertise recovery across that boundary.

## Approaches

- **A — Preserve current401 cleanup; align G5 (owner-selected, recommended).** Smallest scope, unchanged authorization/session behavior. Requires manual re-entry after reauthentication.
- **B — Retain actor-scoped drafts across sessions.** Better continuity, but requires separately approved ownership, expiry, logout/account-switch, stale-source and privacy rules. Not selected.
- **C — Server-backed durable drafts.** Supports stronger recovery/multiple devices, but adds business capability, API and persistence. Not selected.

## Behavior contract

| Situation | Required outcome |
|---|---|
| Request aborted before forwarding, valid session | No issue, receipt, batch-version or stock change. Explicit reload/recovery restores the real scoped draft, including quantity2.75. |
| Reload in the same valid session | Recovery is explicit, actor/batch/date/source-version scoped; another actor or stale source version must not be offered that draft. |
| Committed response lost | Existing G5 initial/supplemental owners retain exact replay/no-duplicate stock-effect assertions; no replacement by a mocked commit. |
| Actual submit receives401 | Reject the command, redirect to login, clear session-owned drafts/caches/queues through the existing cleanup owner; no issue/receipt/version/stock mutation. |
| Same actor signs in after401 | Old draft remains absent and is not offered. A subsequent valid submit requires fresh UI entry and produces exactly one issue/receipt with the correct persisted quantity and stock/lot effects. |

## Smallest change and owners

- Modify the existing `frontend/tests/e2e-mrx/specs/g5-async-timeout.spec.ts` session case, not a parallel recovery suite. Exercise its existing cross-actor/stale-version checks on the real saved draft **before401**, while the session is valid. Restore the original valid snapshot only within that pre401 recovery exercise.
- After401 assert actual draft deletion, no recovery offer after re-login, unchanged business evidence, then fresh UI entry and an exactly-once successful submit. Never inject a saved snapshot after401 to simulate recovery.
- Extend the existing401 case in `frontend/src/__tests__/ApiContracts.test.ts` to cover draft cleanup alongside its current session-cache assertions, reusing `getDraftStorageKey`; no new test-only production seam. This owns transport cleanup; G5 owns the user-visible recovery/reauthentication workflow.
- Preserve production `api/client.ts`, `store/clearSessionState.ts`, `hooks/useClientDraftPersistence.ts` and warehouse draft hooks. If evidence requires changing any of these owners, stop and reassess rather than widening this harness repair.
- Record the selected policy and distinguishable precommit/401/reauthenticated outcomes in the existing evidence report and WORK. Existing failed runs remain failed.

## Verification and constraints

Use test-audit before editing tests. Review assertions against this approved behavior change rather than treating removal of cross-session restoration as proof of a bug fix. Run focused API/auth/fixture checks, touched lint/types, then the existing ordered `MenuIntegrityPerformance` diagnostic on a newly admitted disposable clone. Keep G4, both committed-response-loss cases, G5 session and G6 direct assertions selected; no skip/exemption or dependency bypass. Performance begins only after functional/adversarial gates pass; unsupported readiness metrics remain NEEDS_EVIDENCE.

Native/direct-parent execution only. No dependency install, delegation, worktree, stage/commit/deploy, main DB writes, migrations, master provisioning, user-service replacement or historical clone/credential/profile reuse. DEFAULT and MRX remain isolated. No new UI, draft feature, refresh-token mechanism or timeout/rate-limit weakening. The existing whole-plan gaps (rectangular/group/reimport/negative/independent numeric exports) remain separate obligations, not accepted by this change.

## Handoff

This is a small test-contract correction, not an auth redesign. After approval of this design, write a bounded implementation plan using the existing native execution method; obtain plan review before implementation. The builder owns mechanical test ordering and fresh-entry selectors, but cannot change the401 purge policy or relax numeric/ownership assertions.
