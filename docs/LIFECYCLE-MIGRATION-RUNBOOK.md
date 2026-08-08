# Lifecycle kernel migration runbook

## Scope

Migration `20260808170000_AddLifecycleKernel` is additive only. It creates:

- `lifecycletransitions` — append-only transition evidence;
- `lifecycleoutboxmessages` — committed-but-undelivered event rows; and
- `lifecyclecommandreceipts` — idempotent command responses.

It changes no existing document table, status, stock movement, receipt writer or runtime behavior.

## Preconditions

1. Confirm the target database/lane and migration history; never run against `ipc_lane1` merely for a test.
2. Preserve an approved backup/checkpoint and capture `__EFMigrationsHistory` before deployment.
3. Confirm migration `20260808160000_EnforceMenuAmendmentSeparation` is already present.
4. Generate/review the idempotent SQL script from the checkout being deployed. The current local review artifact is `.artifacts/lifecycle-standardization/phase2-add-lifecycle-kernel.sql`.
5. Stop deployment if any of the three table names already exist without the matching EF history entry; reconcile manually rather than force applying.

## Deployment

Use reviewed SQL/bundle through the normal database release lane. Do not invoke automatic runtime migration from multiple API instances. After apply, verify all three tables, their unique indexes and the recorded migration ID.

## Rollback

Before any lifecycle command writes these tables, the technical down migration drops only the three new empty tables. After transition evidence exists, do not use destructive down migration: disable the feature path, preserve evidence, and recover with the approved database checkpoint/runbook if a rollback is required.

## Post-deploy verification

- `dotnet ef migrations has-pending-model-changes` is clean in the deploy checkout.
- A transaction containing a staged lifecycle transition produces one transition, one outbox row, one command receipt and one audit record.
- Replaying the same command ID returns the existing receipt and does not stage a second event.
- No receipt stock movement is created by this phase; Receipt integration starts only in Phase 3.
