---
quick_id: 260721-stw
status: complete
date: 2026-07-21
description: Hoàn thiện Shipyard MySQL template restore, lane dashboard evidence, BOM canonical 25/30/34k, regression, commit và push
---

# Quick Task 260721-stw Plan

## Goal

Shipyard có thể tự tạo/restore `ipc_e2e_template`, chạy lane E2E và xuất evidence mà không cần MySQL CLI/Docker/WSL; workbook BOM 25k/30k/34k được dry-run theo safety gate; chỉ các thay đổi thuộc phạm vi mới được commit/push.

## Task 1: Durable MySQL template lifecycle

- **Files:** `backend/tools/IPCManagement.DatabaseTool/*`, `shipyard/profiles/IPCManagement/hooks/create-template.sh`, `shipyard/profiles/IPCManagement/hooks/reset.sh`
- **Action:** Thêm .NET database clone tool giới hạn tên DB IPC, bỏ phụ thuộc `mysql`/`mysqldump`, fail closed khi source/target không hợp lệ; hook chỉ clone lane↔template.
- **Verify:** Unit test validation; clone lane→template→lane; so sánh 56 bảng, row counts, supplier/conversion fingerprint.
- **Done:** Hai hook chạy idempotent bằng `dotnet run` và không lộ connection secret.

## Task 2: Lane workflow and canonical BOM dry-run

- **Files:** `shipyard/profiles/IPCManagement/hooks/{boot,bootstrap,ci-gate,e2e,health}.sh`, profile config, evidence under `.artifacts/`
- **Action:** Căn chỉnh profile với repo .NET/Vite, khởi tạo lane 1, restore template, boot, CI gate, importer/E2E hai vòng và dashboard evidence. Audit workbook `IPC. Định lượng 07.2026.xlsx`; chỉ dry-run/phân loại vì destructive apply còn bị Gate A/B/C chặn.
- **Verify:** Dashboard Vitest, backend/frontend tests, health HTTP 200, E2E 2/2, dry-run không đổi DB fingerprint.
- **Done:** Dashboard có lane/evidence thật; báo cáo BOM nêu rõ blockers và không mutate DB.

## Task 3: Scope gate, atomic commits and publish

- **Files:** chỉ các file thuộc task; không stage `README.md`, `frontend/README.md`, `.cursor/` nếu không thuộc thay đổi này.
- **Action:** Chạy GitNexus `detect_changes`, test gates, tách commit theo database tool, importer/cleanup, Shipyard profile, GSD evidence; push `feature/production-plan`.
- **Verify:** `git diff --cached --name-only` khớp allowlist; remote branch trỏ đúng commit local.
- **Done:** Commit/push thành công, dirty files của người dùng được giữ nguyên.
