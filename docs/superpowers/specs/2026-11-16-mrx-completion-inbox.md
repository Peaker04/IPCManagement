# MRX actionable completion inbox

Approved scope: MRX only, FR-APPR/FR-RECON, DOM-MODE-1. DEFAULT behavior remains unchanged.

An IN_PROGRESS batch is not by itself an actionable approval. Show it in the pending operational inbox only when the existing completion command's business prerequisites pass. Use one read-only eligibility owner shared with the completion command; the command must revalidate inside its protected transaction and retain version/RBAC checks. No new approval step, schema, or data backfill.

Pending supplemental demands, unmet baseline/supplemental quantities, ambiguous allocation, unresolved variances and incomplete days block eligibility. Preserve the existing legacy completion path with its actual linked issues and dispositions. Empty batches are never ready. Never use calendar week end as the completion criterion.

Eligible rows say “Sẵn sàng chốt lô”; the existing reconciliation station performs the actual close. Completed batches appear only in history. History must label batch creation as creation, never pending approval. Source-change and supplemental requests retain their independent queues and Admin direct-action audit behavior.

List pagination must scan past ineligible batches without losing later eligible items. Detail must use the same eligibility as list, and stale deep links must refuse an ineligible item. Read failures must remain visible as partial/unavailable rather than silently implying an empty queue.

UI uses existing SplitWorkbench, badges, roles and states. No new styling or controls. Verify backend eligibility, pagination/detail/history, role/mode isolation, and frontend status/history semantics.
