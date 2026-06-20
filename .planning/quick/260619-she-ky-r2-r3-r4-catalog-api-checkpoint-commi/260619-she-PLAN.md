---
status: in_progress
created: 2026-06-19
---

# Quick Task: Kỳ R-02/R-03/R-04 Catalog API and SampleData Production Guard

## Muc tieu

Thuc hien residual task cua Ky theo tracker: checkpoint worktree hien tai, bo sung `GET /api/dishes/catalog` co BOM/menu-slot detail, va khoa SampleData API o Production bang 404.

## Pham vi

1. Preflight GSD/GitNexus: ghi nhan `node .gitnexus/run.cjs status`, dirty worktree, va mismatch giua `STATE.md` Phase 02 complete voi `ROADMAP.md` 1/6.
2. R-03: chay verify hop ly tren dirty source hien tai, commit checkpoint source hien co, khong stage file Excel lock hoac artifact GSD moi.
3. R-02: them catalog DTO/service/repository/controller cho `GET /api/dishes/catalog`, include `Dishboms -> Ingredient -> Unit` va `Menuitems`.
4. R-04: them Production pre-auth guard de `/api/sample-data` tra 404, giu controller guard Development nhu defense-in-depth.
5. Verification: backend build/test, frontend build/lint neu kha thi, GitNexus refresh/status, search audit, va commit code + GSD artifacts rieng.

## Critical Gates

- Neu GitNexus stale thi phai `node .gitnexus/run.cjs analyze` truoc khi tiep tuc code.
- Neu verify checkpoint hien trang fail do loi nghiem trong thi dung va phan tich, khong commit che loi.
- Khong xoa `DEV_FALLBACK_DISHES` hoac wire frontend trong slice nay.
- Khong sua `ROADMAP.md` mismatch trong slice nay tru khi GSD block.
