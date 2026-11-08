# Schedule layout-shift research

> **HISTORICAL / NO EXECUTION AUTHORITY.** Trạng thái trong file phản ánh thời điểm tạo. Dùng `MEMORY.md`, `docs/README.md` và phase hiện hành để quyết định công việc.


## Evidence

- Probe H.1 trước overlay: `deltaTop=316px`, `CLS window=0.1287`; hàng vẫn `48px`, `rowsData` không đổi.
- Probe với `noticePlacement="overlay"`: `deltaTop=79px`, `CLS window=0.0581`, `CGR=0.0878`, growth `0`, integrity `0`.
- CLS sources quy về các notice/query-boundary và shell phía trên bảng (`WeeklyMenuReadiness`, `ViewSwitcher`, content wrapper), không phải `SkeletonTableRow`.
- `QueryViewBoundary` có 6 consumer `preserveFallback`; vì vậy đổi shared behavior phải có regression theo consumer.

## Options

| Option | Tác động | Verdict |
| --- | --- | --- |
| Overlay notice, opt-in per consumer | Giữ `inline` backward-compatible; loại notice khỏi normal flow; cần bảo đảm focus/retry | Chọn — đã chứng minh giảm CLS trên Schedule |
| Bỏ `preserveFallback` ở Weekly Menu | Có thể tránh notice insertion nhưng đổi stale-data/error semantics và vi phạm source contract hiện hành | Loại |
| Đổi min-height/threshold | Che triệu chứng, không xử lý notice insertion; làm gate kém tin cậy | Loại |
| CSS selector theo DOM/`:has()` | Blast radius khó kiểm soát, không có API contract | Loại |

## Implementation and verification contract

1. `QueryViewBoundary.noticePlacement` mặc định `inline`; Weekly Menu opt-in `overlay`.
2. Overlay giữ retry button, keyboard focus và accessible live region.
3. Boundary tests phải cover `inline` và `overlay`; Weekly Menu source/runtime contract phải xác nhận opt-in.
4. Re-run production bundle with `--load`, then `--inp` and `--overflow`; accept only if integrity is zero and no new consumer regression appears.
5. Remaining `deltaTop=79px` must be traced to the next shell transition; do not change thresholds to classify it away.

## Auth note

`VITE_ENABLE_MOCK_LOGIN` is DEV-only. Production probe requires a credential/API lane that completes `bootstrapAuth`; the supplied admin credential timed out against the local lane and was not written to artifacts.
