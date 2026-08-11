# Phase 4.2 authority/provider unblock — 2026-08-10

## Decision

Provision a new private Backblaze B2 bucket with Object Lock enabled at creation and a default `COMPLIANCE` retention period approved by the retention owner. Use a unique object name for every encrypted backup, retain the returned B2 `fileId`, and use that `fileId` for the live receipt and remote-only restore. Separate the bucket/retention administrator, uploader, metadata verifier/restore reader, and client-side encryption-key custodian.

This is the fastest defensible provider path for Plan `04.2-05` Task 2. B2 exposes a true non-bypassable compliance mode, per-version identity, retention and legal-hold metadata, granular application-key capabilities, and both native and S3-compatible APIs. Cloudflare R2 can enforce a useful bucket retention rule, but an authorized bucket-config principal can remove that rule. R2 also does not implement the S3 Object Lock, legal-hold, or bucket-versioning operations required to bind and later retrieve a protected historical object version. R2 therefore should not be represented as compliance/WORM evidence for this phase.

This note addresses only the provider portion of Task 2. The nine real business authority records and Finance/Catalog identities remain separate blockers.

## What “immutable” means here

Provider immutability is enforcement against changing or deleting a particular stored object/version before an approved retain-until time. It is not the same as:

- a lifecycle rule that schedules hiding, transition, or deletion;
- keeping multiple versions while a delete-capable principal can still permanently delete one;
- an internal convention that operators should not delete backups;
- an RPO/RTO statement; or
- encryption at rest.

B2 Object Lock prevents a protected file version from being changed or deleted. In `COMPLIANCE` mode, retention cannot be removed by any user and its date can only be extended; legal hold is an independent protection with no fixed expiry. Object Lock also takes precedence when lifecycle processing attempts to change or delete a locked file. See Backblaze's [Object Lock contract](https://www.backblaze.com/docs/cloud-storage-object-lock). By contrast, B2 [Lifecycle Rules](https://www.backblaze.com/docs/en/cloud-storage-lifecycle-rules) hide or delete versions on a schedule; they are data-management automation, not the WORM control.

R2 similarly distinguishes [object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), which expire or transition objects, from [Bucket Locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/), which block overwrite/delete while a rule applies. The decisive limitation is that the same R2 documentation describes removing lock rules through the dashboard, Wrangler, or the configuration API. This makes R2 Bucket Lock an administrative retention guard, not non-bypassable compliance-mode WORM.

## Provider comparison

| Requirement | Backblaze B2 | Cloudflare R2 | Phase 4.2 disposition |
|---|---|---|---|
| True immutable/WORM retention | Object Lock supports `GOVERNANCE` and `COMPLIANCE`. In compliance mode no user can remove retention or shorten the date; Object Lock cannot be disabled after enablement. | Bucket Lock blocks overwrite/delete for a duration, until a date, or indefinitely, but a bucket-config principal can remove the rule. S3 Object Lock headers and configuration operations are unsupported. | Choose B2 `COMPLIANCE`. Do not label R2 Bucket Lock “compliance WORM.” |
| Object/version identity | Every upload has a unique `fileId` identifying that exact version. Uploading the same name creates another version; `b2_download_file_by_id` retrieves the selected version. [B2 files and IDs](https://www.backblaze.com/docs/cloud-storage-files) | Workers metadata has a random `version` for a specific upload, but reads are by current key. R2's S3 compatibility table lists `GetBucketVersioning` and `PutBucketVersioning` as unsupported. [R2 Workers object metadata](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) | B2 directly satisfies the manifest's “exact object/version” binding. R2's upload identifier is useful receipt metadata but not a historical-version retrieval handle. |
| Retention/legal-hold metadata | `b2_get_file_info` returns `fileId`, content digest/size, upload time, `fileRetention.mode`, `retainUntilTimestamp`, `legalHold`, and encryption mode when the read key has the corresponding capabilities. [Native metadata response](https://www.backblaze.com/apidocs/b2-get-file-info) | Bucket Lock exposes bucket rules, not per-object S3 Object Lock retention/legal-hold metadata. R2 explicitly does not implement `x-amz-object-lock-mode`, retain-until, or legal-hold on `PutObject`, and does not implement `GetObjectLockConfiguration`. [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/) | B2 yields the live provider receipt fields required by Tasks 9–11. R2 needs a weaker rule-plus-current-object proof and has no legal-hold equivalent in this interface. |
| Credential/role separation | Application keys have separate `writeFiles`, `readFiles`, `deleteFiles`, bucket/file retention read/write, legal-hold read/write, and `bypassGovernance` capabilities, and can be restricted to a bucket/prefix. [B2 key capabilities](https://www.backblaze.com/docs/cloud-storage-application-key-capabilities) | Account or user API tokens can be bucket-scoped with Admin Read/Write, Admin Read-only, Object Read/Write, or Object Read-only. Bucket configuration needs the broader storage-write permission. [R2 authentication and permissions](https://developers.cloudflare.com/r2/api/tokens/) | B2 provides the narrower separation needed for uploader versus retention admin versus restore reader. Compliance mode also removes the governance-bypass concern. |
| Official CLI/API | Official B2 CLI and Native API are available; B2 also supports S3-compatible Object Lock calls. Backblaze documents AWS CLI `create-bucket`, `put-object --object-lock-mode COMPLIANCE`, and `get-object-retention` against its endpoint. [B2 Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock), [B2 CLI](https://www.backblaze.com/docs/cloud-storage-command-line-tools) | Wrangler supports object put/get/delete and Bucket Lock add/list/remove; AWS CLI, rclone, S3 API, and Workers API are also supported. [R2 CLI](https://developers.cloudflare.com/r2/get-started/cli/) | Both are automatable, but only B2 exposes the evidence semantics needed by the plan. Prefer the Native API for exact `fileId` metadata/download, or S3 API with the returned version ID. |
| Remote-only restore | `b2_download_file_by_id` downloads the exact version, and the response can expose retention and legal-hold headers to an authorized reader. [Download by file ID](https://www.backblaze.com/apidocs/b2-download-file-by-id) | A locked current object can be downloaded by key using Wrangler/S3. Because R2 lacks retrievable historical S3 versions, the key must remain the locked current object and must be globally unique. | B2 is a direct fit for Tasks 10–12 and avoids ambiguity after later uploads. |
| Key custody | B2 supports provider-managed SSE-B2 and customer-managed SSE-C. B2 does not retain an SSE-C key and cannot recover ciphertext if the customer loses it. [B2 server-side encryption](https://www.backblaze.com/docs/cloud-storage-server-side-encryption) | R2 automatically encrypts at rest with Cloudflare-managed keys and supports SSE-C; Cloudflare cannot recover an SSE-C-encrypted object if the customer loses the key. [R2 data security](https://developers.cloudflare.com/r2/reference/data-security/), [R2 SSE-C](https://developers.cloudflare.com/r2/examples/ssec/) | The phase requires encryption before egress, so keep the archive encryption key outside either provider. Provider SSE is defense in depth, not the phase's key-custody proof. |

### Materially stronger but slower alternative

Amazon S3 is materially stronger when the organization already operates AWS IAM and KMS. S3 Object Lock uses a WORM model, requires versioning, stores lock state on a specific version, supports independent legal holds, and in compliance mode even the account root user cannot delete or shorten a protected version. Its IAM actions separately govern retention, legal hold, governance bypass, version retrieval, and KMS decryption. See AWS's [S3 Object Lock model](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html), [lock metadata and encryption considerations](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html), and [specific-version retrieval](https://docs.aws.amazon.com/AmazonS3/latest/userguide/RetrievingObjectVersions.html).

For IPCManagement, AWS is not faster unless an approved AWS account, IAM boundary, KMS/key-custody process, and billing authority already exist. Since the backup is encrypted before egress, B2's simpler application-key model plus compliance lock is sufficient for this phase.

## Practical provisioning checklist

The authorized provider/retention/key owners perform these actions; the repository automation must not create the subscription or invent approvals.

1. Approve and record the provider decision: Backblaze B2, account/security domain, region/endpoint, RPO, RTO, retention duration, and whether legal hold is required in addition to fixed compliance retention.
2. Create a new private bucket. Enable Object Lock when creating it and set an approved default `COMPLIANCE` retention period. Treat the period as consequential: compliance retention cannot be shortened, and locked storage remains billable.
3. Reserve a non-PII, unique object-key convention, for example a random/run-derived key under a dedicated prefix. Never reuse a key as the restore identity even though B2 preserves versions.
4. Create four separated references/roles:
   - retention/bucket administrator, held offline or by the retention owner;
   - uploader app key restricted to the bucket/prefix with only capabilities necessary to list the target bucket and write files; no delete, retention-write, legal-hold-write, key-management, or governance-bypass capability;
   - metadata verifier/restore reader restricted to the bucket/prefix with list/read plus `readBucketRetentions`, `readFileRetentions`, and `readFileLegalHolds`; no write/delete;
   - encryption-key custodian outside B2, with an independently approved recovery procedure.
5. Keep client-side archive encryption as the authoritative pre-egress control. Provider SSE-B2 may be enabled as defense in depth. If SSE-C is selected, its key is an additional recovery dependency and must not be the only copy of the client-side archive key.
6. With an authorized non-production probe, upload encrypted bytes under a unique key. Capture the returned `fileId`, size, provider content digest, upload timestamp, request ID if returned, and bucket/endpoint references.
7. Query the object by `fileId` using a read-only verifier credential. Require `fileRetention.mode = compliance`, a future `retainUntilTimestamp` consistent with policy, the approved legal-hold state, and the expected encryption state.
8. Prove enforcement on that probe: an authorized, narrowly controlled attempt to permanently delete the exact version before expiry must fail. Do not infer immutability merely from a successful metadata query. Preserve only status/error class, timestamp, request ID, and hash of the redacted response.
9. Re-authenticate from the restore-reader profile and download only by exact `fileId` into a clean run-owned temporary directory. Verify ciphertext SHA-256 against the pre-upload value before decrypting. This establishes remote-only feasibility without using a local archive fallback.
10. Record the scheduler-overlap decision. Plan 05 currently requires the legacy schedule to remain overlapping; the authority record must explicitly approve that decision rather than silently changing the task.
11. Store credentials and key material only in the approved secret/key system. The intake and provider receipt contain opaque references and fingerprints only, never access-key IDs if those are treated as credentials, secret keys, tokens, passphrases, raw encryption keys, or connection strings.
12. After the provider fields and all nine business signatures are supplied, run the existing authority check and use the exact resume signal `phase42-authority-ready`. Provisioning alone does not authorize Task 3 or any database/runtime action.

## Exact redacted authority-intake fields

Populate the existing `authorityRecords.provider` object with real values of the following form. The examples below describe formats; strings such as `REF:<...>` must not be copied literally because the gate rejects placeholders.

| Existing field | Required non-secret evidence |
|---|---|
| `providerReference` | Opaque approved vendor/product decision record identifying “Backblaze B2 Cloud Storage / Object Lock”; include a decision/version reference, not credentials. |
| `accountReference` | Opaque provider-account inventory reference or SHA-256 of a canonical internal account identifier. Do not store login email, account key, or application-key ID if classified as credential data. |
| `containerReference` | Opaque bucket inventory reference or SHA-256 of `provider + account-scope + bucket-id/name`; retain the clear bucket name only in the approved credential/config store used at execution. |
| `securityDomainReference` | Opaque reference binding the provider region/S3 endpoint, private-bucket policy, administrative owner, and tenant/security boundary. |
| `rpo` | Owner-approved duration in an unambiguous machine form such as ISO 8601 (`PT…`) or the exact format accepted by the existing checker. This is a target, not a measured result. |
| `rto` | Owner-approved duration in the same unambiguous form. Task 12 later records the measured result separately. |
| `lockMode` | Exact value `COMPLIANCE` for the chosen B2 path. Do not use `GOVERNANCE` for terminal WORM evidence. |
| `retainUntilPolicyReference` | Opaque reference to the approved retention policy containing duration/minimum retain-until calculation, scope/prefix, effective date, and retention owner. Do not put a guessed future date here. |
| `legalHoldDecisionReference` | Opaque signed decision stating either legal hold `ON` for the run objects or “not required; fixed compliance retention governs,” with decision owner/date. A null field is not a negative decision. |
| `keyOwnerReference` | Opaque role/identity reference for the client-side encryption-key owner; no personal data or key value. |
| `keyCustodyReference` | Opaque reference to the vault/HSM/offline custody policy, separation of duties, rotation/escrow rules, and non-secret key fingerprint or key-version reference. |
| `keyRecoveryReference` | Opaque reference to an approved and tested recovery procedure/evidence, including recovery approvers and validity date; never include the recovery secret. |
| `credentialReference` | Opaque secret-manager/profile reference identifying the separated uploader and restore-reader profiles and their approved scopes. Do not include password, token, application-key secret, access-key ID where prohibited, or environment-variable value. |
| `legacyScheduleOverlapDecisionReference` | Opaque approval explicitly stating that the current legacy backup schedule remains overlapping during this run, with owner, scope, decision time, and expiry/review point. |
| `status` | Set only to the checker's accepted ready/approved value after every provider field is real, current, and independently verifiable. Do not infer the enum; use the existing authority-check contract/output. |

The provider intake is authority, not the live object receipt. Task 9's `provider-receipt.json` should additionally capture these non-secret fields from the actual upload/query:

- provider, account, security-domain, bucket, endpoint/region, and credential-profile opaque references;
- unique object-key reference (prefer a digest in redacted evidence), B2 `fileId`, content length, upload UTC, and provider request/audit IDs;
- pre-egress ciphertext SHA-256, returned provider digest/ETag with its algorithm identified, and encrypted inner-manifest SHA-256;
- bucket Object Lock enabled state and default retention mode/period;
- per-version `fileRetention.mode`, exact `retainUntilTimestamp`, legal-hold status, and metadata-query UTC;
- encryption-before-egress boolean, provider SSE mode, non-secret encryption-key fingerprint/version reference, key owner/custody/recovery references;
- redacted delete-denial result for the exact version before expiry;
- exact-version remote download result, downloaded ciphertext SHA-256, and proof that no local archive path was an input;
- receipt schema/tool/API version and SHA-256 of the redacted raw provider responses.

Do not treat B2's SHA-1 or an S3 multipart ETag as the phase's canonical integrity digest. Preserve the repository's SHA-256 over the exact ciphertext bytes and use provider digests as additional transport/provider evidence.

## Acceptance test for the provider decision

The provider portion is defensible only when all of the following are true simultaneously:

- the authority intake contains real opaque references for every provider/key/retention field;
- the bucket has Object Lock enabled and the selected exact file version reports `COMPLIANCE` plus an approved future retain-until time;
- legal-hold state matches an explicit owner decision;
- uploader cannot delete or alter retention, restore reader cannot write, and retention administration is separate;
- the client-side key can be recovered without the provider and no key/credential value appears in evidence;
- exact-version download by B2 `fileId` succeeds from remote storage and the ciphertext SHA-256 matches;
- deletion of the protected exact version is denied before expiry; and
- lifecycle settings are reported separately and never used as the immutability proof.

Graph risk: N/A — graph-free research-only diff. No GitNexus analysis is applicable.
