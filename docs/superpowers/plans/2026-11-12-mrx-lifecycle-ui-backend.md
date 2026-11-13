# Approved MRX lifecycle UI and backend execution
User approved lifecycle testing with UI checks on 2026-11-12.
Use existing disposable runner and role/workbook fixtures. Native execution.
1. Align selectors/display assertions with localized quantity text. Preserve numeric payload, stock, version and UUID assertions.
2. Run LifecycleAcceptance diagnostics; inspect first failure and cleanup receipts.
3. Repair reproduced owner defects and rerun failed cases with adjacent regressions.
4. Run UiAcceptance for four stations/six widths, clipboard, localized issue payload, transfer banner and delayed retry/day frame probes.
5. Record per-case results, source/candidate receipts and cleanup in WORK, the sole state owner.
No endurance, main restart, source writes, delegation, installation or commits. Whole qualification stays OPERATIONAL_QUALIFICATION_BLOCKED while outstanding gates remain.
