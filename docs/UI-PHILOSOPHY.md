---
title: IPCManagement UI/UX authority index
status: reference-index
scope: frontend
owner: IPCManagement
---

# UI/UX: tìm đúng owner

File này **chỉ định tuyến**, không đặt token, rule hay workflow thứ hai. Trước JSX xác minh domain/actor/state/data safety rồi chọn owner. Đây là retrieval gate, không phải lời nhắc tùy chọn: với một page/workspace, session phải nạp luồng trước–sau, grain, source-of-truth precedence, actor/mode/capability, decision của người dùng và consumer hạ nguồn từ owner hiện có; ghi packet/link ngắn vào active GSD checklist trước khi dùng specimen hoặc component source. Không tái khám phá từ đầu nếu knowledge đã có, và không lấy field dễ truy cập thay cho fact phục vụ quyết định.

| Câu hỏi | Authority / implementation | Verification |
|---|---|---|
| Ai, mode nào, work object/grain, action và data safety? | [DOMAIN](DOMAIN.md), [DATA-GRAIN-MATRIX](DATA-GRAIN-MATRIX.md), [Weekly Menu](domain/weekly-menu-contract.md), [Warehouse](domain/warehouse-contract.md), [MRX](domain/material-reconciliation.md); backend là permission/mutation authority | [FE–API–DB contract](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md) |
| Product character, target token, navigation intent, floorplan, state, responsive? | [DESIGN](DESIGN.md) — target khác CURRENT mounted routing; không lấy specimen làm production code | [UI harness](UI-UX-EXECUTION-HARNESS.md) |
| Normative MUST/SHOULD/MAY và rule IDs `P/D/L/S/T/M/C/F/E/I/A/N/V/Q`? | [DASHBOARD-UI-RULES](DASHBOARD-UI-RULES.md); [Front-End Checklist adapter](FRONT-END-CHECKLIST-INTEGRATION.md) chỉ bổ sung coverage | [Measurement oracles](UI-UX-MEASUREMENT-PROTOCOL.md) |
| Quyết định PB/PF đã duyệt, còn unresolved? | [UI-CONFORMANCE-MATRIX](UI-CONFORMANCE-MATRIX.md), không suy ra pixel/quota mới; nguồn audit là provenance, không phải live PASS | Test/render đúng claim |
| Token/primitives đang chạy ở HEAD? | [CSS entry](../frontend/src/styles/index.css), `frontend/src/components/ui/` và `frontend/src/components/common/`; [Phase 01.4 token reference](ui-ux/ipc-design-tokens.md) là legacy, không phải target authority | Source + affected consumers |
| Thực hiện và lưu bằng chứng thế nào? | [Lean delivery](harness/DELIVERY.md), [UI execution harness](UI-UX-EXECUTION-HARNESS.md); GSD `.planning/` giữ task state | [Measurement protocol](UI-UX-MEASUREMENT-PROTOCOL.md), test/browser/evidence |

Lịch sử [PA audit](PA-STATE-ACTION-PERMISSION-AUDIT.md), [PB audit](PB-UI-VARIANT-AUDIT.md) và [systemic audit](ui-ux/SYSTEMIC_FE_UI_UX_AUDIT.md) **không** là nguồn trạng thái/quyền hiện hành. Khi có mâu thuẫn: ưu tiên data safety → accessibility → layout stability → performance → visual consistency; kiểm source/runtime, ghi phần chưa giải quyết vào GSD checkpoint, không tự suy PASS hoặc tạo quyền mới.
