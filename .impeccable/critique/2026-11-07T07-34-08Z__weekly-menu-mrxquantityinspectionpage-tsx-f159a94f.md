---
target: "Six owner screenshots: MRX inspection filters, misleading empty states and multi-customer preparation layout"
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:D:\\ki7\\PRN222 Doanh Nghiệp\\IPCManagement\\frontend\\src\\features\\weekly-menu\\MrxQuantityInspectionPage.tsx"
target_fingerprint: "sha256:200a2688d1d5a4fc8312ad26670ecdee2d77c420bb8202798cbf41f1870aef9f"
target_path: "D:\\ki7\\PRN222 Doanh Nghiệp\\IPCManagement\\frontend\\src\\features\\weekly-menu\\MrxQuantityInspectionPage.tsx"
timestamp: 2026-11-07T07-34-08Z
slug: weekly-menu-mrxquantityinspectionpage-tsx-f159a94f
---
⚠️ DEGRADED: single-context (phạm vi hiện tại không cho phép delegation; đây là tự rà soát có bằng chứng, không phải critique hai reviewer độc lập).

## Kết luận về sáu ảnh

Có lỗi thật, không thể giải thích chung là “chưa tới bước nghiệp vụ”. Hai lỗi UI tái hiện bằng component thật trong Chrome riêng; backend đang chạy chưa cung cấp API mới. Dữ liệu thực của khách hàng/tuần trong ảnh vẫn cần phiên đăng nhập được phép.

### 1. [P0] Backend đang chạy chưa có API của hai trang mới
Swagger hiện tại có /quantity-import/preview và /commit, nhưng không có /materials hoặc /plans. GET qua frontend proxy tới materials trả404. Hai trang mới chưa thể hoạt động đúng với backend hiện tại. Đây là vấn đề phiên bản runtime, không phải bằng chứng rằng phải xuất kho/hoàn thành thêm bước để thấy dữ liệu.
ReconciliationQuantityImportService.LoadSnapshotAsync yêu cầu: thực đơn phát hành, có nguồn kế hoạch số suất, các kế hoạch số suất COMPLETED. Không yêu cầu phải xuất kho. Chưa đọc có xác thực đúng khách hàng/tuần trong ảnh nên chưa xác nhận các điều kiện trên bản ghi thực.
Hướng xử lý: kiểm tra/chạy BE khớp mã đã kiểm chứng, rồi xác nhận actor/mode/customer/week. Không tự restart. /impeccable harden xử lý trải nghiệm lỗi; runtime là công việc kỹ thuật riêng.

### 2. [P1] Lỗi404 bị trình bày như kết quả tìm kiếm rỗng
frontend/src/components/workbench/StateBoundary.tsx coi errorStatus===404 là empty. Inspection cung cấp “Không có nguyên liệu/kế hoạch phù hợp”. Đã tái hiện bằng StateBoundary thật nhận ApiError(404): Chrome hiển thị thông báo rỗng như ảnh. Đây là component reproduction, không phải network của tab owner.
Tác hại: hướng người dùng đổi tuần/từ khóa dù API chưa có; chỉ sửa backend chưa loại bỏ lỗi thông báo khi triển khai sau.
Hướng xử lý: phân biệt nguồn nghiệp vụ không tồn tại, request thất bại và GET200 không có dòng phù hợp; giữ403/409/guards. Rà callers trước khi đổi shared behavior, không đổi mọi404 sang cùng một loại khác. /impeccable harden.

### 3. [P1] Cụm lọc sai kích thước wrapper
Select wrapper w-full, còn className='w-full sm:w-72' chỉ áp dụng lên select. Mũi tên theo wrapper.
| Viewport | Select | Wrapper | Kết quả |
|---|---:|---:|---|
|1440px|288px|khoảng1028px|Mũi tên trôi phải; tuần xuống hàng|
|1024px|288px|972px|Bộ chọn chiếm nguyên hàng; tuần thành hàng riêng|
Header probe cao99/147px; đây là component cô lập, không phải trang có sidebar. Hai screenshot probe đã được đọc.
Hướng xử lý: kích thước bao ngoài/control cùng owner, mũi tên trong ô; khách hàng+tuần cùng cụm desktop, xuống hàng có chủ đích khi hẹp. Rà Select callers, không SelectV2. /impeccable layout + /impeccable adapt.

### 4. [P1] Chuẩn bị đa khách hàng chưa đạt bố cục đã duyệt
Ảnh cuối: chọn AMANN sát trái, supplier label/input/export dồn phải, helper tạo hàng thêm; input hẹp cắt hướng dẫn. Source xác nhận selection/export cùng section với flex-1 và export width limit. Cùng container không đồng nghĩa cùng tác vụ.
Thiết kế đã duyệt: row1 title/date/issue; row2 customers/batches/selection count; row3 ingredient search + Excel supplier/export; body main allocation grid.
Hướng xử lý: phân nhóm đúng thứ tự, giữ supplier chỉ lọc Excel không đổi bảng/phiếu; giữ export/selection/stock guards. /impeccable layout.
Ảnh chỉ phần trên; không kết luận body grid hỏng.

## Design specificity / overall impression
LLM assessment before detector: ngôn ngữ vận hành/sidebar/bảng tuần phù hợp sản phẩm. Vấn đề không phải màu/trang trí mà control composition và error truth. Không cần dashboard/card/palette mới.

## Design Health Score — bounded triage, not whole-product certification
|#|Heuristic|Score /4|Key issue|
|---|---|---:|---|
|1|Visibility of System Status|1|404 thành empty|
|2|Match System / Real World|3|Thuật ngữ/ngày dễ hiểu|
|3|User Control and Freedom|2|Đổi scope/làm mới có; phục hồi sai|
|4|Consistency and Standards|2|Cụm lọc khác chuẩn bị lô|
|5|Error Prevention|2|Có source guards; tương tác chưa xác nhận đầy đủ|
|6|Recognition Rather Than Recall|2|Phải tự suy luận thiếu dữ liệu|
|7|Flexibility and Efficiency|2|Header lãng phí chiều cao; keyboard chưa chứng nhận|
|8|Aesthetic and Minimalist Design|1|Control rời, khoảng trống không phục vụ tác vụ|
|9|Error Recovery|1|Đổi từ khóa không sửa API thiếu|
|10|Help and Documentation|2|Có source/Excel explanation nhưng chưa đủ chính xác|
|Total||18/40|Poor; cần sửa trước acceptance phạm vi này|

## What's Working
Sidebar có leaves riêng; current source labelled dự kiến; preparation một primary rõ. Giữ, không thay dashboard/cards.

## Cognitive load / emotional journey / personas
Ba điểm yếu: grouping, visual hierarchy, status feedback. Published/transferred source rồi empty không giải thích làm người dùng mất tin tưởng.
Jordan: không biết thiếu bước nào, generic empty dẫn sai đường.
Alex: đổi filter vô ích, header chiếm diện tích thay vì dữ liệu.
Sam: header vỡ hàng; cần kiểm tra zoom/keyboard/focus, chưa khẳng định accessibility failure từ ảnh.
Minor: giữ supplier export-only wording; labels/filter count và empty recovery cần rõ. Không kết luận body crop hoặc toàn bộ frozen/printing từ screenshot.
Provocative questions: tại sao header scope lại mất thêm một hàng khi desktop còn chỗ? Vì sao API missing lại yêu cầu người dùng đổi từ khóa?

## Deterministic scan / browser evidence
CLI detect --json năm targets: frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx, frontend/src/features/warehouse/branches/MrxPrepAllocationsBranch.tsx, frontend/src/features/warehouse/branches/MrxPrepHeaderBranch.tsx, frontend/src/components/workbench/WorkspaceHeader.tsx, frontend/src/components/ui/select.tsx. Exit0, []. Mechanical clean does not certify geometry.
Dedicated headed installed Chrome, fresh context/tab, all /api/ blocked; no credentials, real auth or business data reads/writes. Mounted actual Vite-exported WorkspaceHeader/Select/VietnameseDateInput/StateBoundary/ApiError with diagnostic props. This is COMPONENT_PROBE_NOT_LIVE_UAT, not fixture-backed business acceptance. Width1440/1024; screenshots inspected. First probe failed createRoot import interop; harness corrected to dom.default??dom, then successful. Not an application failure.
Mutable injection preflight succeeded; detect.js injection true, console reported2 anti-patterns. Names/locations not retained, so not treated as two verified defects. Chrome/context and temporary Impeccable live server closed; health port8400 no response. No owner-visible overlay left running. No source HTML injection/edit.
Artifacts: D:/Temp/ipc-owner-review-browser-probe.json; D:/Temp/ipc-owner-review-COMPONENT-PROBE-{1440,1024}.png; D:/Temp/ipc-owner-review-impeccable.json; D:/Temp/ipc-owner-ui-current-swagger.json; D:/Temp/ipc-owner-missing-route-response.txt.

## All R01–R15 requirement review
|Requirement|This review|
|---|---|
|R01 saved draft, R02 file queue|Retain prior automated evidence; not reverified with actual file|
|R03 whole-week preview|Outside matrix screenshot does not prove preview modal; open|
|R04 servings, R05 initial/adjustment|Real behavior/authenticated writes not rechecked|
|R06 source/lifecycle/exits|Strip visible; Back/dirty/focus acceptance open|
|R07 merged center|Visible centered merged cells, not every merge/zoom|
|R08 edit group controls|Not edit mode in new screenshot; open|
|R09 Sáng/Chiều|Visible in matrix screenshot, remaining surfaces open|
|R10 standalone pages|Not usable live: missing API,404 masked as empty, broken header|
|R11 one import entry|One visible; current/new/completed intents open|
|R12 Lập lô đối soát|Screenshot transferred; label/transition not proven|
|R13 frozen BOM|No frozen modal/lineage examination this turn|
|R14 preparation|Upper layout does not meet approved design from source/screenshot|
|R15 cooking/print|No new evidence; native print/cancel open|
No basis for global completion. App-source/tests not changed; no test/build rerun, restart/business write/stage/commit. git diff --check passes with inherited LF/CRLF warnings, HEAD/index unchanged.

Questions to close this critique: scope options (fix all4 findings with complete R01–R15 re-audit, versus critical data failures first then layout); runtime authority (approve BE-only matching-runtime preflight/startup preserving environment/warehouse/outbox=false, versus leave runtime untouched).
