# Wave 0 closeout — inventory và table contract

Ngày: 2026-08-21  
Commits: `d9edd6d5`, `ceb5ab7c`, `be307c90`

## Scope delivered

- [x] Inventory 32 table surface trong `docs/TABLE-INVENTORY.md`.
- [x] Machine-readable contracts trong `docs/table-contracts.json`.
- [x] Mỗi contract có grain, row key, owner, pagination và primary status.
- [x] Test source-backed contract trong `frontend/tests/tableContracts.test.ts`.
- [x] Registry stale của các surface đã loại bỏ đã được xử lý ở các commit liên quan.
- [x] Common table chưa có owner duy nhất được giữ lại và đánh dấu `consumer-dependent`, không xoá đoán mò.

## Verification evidence

| Gate | Kết quả | Evidence |
|---|---|---|
| JSON parse + source path | PASS | `tableContracts.test.ts`, 32/32 contract |
| Contract test | PASS | 1 test file, 1 test |
| Production TypeScript/Vite build | PASS | `npm run build` |
| Commit-scoped whitespace | PASS | `git show --check d9edd6d5`, `ceb5ab7c`, `be307c90` |
| Repository-wide whitespace | EXCEPTION | Chỉ có dirty changes ngoài scope: `docs/GLOSSARY.md:26-27`, `frontend/src/features/admin/pages/ApprovalRulesPage.tsx:71,490` |

## Exception disposition

Whitespace exception không thuộc các file Wave 0 và đã tồn tại trong working tree trước khi Wave 0 chỉnh sửa. Không sửa tự động để tránh làm mất thay đổi người dùng. Owner là phiên thay đổi sở hữu các file đó; khi owner đóng phần việc, chạy lại `git diff --check` toàn repo.

Exception này không làm mất tính đúng của artifact Wave 0 vì mọi commit Wave 0 đều pass `git show --check` và build/test độc lập.

## Go decision

**WAVE 0 CLOSED — GO TO WAVE 1**

Điều kiện sang Wave 1:

- Wave 1 không được phụ thuộc vào việc sửa hai file exception.
- Nếu Wave 1 chạm vào `ApprovalRulesPage.tsx` hoặc `GLOSSARY.md`, phải xử lý whitespace exception trong cùng commit và chạy lại repo-wide check.
- Mọi table contract mới phát hiện trong Wave 1 phải cập nhật `table-contracts.json` và test trước khi merge.

