# Phase 3: Import Atomicity and Recovery — Context

**Gathered:** 2026-08-03
**Status:** Ready for execution
**Mode:** Autonomous from accepted standardization contract

## Phase boundary

Replace the frontend's sequential multi-customer commit loop with one backend batch boundary. Every workbook is parsed and preview-ticket validated before persistence; all customer/week writes then share one relational transaction.

## Locked decisions

- Choose database atomicity, not frontend compensating rollback. Existing rollback removes a DRAFT import but cannot promise restoration of every overwritten prior fact.
- Keep the existing single-file endpoint and behavior for per-job commits; add a batch endpoint only for “Lưu file hợp lệ”.
- Batch multipart fields are positional and exact-count validated; duplicate customer/week scopes are rejected before persistence.
- A customer-specific domain failure identifies the failed customer and states that no batch item was saved.
- Preview tickets remain valid after a rolled-back batch and are consumed only after the complete transaction succeeds.
- Retry of the same batch succeeds at most once; replay after success fails because its tickets were consumed.
- No migration or live database mutation is required. GitNexus is not active.

## Verification contract

- A relational forced-failure test writes customer one, fails customer two and observes zero committed batch rows from a fresh context.
- The same intent can retry after the failure, persists exactly once, and then rejects replay.
- Frontend batch confirmation says all-or-nothing and sends one request; failure restores every job to previewed/retryable rather than displaying partial success.

## Deferred

None. Durable recovery workflow is unnecessary when the transaction proves atomic.
