---
name: ipc-debugging
description: Diagnose IPCManagement failures or performance regressions with an exact-symptom reproduction, falsifiable probes and owner-level repair. Use for bugs, exceptions, incorrect results or slow behavior.
---

# Evidence-driven debugging

Advisory capability under [AGENTS](../../../AGENTS.md); [WORK](../../../.planning/WORK.md) remains the only task-state owner. This skill grants no execution or delegation authority.

Use [ENGINEERING](../../../docs/ENGINEERING.md) and only the relevant domain/design/operations owner. Preserve inherited work; a historical comparison never authorizes resetting the checkout, installing packages or changing runtime/data state.

## Establish a useful signal

Record expected versus actual behavior and the relevant source/build, input, actor and mode. Prefer an existing focused test or the smallest approved command that exercises the reported symptom with an independent expected result. Source inspection may guide reproduction; do not mistake it for a successful repro.

For intermittent failures, report attempts and failure rate under declared conditions. Do not silently stress a shared service. For performance, establish comparable before/after measurements and distinguish frontend, network, backend and database costs; DEV and production results are not interchangeable.

If reproduction needs unavailable access or unsafe operations, report NEEDS_EVIDENCE or BLOCKED and request the exact missing permission/artifact. Do not turn a different nearby failure into the target bug.

## Isolate the cause

- Minimize inputs and steps while preserving the exact failure; rerun after each meaningful reduction.
- Trace entry point, callers, guard conditions and the real state/I/O owner. Compare sibling paths when the bug may be shared.
- Form only the plausible hypotheses needed; state a distinguishing prediction for each. Change one variable per approved probe and record what would disprove the hypothesis.
- Prefer narrow observations to broad logging. Keep credentials, payloads and private rows out of diagnostics; capture/replay or instrumentation requires appropriate scope and a safe destination.

A temporary harness is a bounded reproduction technique, not a new production seam, fixture factory or evidence system. Use existing safe inputs and dependencies. Synthetic business fixtures, bisect checkouts, browser/auth changes and DB operations require their own authorization; this skill does not supply it.

## Repair and verify

Apply the minimum complete fix at the shared cause, not only the reported caller. Use test-audit for a regression protecting observable behavior at the strongest reachable owner: demonstrate its intended pre-fix failure and post-fix success. Do not add an unrelated unit test if the real bug requires concurrency, persistence or multiple callers; disclose missing proof instead.

Rerun the original scenario and necessary adjacent checks. Remove task-owned diagnostic instrumentation and temporary artifacts, without deleting user-owned data. Inspect the final diff for unrelated changes and secrets.

Return the root cause, supporting observations, exact commands/results, inherited failures and remaining uncertainty. Recommend architectural follow-up only when the repaired bug demonstrates a real need; do not launch a campaign, persist a debug state system or commit automatically.
