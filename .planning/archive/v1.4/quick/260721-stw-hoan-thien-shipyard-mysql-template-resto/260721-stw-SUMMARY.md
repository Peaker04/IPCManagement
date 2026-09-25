---
quick_id: 260721-stw
status: complete
date: 2026-07-21
commits:
  - bd58038
  - 1e3a082
shipyard_local_commit: c8fc882
---

# Shipyard MySQL lane và BOM 25/30/34k

## Kết quả

- Thêm .NET database clone tool chỉ cho phép `ipc_lane1..9` trao đổi với `ipc_e2e_template`; 56 bảng và row count được verify sau mỗi clone.
- Profile IPCManagement chạy MySQL trực tiếp, không cần Docker/WSL2/MySQL CLI; Python đặt trên ổ D và lock có fallback Windows.
- Lane 1 chạy commit `1e3a082` tại API `:8001`, frontend `:3001`; dashboard `:8090` trả lane `e2e-passed` và report HTTP 200.
- E2E hợp lệ chạy hai vòng sau template restore, sau đó chạy thêm một vòng xác nhận trên commit cuối; artifact của từng vòng được giữ trong `.artifacts/e2e`.
- Workbook `IPC. Định lượng 07.2026.xlsx` có 1.999 dòng nguồn, dry-run tạo 1.957 BOM canonical và merge 42 dòng trùng; fingerprint DB không đổi qua hai lần dry-run.
- Ba tier 25k/30k/34k được kiểm tra là dataset độc lập, không dùng một hệ số scale cố định.
- Dashboard nâng Vite/Vitest, 27 test pass, build pass, `npm audit` còn 0 vulnerability.

## Verification

- Backend: 300 API tests + 8 application tests pass.
- Frontend: 136 unit tests pass và lint pass; lane CI dùng tối đa 2 Vitest workers để tránh OOM trên máy 16 GB RAM.
- Database template: `CLONE=ipc_e2e_template->ipc_lane1`, `TABLES=56`, `VERIFY=PASS`.
- Dashboard: `/api/lanes`, `/api/proof/1` và `REPORT.html` đều HTTP 200.
- GitNexus re-index: 7.628 nodes, 21.641 edges, risk thấp, 0 execution flow bị ảnh hưởng.

## Blocker còn chủ động giữ

Không apply BOM canonical hoặc cleanup destructive. Roadmap vẫn yêu cầu safety baseline, read-only preview/classifier và Gate A/B/C trước khi mutate dữ liệu. Script cleanup conversion đã chạy transaction rollback trên `ipc_lane1`: 0 target và 0 invalid row còn lại.

## Ghi chú vận hành

- Đã xoá database staging `ipc_lane1_clone_27184` do lần clone hết dung lượng để lại; database này là artifact tạm và không thể phục hồi, dữ liệu nguồn/template không bị xoá.
- npm cache cũ trên C được xoá (cache tái tạo được) và cache tương lai chuyển sang `D:\npm-cache`; ổ C tăng từ 0 lên khoảng 1,6 GB trống.
- Browser tích hợp không có phiên khả dụng trong lần verify; dashboard được xác minh qua endpoint HTTP và report asset thực tế.
