<!-- generated-by: gsd-doc-writer -->
# Phát triển

## Thiết lập local

```bash
git clone https://github.com/Peaker04/IPCManagement.git
cd IPCManagement
npm install
dotnet restore backend/src/IPCManagement.Api/IPCManagement.Api.csproj
```

Tạo cấu hình local từ các file mẫu trong `backend/src/IPCManagement.Api/`, tạo file env local cho frontend khi cần override API base URL, rồi chạy `npm run be` và `npm run fe`. Không commit file cấu hình backend có credential thật hoặc các file `.env` local.

## Build và scripts

Các script root trong `package.json`:

| Command | Mô tả |
|---|---|
| `npm run fe` | Chạy Vite frontend workspace. |
| `npm run be` | Chạy ASP.NET Core API. |
| `npm run build:be` | Build project backend. |
| `npm run gen:api` | Build API và regenerate OpenAPI + TypeScript contract. Binary tạm nằm trong `.artifacts/contract-build/api` để không xung đột với API Release đang chạy. |
| `npm run check:api-contract` | Regenerate contract và fail nếu `openapi.json` hoặc `schema.ts` bị drift. |
| `npm run test:be` | Chạy toàn bộ solution test backend. |
| `npm run test:be:coverage` | Chạy backend test với coverage. |
| `npm run coverage:be` | Xóa kết quả cũ, test backend và tạo report. |
| `npm run coverage:be:report` | Tạo HTML/text report từ Cobertura backend. |
| `npm run test:fe:unit` | Chạy Vitest unit test của frontend. |
| `npm run coverage:fe` | Chạy frontend unit test với coverage. |
| `npm run lint:fe` | Chạy ESLint cho frontend. |
| `npm run build:fe` | Type-check và build frontend Vite. |
| `npm run test:architecture-growth` | Chạy regression matrix cho comparator growth baseline. |
| `npm run check:architecture-growth` | Strict gate: cấm test debt, production debt mới/tăng và baseline không co khi nợ giảm. |
| `npm run verify` | Regression + strict growth gate, build/test backend, unit test/lint/dependency/build frontend. |
| `npm run verify:coverage` | Chạy coverage cho backend và frontend. |
| `npm run benchmark:workflow` | Chạy backend test có category `Performance`. |
| `npm run verify:release` | Gọi quality-gate PowerShell script được khai báo trong `package.json`; kiểm tra script đích trước khi chạy. |
| `npm run verify:release:audit` | Audit-only quality gate được khai báo trong `package.json`; kiểm tra script đích trước khi chạy. |
| `npm run e2e:happy` | Gọi happy-path E2E script được khai báo trong `package.json`. |
| `npm run e2e:exceptions` | Gọi exception-path E2E script được khai báo trong `package.json`; kiểm tra script đích trước khi chạy. |
| `npm run commitlint` | Kiểm tra commit message theo Conventional Commits. |

Frontend workspace có thêm các script `dev`, `build`, `lint`, `preview`, `test:unit`, `test:unit:watch`, `test:coverage`, `test:smoke`, `test:controls`, `test:ui-audit`, `test:performance`, `test:visual` và `test:visual:update`; chạy chúng từ `frontend/`.

Khi thêm network action, giữ một request owner: query dùng cùng RTK endpoint + normalized args; mutation
không tự gọi trong `onChange` và phải có trạng thái draft/commit rõ (thường commit ở blur, Enter hoặc nút
xác nhận). Không bỏ `StrictMode` để che double call. Exact mutation đang in-flight được `apiSlice` bảo vệ
toàn cục, nhưng component vẫn phải khóa double-submit để không chạy hai lần feedback, download hoặc local
state transition. Direct `fetch` ngoài RTK Query phải có synchronous in-flight guard riêng.

## Shipyard lane

Profile cục bộ nằm tại `shipyard/profiles/IPCManagement`. Khởi động dashboard/lane từ repo
Shipyard bằng `bin/dashboard.sh start 8090` và `bin/lane-up.sh 1 --qc`; chạy E2E bằng
`bin/lane-e2e.sh 1`. Profile ánh xạ lane 1 sang FE `3001`, API `8001` và database
`ipc_lane1` theo cấu hình Shipyard local. Khi chỉ cần làm sạch dữ liệu E2E, gọi hook reset
của profile; không chạy `lane-reset.sh` vì lệnh đó còn reset Git của lane.

Trước khi test, đối chiếu commit/working tree của checkout lane với source thật và gọi
`/health/ready` để xác nhận database/migration. Không coi lane cũ là runtime đúng chỉ vì
port đang listen. Nếu checkout lane có thay đổi chưa commit, không reset/ghi đè; xem
`MEMORY.md` để biết lane hiện boot từ checkout nào và DB nào. Mọi lần đồng bộ
database lane từ database chính phải backup cả source/target và so exact row count + checksum
trước khi chạy app; không dùng seed/reset để che schema hoặc dữ liệu cũ.

### Đồng bộ migration local

`ipcmanagement` là base đích cuối, không phải rehearsal lane. Mọi schema/data correction phải chạy
trước trên database mutation được phê duyệt (hiện là `ipc_lane9`) với checkpoint, reviewed SQL,
postflight và rollback evidence. Chỉ khi rehearsal pass mới áp **đúng cùng SQL/reconciliation script**
lên `ipcmanagement`, sau một checkpoint riêng; không clone/restore cả lane đè lên base và không dùng
`dotnet ef database update` trực tiếp trên base như bước thử đầu tiên.

Clone bằng `IPCManagement.DatabaseTool` phải giữ nguyên table definition từ `SHOW CREATE TABLE`,
foreign key và trigger. Verification phải fail-closed khi migration history cho biết schema object
do migration sở hữu nhưng clone bị thiếu. `ipc_lane1` là protected/read-only: không migrate, reset,
seed, restore hoặc import trong quy trình này.

`/health/ready` trả `Unhealthy`/HTTP 503 khi còn pending migration hoặc không đọc được migration
history. Không tiếp tục test endpoint khi readiness chưa `Healthy`; xử lý migration trước để tránh
EF model mới query bảng/cột chưa tồn tại và tạo chuỗi HTTP 500.

## Code style

- TypeScript dùng strict-like checks trong `frontend/tsconfig.app.json`, gồm `noUnusedLocals`, `noUnusedParameters` và `noFallthroughCasesInSwitch`.
- ESLint flat config nằm ở `frontend/eslint.config.js`; chạy `npm run lint` từ `frontend/` hoặc `npm run lint:fe` từ root.
- Vite alias `@/*` trỏ tới `frontend/src/*`; ưu tiên alias này trong module frontend khi phù hợp.
- Chưa phát hiện cấu hình Prettier/Biome trong repo; không tự thêm formatter mới nếu task không yêu cầu.

## Skill routing cho contributor và phiên chat

Chọn skill theo loại yêu cầu, không theo tên file ngẫu nhiên:

GitNexus là công cụ **opt-in**. Chỉ dùng các skill GitNexus, MCP hoặc CLI GitNexus
khi người yêu cầu nói rõ cần GitNexus/impact/context/detect_changes/blast-radius.
Các task còn lại không cần kiểm tra index hay chạy GitNexus; dùng source, test và
skill GSD phù hợp.

| Yêu cầu | Skill (Claude Code) | File gốc (Codex) |
|---|---|---|
| Hiểu architecture, call flow, module hoặc dependency | `Skill("gitnexus-exploring")` | `~/.claude/skills/gitnexus-exploring/` |
| Trace bug hoặc giải thích lỗi | `Skill("gitnexus-debugging")` | `~/.claude/skills/gitnexus-debugging/` |
| Đánh giá blast radius trước khi sửa symbol | `Skill("gitnexus-impact-analysis")` | `~/.claude/skills/gitnexus-impact-analysis/` |
| Rename, extract, split, move hoặc restructure | `Skill("gitnexus-refactoring")` | `~/.claude/skills/gitnexus-refactoring/` |
| Review PR, đánh giá rủi ro merge | `Skill("gitnexus-pr-review")` | `~/.claude/skills/gitnexus-pr-review/` |
| Security review, taint source→sink | `Skill("gitnexus-taint-analysis")` | `~/.claude/skills/gitnexus-taint-analysis/` |
| GitNexus CLI/index/status/wiki | `Skill("gitnexus-cli")` | `~/.claude/skills/gitnexus-cli/` |
| Viết/review/refactor code nói chung | `Skill("karpathy-guidelines")` | `.codex/skills/karpathy-guidelines/SKILL.md` |
| React/shadcn/Tailwind component hoặc responsive UI | `Skill("ui-styling")` | `.codex/skills/ui-styling/SKILL.md` |
| SAP Fiori template/range/validation/diagnostics | `Skill("sketch-findings-ipcmanagement")` | `.codex/skills/sketch-findings-ipcmanagement/SKILL.md` |
| Tra cứu pattern/heuristic UX | `Skill("ui-ux-pro-max")` | `.codex/skills/ui-ux-pro-max/SKILL.md` |
| Design tokens và component states | `Skill("design-system")` | `.codex/skills/design-system/SKILL.md` |
| Brand voice/identity/messaging | `Skill("brand")` | `.codex/skills/brand/SKILL.md` |
| Logo, corporate identity hoặc nhiều loại design asset | `Skill("design")` | `.codex/skills/design/SKILL.md` |
| Banner/cover/hero/social creative | `Skill("banner-design")` | `.codex/skills/banner-design/SKILL.md` |
| Slide deck hoặc presentation chiến lược | `Skill("slides")` | `.codex/skills/slides/SKILL.md` |

Skill dự án dùng chung một bản file: `.claude/skills/<name>` là directory junction trỏ về `.codex/skills/<name>`, nên sửa trong `.codex/skills/` có hiệu lực cho cả Claude Code và Codex. Nhóm skill GitNexus do `gitnexus setup -c claude` cài vào `~/.claude/skills/` (ngoài repo, không sửa tay).

Khi task UI liên quan SAP Fiori/template/range/diagnostics, dùng `sketch-findings-ipcmanagement` trước rồi `ui-styling` để implement. Khi task vừa trace vừa sửa code, chỉ dùng GitNexus exploration/debugging và impact nếu người yêu cầu đã chỉ định GitNexus; nếu không, dùng source/test và sau đó áp dụng Karpathy guidelines để implement. Các phiên chat đọc `AGENTS.md` để áp dụng routing đầy đủ và cập nhật tài liệu sau thay đổi đáng kể.

## Browser-use trên lane local

Helper hiện hành nằm tại `.artifacts/shipyard-live/current-runtime-desktop-audit.mjs`.
Chạy từ project root sau khi FE/API/Shipyard và `/health/ready` đã xanh:

```powershell
$env:K6_PASSWORD = '<credential hien tai; khong commit>'
node .artifacts/shipyard-live/current-runtime-desktop-audit.mjs
Remove-Item Env:K6_PASSWORD
```

Helper dùng Playwright từ `node_modules/@playwright/test`, mở Google Chrome `headless: false`,
đi thẳng vào FE lane thật và đăng nhập bằng credential đã xoay. Port, lane và ma trận
viewport hiện hành chỉ lấy từ `MEMORY.md`; không dùng mock login/API hoặc snapshot cũ để kết luận pass.

Evidence Phase 18 và SHA authoritative nằm trong `docs/EVIDENCE-INDEX.md`. Kiểm tra artifact read-only
từ project root bằng `scripts/Assert-Phase18Evidence.ps1`; lấy expected lane/viewport từ `MEMORY.md`.

Không chạy lại `Invoke-Phase18LaneE2E.ps1`, sanitizer hoặc weekly import chỉ để tái kiểm tra lượt đã hoàn tất:
`ipc_lane1` đang giữ chính transition/evidence đó. Một lượt mới phải có authorization riêng, database identity
guard, backup/checksum mới và exact workbook hash trước mutation.

`agent-browser` executable không có trong PATH ở lần kiểm tra ngày 27/07/2026 nên helper
Playwright là fallback đã xác minh. Helper tạo controlled Chrome context riêng; Chrome bình thường
đang mở không thể attach nếu không được khởi động với remote-debugging/CDP.

## Branch conventions

`CONTRIBUTING.md` và `.husky/pre-commit` quy định branch dùng chữ thường, số, `-`, `_`, `.` với các prefix `feature/`, `fix/`, `hotfix/`, `release/`, `chore/`, `docs/`, `refactor/`; branch đặc biệt là `main` và `develop`.

## PR process

- Tạo branch đúng pattern và giữ scope thay đổi nhỏ, có thể review.
- Chạy test/lint/build phù hợp; với thay đổi liên luồng dùng `npm run verify`.
- Commit theo Conventional Commits; `commit-msg` hook gọi `commitlint`.
- Tạo PR vào `develop` theo workflow trong `CONTRIBUTING.md`; hotfix có thể bắt đầu từ `main`.
- Khi sửa code hoặc route, cập nhật docs liên quan và báo rõ kiểm chứng đã chạy.
