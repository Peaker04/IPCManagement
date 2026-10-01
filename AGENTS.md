# IPCManagement — agent entry contract

## Bắt đầu mọi task

1. Đọc file này → `MEMORY.md`; chạy `git status --short --branch`, `git rev-parse HEAD`, `git diff --cached --name-only`.
2. Phân biệt **task mới** với **resume**. Resume đúng checkpoint MEMORY trỏ tới; task mới không tự tiếp tục campaign cũ. Source/runtime thắng narrative cũ nhưng không hợp pháp hóa behavior trái contract.
3. Đọc [workflow entry](docs/harness/README.md), chọn L0/L1/L2 theo [DELIVERY](docs/harness/DELIVERY.md); dùng [documentation map](docs/README.md) để mở đúng owner theo task. Không duyệt đệ quy mọi link.
4. Trước edit, chốt goal, allowed files, ngoài scope, owner/contract, acceptance/check command và quyền còn thiếu. GSD `.planning/` là nơi duy nhất giữ checklist; MEMORY chỉ giữ pointer/runtime. Không bắt Kỳ kể lại chat đã có checkpoint.

Không auto-load HISTORY, LESSONS, toàn docs/planning/evidence/skill catalog. Riêng migration, restore hoặc browser measurement phải đọc `LESSONS.md`; trước đụng DB lane phải đọc lineage/evidence liên quan.

## Ranh giới không được rút gọn

- **Pi CLI duy nhất.** Codex API/model trong Pi không phải Codex app/CLI. MCP/codemode chỉ dùng khi live, được cấu hình, trusted và task cho phép; registry runtime khác không chuyển sang Pi. Codex/Claude CLI chỉ khi Kỳ yêu cầu riêng. Adapter: [RUNTIMES](docs/harness/RUNTIMES.md).
- **GSD duy nhất sở hữu process/state.** Shipyard/skills/Ponytail không tạo task system khác. Một checklist/ledger mỗi objective, một writer mỗi cwd. Mặc định làm trực tiếp; chỉ delegate khi user/instructions áp dụng cho phép, không vì task lớn.
- Giữ nguyên inherited dirt. Không tự commit/push, reset/restore, seed, đổi operation mode, schema/data mutation hoặc cleanup phá hủy. Auto-ship từ skill không phải authorization. Trước sửa dirty owner phải backup và kiểm conflict theo [MAINTENANCE](docs/harness/MAINTENANCE.md).
- Không giả định DB lane rỗng; không tạo account/credentials/BOM/inventory/lineage/business record để lấy PASS. Giữ DEFAULT/MATERIAL_RECONCILIATION tách biệt theo [MRX contract](docs/domain/material-reconciliation.md).
- Không đưa secrets/token/connection string thật/personal data vào docs/report; chỉ đọc config metadata cần thiết, không dump auth/environment.
- Không rename bằng blind find-and-replace. Kiểm callsites/language semantics. Code thay đổi phải cập nhật relevant docs cùng task; không bỏ validation, data-loss handling, security, accessibility hoặc business invariants.
- **GitNexus opt-in:** không MCP/CLI/index/graph evidence trừ khi Kỳ yêu cầu GitNexus/impact/blast radius/context/detect_changes cho task này. Khi đó đọc [policy](docs/GITNEXUS-POLICY.md) trước call, đánh giá final diff theo branch và cảnh báo HIGH/CRITICAL. Tool thiếu là limitation, không giả evidence.

## Đọc theo loại việc, không nạp tất cả

- Bảng skill bắt buộc có một owner: [DELIVERY §3](docs/harness/DELIVERY.md#3-skill-routing-tối-thiểu); đường dẫn và runtime mapping: [RUNTIMES §3](docs/harness/RUNTIMES.md#3-skill-surface-and-selection). Đọc SKILL.md đã chọn trước áp dụng. Pi dùng `read` hoặc `/skill:name`, không gọi `Skill/Task/Agent/spawn_agent` giả.
- Code/review: `karpathy-guidelines`; bug runtime/lặp: thêm `diagnosing-bugs`; regression: `tdd`; mọi test write/change/review/sweep: `test-audit`. Chọn tối đa ba discipline cho L0/L1 ngoài GSD/Ponytail; nếu mandatory domain coverage vượt thì nêu lý do, không nới scope.
- UI: đọc [UI execution harness](docs/UI-UX-EXECUTION-HARNESS.md), [DESIGN](docs/DESIGN.md), [normative rules](docs/DASHBOARD-UI-RULES.md) và [checklist adapter](docs/FRONT-END-CHECKLIST-INTEGRATION.md); áp dụng `frontend-checklist-global`, thêm `ui-styling` khi implement React/shadcn/Tailwind, `sketch-findings-ipcmanagement` cho Template Studio/range/diagnostics.
- Trước JSX/layout/CSS: SOURCE LOCK + DESIGN LOCK trong checklist theo DELIVERY §4. Truy xuất DOMAIN, DATA-GRAIN-MATRIX, matching domain contract và live route/capability/query/mutation owners. Specimen chỉ cho visual grammar, không tạo fact/navigation/role/workflow mới. Thiếu lock ⇒ `NO_EDIT`.
- Ponytail `full` cho non-visual, `lite` cho UI component/layout; frontend `ultra` chỉ khi Kỳ yêu cầu non-visual cleanup hẹp. DESIGN quyết định; Fiori, existing shadcn/Base UI/Tailwind và IPC Taste chỉ là bounded lenses. Full Taste/Pro Max không phải router; giữ source hidden, không tự xóa. Các skill asset/prose chỉ đọc đúng scope.
- Docs/rules: `gsd-docs-update` discipline inline cho bounded task; harness maintenance đọc project `harness-maintenance`. `qa` chỉ thu thập issue. External `handoff` chỉ tạo draft OS-temp, GSD parent fact-check rồi promote. `implement`, `to-spec`, `to-tickets`, `triage`, `wayfinder`, `ask-matt`, Claude-only routers và Shipyard orchestration không phải execution path; không tự bật installer/disabled agents.

## Browser và hoàn tất

- Browser phải Chrome headed vào app URL thật; xác minh FE/BE listener/build, authenticated mode/version/capabilities và credential source trước action. Không dùng password cũ/default, không đổi mode; mobile/tablet chỉ khi được yêu cầu.
- Khi agent-browser không có, dùng `.artifacts/shipyard-live/live-visual-audit.mjs` từ root, profile riêng `.artifacts/browser-use-visual-audit`; không đụng user tabs nếu chưa attach/CDP. Refresh locator sau DOM/navigation; helper fail phải kiểm timestamp/content `live-visual-audit-error.txt`. Chỉ dừng process do run tạo. DevTools là diagnostic, không thay Playwright gate.
- Screenshot là candidate phải chuyển thành DOM/source oracle. Broad page audit phải inventory mọi captured state trước fix và mở từng ảnh sau fix; một defect xanh không đóng page. Tuân theo UI harness; mutation cần FE control → BE request → DB transition → reload. Evidence immutable; performance claim cần metric thật, không lấy DEV-only làm production proof.
- Dùng `PASS / FAIL / NEEDS_EVIDENCE / BLOCKED` cho từng claim. Tách tool/parser completion, test result và task acceptance; không nâng focused check thành whole-product PASS.
- Checkpoint sau bước verified và trước command dài/context switch theo [DELIVERY §10](docs/harness/DELIVERY.md#10-ngân-sách-context-và-subagent). Ghi current goal, HEAD/status/index, task-owned vs inherited paths, checks/evidence/limits, owned processes, blockers và đúng next action. Không đoán token limit; không tự resume campaign paused. Fresh session không kế thừa chat chưa persist.
- HISTORY giữ completed work; evidence hash chỉ ở `docs/EVIDENCE-INDEX.md`. Cleanup phải đọc full source + consumer/backlink + disposition map; giữ compatibility/evidence/history nếu chưa có đủ gate. Không xóa chỉ vì file cũ hoặc không được load lúc startup.
