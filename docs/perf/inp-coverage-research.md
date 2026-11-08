# INP coverage research

## Kết luận áp dụng cho `perf-probe.mjs`

INP là độ trễ từ lúc người dùng bắt đầu tương tác đến khi trình duyệt trình bày
frame kế tiếp. Một mẫu phải tách được ba phần: input delay, processing duration
và presentation delay; chỉ processing duration không phải là INP đầy đủ.
[web.dev — Optimize INP](https://web.dev/articles/optimize-inp?hl=en) mô tả rõ
input delay là phần chờ trước callback, processing là thời gian callback chạy,
và presentation là thời gian sau callback đến frame được vẽ.

Event Timing API cung cấp `processingStart` và `processingEnd`; MDN xác nhận
processing duration được tính bằng `processingEnd - processingStart`, còn
`interactionId` dùng để nhóm các event thuộc cùng một tương tác.
[MDN — PerformanceEventTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming)
và [MDN — interactionId](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming/interactionId).

## Quy tắc coverage

1. Mỗi cell phải gắn với `route + tab + interaction`, không đo route shell rồi
   suy ra cho mọi tab.
2. Selector của control phải được tìm trong panel đang active. Ngoại lệ là
   chuyển tab và sidebar vì chúng thuộc route shell.
3. `N/A` phải phân biệt selector không khớp, phần tử không hiển thị, không có
   Event Timing entry, và lỗi thực thi.
4. Mỗi cell có giá trị phải chứa đủ `inputDelay`, `processing`,
   `presentation`, `presentationShare` và `dominatedBy`.
5. `row-action` luôn nằm trong matrix; nếu bảng không có action thì chỉ được
   `N/A` có lý do, không được bỏ cell.
6. Batching chỉ là cách vận hành để tránh timeout. `PROBE_REPEATS` mặc định vẫn
   là 5 và mỗi sample vẫn là context/trang nguội mới.

## Áp dụng vào probe hiện tại

Probe đã được chỉnh để INP chạy trên đúng target tab và scope các selector vào
panel active; `PROBE_INTERACTIONS` chỉ lọc batch, không thay đổi matrix mặc định.
Các phần còn cần mở rộng là catalog control theo từng route/tab (đặc biệt các
action trong modal, pagination và submit), sau đó chạy đủ 5 repeats cho từng
cell có owner thật.

