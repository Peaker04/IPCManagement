---
name: ipc-code-review
description: Review an IPCManagement diff, branch or proposed change for concrete behavior defects, contract gaps and maintainability risks. Use when reviewing code or checking regression safety.
---

# Scoped code review

Advisory capability under [AGENTS](../../../AGENTS.md); [WORK](../../../.planning/WORK.md) remains the only task-state owner. This skill grants no execution or delegation authority.

## Establish the comparison

- Identify the requested files, baseline and working-tree scope. Separate staged, unstaged and untracked work; do not omit local changes or attribute inherited changes to the task.
- Resolve a supplied ref before comparing. Use `git diff <base> HEAD` for endpoint comparison or `git diff <base>...HEAD` when the user wants changes since the merge-base. Inspect local diffs separately. An empty comparison is not proof of product correctness.
- Read the complete changed owner, relevant callers and machine/behavior contracts. Load only the applicable canonical owner through AGENTS; use [ENGINEERING](../../../docs/ENGINEERING.md) for verification conventions. If requirements are missing, state that gap rather than inventing a spec or setting up an issue tracker.

## Review two distinct questions

1. **Behavior and contract:** Does the change deliver the requested result without breaking permissions, mode separation, precision, lineage, state transitions or recovery? Trace reachable paths, including denial, stale responses, duplicate mutations and failures. For security-sensitive changes trace untrusted input to validation, authorization and output; for persistence changes inspect transaction/concurrency guarantees from source without accessing a database.
2. **Implementation quality:** Does the change fit existing owners and conventions? Look for duplicated authority, hidden side effects, speculative abstractions and unnecessary dependencies. A code smell is a contextual suggestion, not a business rule or automatic reason to refactor.

For a diff review, explain how each defect was introduced or made reachable by that diff. Separate inherited problems and optional simplifications. Use the existing test-audit skill whenever reviewing tests; preserve independently valuable security/storage/ordering contracts.

## Deliver findings

For each actionable finding give severity, current path/line, affected scenario, source/contract or repro evidence, and the smallest owner-level remedy. Group behavior/contract findings separately from maintainability suggestions; deduplicate findings supported by the same cause.

Report focused checks actually run and missing evidence. No demonstrated findings means only a clean scoped review, not whole-product certification. Parent performs authorized integration; parallel reviewers are optional only when the operator authorized delegation. Do not automatically edit, publish comments or commit.
