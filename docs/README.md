---
title: IPCManagement Documentation Map and Governance
status: canonical-index
scope: repository-documentation
owner: GSD
last_reviewed: 2026-09-02
---

# Documentation map and governance

Đây là **điểm vào duy nhất** để chọn tài liệu cho một task. File này không thay thế `AGENTS.md` hoặc
`MEMORY.md`; nó ngăn việc một audit/checklist cũ bị dùng nhầm như contract hiện hành.

## 1. Startup tối thiểu

1. Đọc `AGENTS.md`.
2. Auto-load duy nhất `MEMORY.md`, rồi đối chiếu với code/runtime và `git status --short --branch`.
3. Chọn lane tại [`LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md`](LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md).
4. Chỉ mở tài liệu canonical đúng loại việc trong bảng dưới.
5. Chỉ mở phase/evidence/history khi task hiện hành thật sự cần chúng.

Không auto-load `HISTORY.md`, `LESSONS.md`, toàn bộ `docs/`, `.planning/` hoặc `.artifacts/`.

## 2. Authority map

| Nhu cầu | Nguồn canonical | Không dùng thay thế |
|---|---|---|
| Trạng thái, runtime, lane, blocker, bước tiếp theo | `MEMORY.md` | Summary/verification cũ, session transcript |
| Quy trình delivery/debug và mức L0/L1/L2 | [`LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md`](LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md) | Plan template hoặc agent fan-out tự phát |
| Domain và grain dữ liệu | [`DOMAIN.md`](DOMAIN.md), [`DATA-GRAIN-MATRIX.md`](DATA-GRAIN-MATRIX.md) | Tên UI, table name hoặc fixture |
| Kiến trúc hệ thống | [`ARCHITECTURE.md`](ARCHITECTURE.md) | Audit/redesign có ngày trong tên |
| UI normative rules | [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md) | Screenshot, wave audit, checklist lịch sử |
| UI floorplan/surface/geometry | [`DESIGN.md`](DESIGN.md) | CSS page-local hoặc mockup |
| Điểm vào UI project-specific | [`UI-PHILOSOPHY.md`](UI-PHILOSOPHY.md) | Corpus checklist bên ngoài |
| Quy trình audit/fix/browser UI | [`UI-UX-EXECUTION-HARNESS.md`](UI-UX-EXECUTION-HARNESS.md) | Script run cũ hoặc reviewer summary |
| Oracle và metric UI | [`UI-UX-MEASUREMENT-PROTOCOL.md`](UI-UX-MEASUREMENT-PROTOCOL.md) | Screenshot đơn lẻ, `issueCount: 0` generic |
| Adapter Front-End Checklist | [`FRONT-END-CHECKLIST-INTEGRATION.md`](FRONT-END-CHECKLIST-INTEGRATION.md) | Rule project hoặc scope generator |
| FE → API → DB → reload | [`UI-UX-FE-BE-DATABASE-STANDARDIZATION.md`](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md) | API-only/BE-only PASS |
| Setup/dev/test/config/deploy | [`GETTING-STARTED.md`](GETTING-STARTED.md), [`DEVELOPMENT.md`](DEVELOPMENT.md), [`TESTING.md`](TESTING.md), [`CONFIGURATION.md`](CONFIGURATION.md), [`DEPLOYMENT.md`](DEPLOYMENT.md) | Command trong log/session cũ |
| Evidence hash/index | [`EVIDENCE-INDEX.md`](EVIDENCE-INDEX.md) | Hash copy trong memory/plan |
| Trạng thái phase đang mở | `.planning/phases/<phase>/` do GSD sở hữu | Docs root hoặc orchestrator thứ hai |
| Lịch sử đã đóng | `HISTORY.md`, `docs/archive/` | Trạng thái hiện hành |

## 3. Phân lớp tài liệu

### Canonical

Có `status: canonical-*` hoặc `adopted-*`, mô tả contract/process đang áp dụng. Sửa code làm contract thay đổi
thì cập nhật cùng task. Một số liệu trạng thái chỉ được khai ở đúng owner của nó.

### Reference/runbook

Giải thích setup, architecture, domain, testing, deployment hoặc vận hành. Được mở theo nhu cầu, không tự tạo
verdict PASS/FAIL hiện hành.

### Planning/evidence

`.planning/` là state do GSD sở hữu; `.artifacts/` là output kiểm chứng. Không copy nguyên nội dung sang `docs/`.
Hash authoritative chỉ nằm trong `EVIDENCE-INDEX.md`.

### Historical/archive

Audit, research, checklist và wave closeout theo thời điểm không còn execution authority phải nằm dưới
`docs/archive/` hoặc được chuyển thành mục lịch sử. Chúng chỉ dùng để điều tra quyết định cũ. Nếu mâu thuẫn,
ưu tiên code/runtime, `MEMORY.md` và contract canonical hiện hành.

## 4. Quy trình tài liệu cho một thay đổi

1. Khai scope và owner trước khi sửa; không tạo tài liệu mới nếu file canonical hiện có sở hữu nội dung.
2. Fact-check bằng source/test/runtime. Session và subagent summary chỉ là đầu mối, không phải bằng chứng.
3. Sửa file canonical nhỏ nhất; liên kết thay vì copy rule, số liệu, hash hoặc trạng thái.
4. Khi việc đóng, xóa trạng thái active khỏi `MEMORY.md` và append kết quả bền vững vào `HISTORY.md`.
5. Nếu artifact mới có giá trị kiểm chứng, đăng ký đúng metadata/hash trong `EVIDENCE-INDEX.md`.
6. Chạy link check, secret/stub scan theo scope và `git diff --check`.

## 5. Tiêu chí tạo file mới

Chỉ tạo file mới khi có **owner và vòng đời riêng** mà tài liệu hiện có không thể chứa hợp lý. Không tạo:

- thêm một process song song với Lean standard hoặc UI harness;
- thêm checklist route/wave ở `docs/` khi phase checklist đã tồn tại;
- thêm `*-AUDIT-<date>.md` vào root docs cho output dùng một lần;
- copy rule UI vào plan, memory hoặc checklist;
- copy gate hiện hành ra ngoài `MEMORY.md`;
- copy hash ra ngoài `EVIDENCE-INDEX.md`.

Output dùng một lần đi vào `.artifacts/`; state công việc đi vào `.planning/`; lịch sử bền vững đi vào
`HISTORY.md` hoặc `docs/archive/`.