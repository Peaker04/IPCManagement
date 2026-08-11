# Checklist chuẩn hóa typography helper

> Trạng thái: **COMPLETE — 11/08/2026**. Foundation/helper/self-host, component và feature migration, static gates, before/after comparison, focus, local-only/CSP và headed gate đã hoàn tất. Đây không phải state artifact của GSD.  
> Process: tự brainstorm từ source hiện hành và [research nguồn chính thức](./research/typography-helper-primary-sources-2026-08-11.md); không dùng GSDCore, không tạo file trong `.planning/`.  
> Mục tiêu: CSS token là source of truth; caller chỉ học một interface `typography` nhỏ, có kiểu và dùng class literal tĩnh.

## Implementation snapshot 2026-08-11

- Hoàn tất primitive family tokens, Tailwind semantic family/type tokens và helper typed bảy role.
- Hoàn tất migrate page/section title cùng shared alert, badge, empty state và context strip.
- Hoàn tất migrate các cỡ `14px`/`12px` có semantics rõ sang `body`, `label` hoặc `caption` ở Purchasing, Coordination, Chef, Reports và Admin Contracts.
- Arbitrary numeric sizes giảm từ baseline 73 occurrence xuống 29; mọi occurrence còn lại có owner và lý do density cụ thể trong `frontend/tests/typographyContract.test.ts`.
- Inter Variable được self-host từ dependency OFL-1.1, chỉ emit Vietnamese/Latin Extended/Latin WOFF2; Google Fonts đã gỡ.
- Unit/lint/build/dependency gate đã chạy; browser gate đã chạy trên `ipc_lane9` ở `3010/8010`, đủ năm viewport và hai reflow tương đương zoom 200%.
- Final-source gate: frontend `140/140` file, `784/784` test; ESLint, production build, dependency-cruiser và `git diff --check` pass.
- Before/after cùng điều kiện đã dùng baseline `git archive HEAD` được xác minh chưa có helper typography; component/feature migration, focus-ring, local-only và CSP font probe đều pass trong evidence comparison canonical.

## 1. Kết quả cần đạt

- [x] Toàn frontend dùng đúng một font sans owner và một font mono owner.
- [x] Loại bỏ self-reference `--font-sans: var(--font-sans)` và `--font-mono: var(--font-mono)`.
- [x] Có type scale semantic cho page title, section title, body, label, caption, code và numeric text.
- [x] Có module chung `frontend/src/lib/typography.ts`; interface chỉ là typed role lookup.
- [x] Shared/component/feature primitives đã hội tụ; 29 arbitrary numeric occurrence còn lại là density contract có owner/reason và contract chặn phát sinh mới.
- [x] Mọi ngoại lệ typography còn lại có allowlist, owner và lý do cụ thể.
- [x] Không thay đổi semantic HTML, business state, payload, route, quyền hoặc lifecycle.
- [x] Headed evidence, hash và kết luận typography được ghi tại checklist + `docs/EVIDENCE-INDEX.md`; `MEMORY.md` không bị sửa vì đây là lane non-GSD đã khóa.

## 2. Quyết định kiến trúc đã khóa

- [x] Module typography là module in-process, không có adapter hoặc dependency injection.
- [x] Seam công khai nằm ở `frontend/src/lib/typography.ts`.
- [x] Interface công khai ban đầu chỉ gồm `typography` và `TypographyRole`.
- [x] Giá trị font family, size, line-height, letter-spacing và default weight thuộc CSS tokens; TypeScript không lặp lại giá trị raw.
- [x] Helper dùng object `as const`, không cần hook, context, provider hoặc runtime state.
- [x] Không tạo wrapper `<Text>`/`<Typography>` diện rộng trong scope này.
- [x] Semantic element (`h1`–`h4`, `p`, `label`, `code`, `td`, `th`) vẫn do caller sở hữu.
- [x] `cn()` chỉ dùng để thêm color/layout/state hoặc override đã được review; helper không sở hữu màu sắc.
- [x] `font-mono` tiếp tục dành cho mã chứng từ, audit value, countdown và dữ liệu định danh cần canh cột.
- [x] `tabular-nums` là semantic modifier cho số liệu; không đổi tất cả số sang monospace.
- [x] Không thêm component vào role map; Button/Input/Badge/Card dùng component typography token semantic, giữ nguyên variant và geometry.

## 3. Interface mục tiêu

```ts
export const typography = {
  pageTitle: 'font-heading text-page-title',
  sectionTitle: 'font-heading text-section-title',
  body: 'font-sans text-body',
  label: 'font-sans text-label',
  caption: 'font-sans text-caption',
  code: 'font-mono text-code',
  numeric: 'font-sans text-body tabular-nums',
} as const

export type TypographyRole = keyof typeof typography
```

### Quy tắc interface

- [x] Mọi value là class literal hoàn chỉnh để Tailwind source scanner nhìn thấy.
- [x] Không dùng template literal như ``text-${size}``, ``font-${weight}`` hoặc lookup được tạo từ dữ liệu runtime.
- [x] Không nhận `size`, `weight`, `lineHeight` rời; caller chọn semantic role.
- [x] Không thêm role mới nếu chỉ có một caller; trước hết dùng role gần nhất và ghi ngoại lệ.
- [x] Chỉ thêm role khi có ít nhất hai caller cùng semantics và cùng geometry.
- [x] Không tạo alias trùng nghĩa như `title`, `heading`, `headerTitle`, `panelTitle`.
- [x] Role name mô tả ý nghĩa, không mô tả pixel hoặc tên feature.
- [x] Test module qua interface `typography`; không test implementation bằng cách snapshot toàn file.

## 4. Token architecture mục tiêu

### Primitive family tokens

- [x] Khai báo `--ipc-font-sans` với Inter và fallback system hiện hành.
- [x] Khai báo `--ipc-font-mono` với stack monospace hiện hành.
- [x] Không dùng tên Tailwind `--font-*` cho raw token.

### Tailwind semantic family tokens

- [x] `--font-sans: var(--ipc-font-sans)`.
- [x] `--font-heading: var(--ipc-font-sans)`.
- [x] `--font-mono: var(--ipc-font-mono)`.
- [x] Xác minh CSS build không còn custom property tự tham chiếu.

### Semantic text tokens ban đầu

| Token | Baseline ban đầu | Dùng cho |
|---|---:|---|
| `text-page-title` | `1rem / 1.25 / 700` | page heading trong shell hiện hành |
| `text-section-title` | `0.9rem / 1.25 / 700` | `SectionPanel` và panel heading |
| `text-body` | `0.875rem / 1.5 / 400` | nội dung vận hành mặc định |
| `text-label` | `0.75rem / 1.333 / 600` | field/table/context label |
| `text-caption` | `0.75rem / 1.333 / 400` | helper/meta/secondary text |
| `text-code` | `0.8125rem / 1.35 / 500` | code, ID, audit value |

- [x] Khai báo bằng Tailwind v4 `--text-*` và companion variables cho line-height/weight.
- [x] Baseline đầu tiên phải giữ geometry đang dùng; thay đổi type scale là phase riêng sau visual review.
- [x] Không tự gộp các cỡ 9/10/10.5/11/11.5/12/12.5/13/14px trong cùng patch foundation.
- [x] Letter-spacing uppercase compact được giữ tại role/caller có semantics, không áp toàn cục.
- [x] Component token chỉ được thêm khi semantic token không đủ diễn đạt component contract.

## 5. Quy tắc bắt buộc khi triển khai

### Process và scope

- [x] Không gọi GSDCore trong toàn bộ workstream này.
- [x] Không tạo/chỉnh `.planning/**`, `VERIFICATION.md`, `MEMORY.md` hoặc `HISTORY.md` trong lane non-GSD này.
- [x] Không gọi GitNexus nếu Kỳ không yêu cầu rõ ràng.
- [x] Giữ nguyên mọi thay đổi chưa liên quan trong working tree; không reset, restore hoặc format hàng loạt.
- [x] Không sửa backend, database, OpenAPI hoặc business contracts.
- [x] Không dùng find-and-replace toàn repo cho typography.
- [x] Mỗi patch chỉ có một mục tiêu: font loading, token foundation, helper, một shared primitive hoặc một feature wave.
- [x] Không trộn đổi font source với đổi type scale trong cùng patch.
- [x] Không commit nếu chưa tách được file thuộc scope khỏi thay đổi của người dùng.

### Font loading

- [x] Chỉ có một chiến lược: self-hosted; không nạp đồng thời Google-hosted.
- [x] Self-host Inter WOFF2 để bỏ network dependency đã ghi trong architecture backlog.
- [x] Dependency pin license OFL-1.1; `@font-face` khai báo variable weight `100 900` và `font-display: swap`.
- [x] **N/A:** Đã self-host nên nhánh “nếu chưa self-host” không áp dụng.
- [x] Đã xóa Google preconnect/stylesheet; local-only external-network-blocked và production CSP `font-src 'self'` đều tải Inter Variable, zero violation.
- [x] Giữ `font-synthesis: none`, font smoothing và feature settings hiện hành; bổ sung `font-optical-sizing: auto` cho variable font.

### CSS và Tailwind

- [x] CSS variables là source of truth duy nhất cho raw typography values.
- [x] Không hard-code `font-family` ngoài `@font-face`, primitive token và allowlist tạm thời.
- [x] Không dùng dynamic class fragments.
- [x] Không dùng `!important` để ép typography migration.
- [x] Không tăng specificity chỉ để thắng class cũ; gỡ owner cũ trong cùng patch.
- [x] Đã gỡ conflict weight hiện tại của `SectionPanel`.
- [x] Production build chứng minh đủ semantic utilities trong output CSS.

### React và semantics

- [x] Không đổi heading level chỉ để đạt font size.
- [x] Không bọc thêm DOM nếu helper class là đủ.
- [x] Không làm mất accessible name, label association hoặc table semantics.
- [x] Không chuyển router `Link` thành button hoặc ngược lại chỉ vì style chữ.
- [x] Không gắn typography helper vào domain model hoặc API DTO.
- [x] Không đưa color, spacing, truncate, width hoặc state tone vào `typography` map.

### Compact UI và data display

- [x] Không đổi row height, control height hoặc panel geometry có chủ đích trong workstream này.
- [x] Không tăng cỡ chữ rất nhỏ trước khi xác minh density contract SAP Fiori compact.
- [x] Không bỏ `font-mono`/`tabular-nums` khỏi mã chứng từ và số liệu cần canh cột.
- [x] Headed route data đã kiểm tra wrap tiếng Việt, chuỗi mã, số lượng/đơn vị và status badge.
- [x] Chạy đủ năm viewport và hai reflow check; không kết luận từ một screenshot.

## 6. Wave 0 — Baseline và inventory

- [x] Chụp baseline source count: file typography, arbitrary sizes, weights, `font-family`, `font-mono`, `font-heading`, `font-sans`.
- [x] Lưu danh sách exact path của arbitrary numeric sizes trong contract allowlist.
- [x] Phân loại occurrence đã migrate và 29 ngoại lệ density còn lại.
- [x] Ghi baseline research: 81 file; 76 scan cũ, 209 semibold; 112 medium; 61 bold; 17 mono. Contract numeric baseline chuẩn hóa là 73 trước migration.
- [x] Xác nhận các owner bị chồng: `SectionPanel`, `.ipc-section-title`, `.ipc-page-title`, Button/Input/Badge và shell CSS.
- [x] Đã tạo before từ baseline commit `6ab3e165` bằng `git archive HEAD`, xác minh commit chưa có `typography.ts`, và chụp cùng năm viewport/cùng lane/cùng browser.
- [x] Route gate gồm Dashboard, Weekly Menu, Meal Orders, Purchasing, Warehouse, Chef, Approvals, Reports và Admin.
- [x] Đã lưu row/control-height baseline và after metric theo từng cặp; max row delta `1.3px`, max control delta `0px`.
- [x] Baseline có thể lặp lại từ commit/hash archive được ghi trong manifest comparison, không cần reset dirty worktree.

## 7. Wave 1 — Font family foundation

- [x] Thêm primitive `--ipc-font-sans` và `--ipc-font-mono` trong `frontend/src/styles/index.css`.
- [x] Sửa `@theme inline` để map sang primitive tokens, loại bỏ self-reference.
- [x] Root/code/form tiếp tục inherit từ semantic font token phù hợp.
- [x] Thay stack mono hard-code trong `styles/components/documents.css` bằng token.
- [x] Foundation family patch không tự ý đổi size/weight/line-height.
- [x] Thêm test phát hiện self-reference và raw font-family ngoài allowlist.
- [x] Targeted test, lint, production build và visual gate đã pass.

## 8. Wave 2 — Semantic type scale

- [x] Khai báo đủ `--text-page-title`, `--text-section-title`, `--text-body`, `--text-label`, `--text-caption`, `--text-code`.
- [x] Khai báo companion line-height và font-weight cho từng token.
- [x] Dùng giá trị baseline đã khóa, chưa tăng readability ngoài scope.
- [x] Xác minh generated utilities bằng production build CSS.
- [x] Test token existence, exact role inventory và không tạo vòng tự tham chiếu.
- [x] Có `TypographyFixture` chuyên biệt khóa tiếng Việt, long ID, numeric alignment và focusable button/input; unit fixture pass.

## 9. Wave 3 — Shared helper module

- [x] Tạo `frontend/src/lib/typography.ts` đúng interface mục 3.
- [x] Export `typography` và `TypographyRole`; không export raw values.
- [x] Không thêm function nếu object lookup + `cn()` đã đủ.
- [x] Thêm unit/source-aware test khóa exact role inventory.
- [x] Test cấm template interpolation và dynamic Tailwind fragments trong helper.
- [x] Test mọi role trỏ tới class semantic có token tương ứng.
- [x] Thêm ví dụ dùng ngắn trong `frontend/README.md`.

## 10. Wave 4 — Shared primitives và shell

- [x] `.ipc-page-title` dùng semantic token owner duy nhất.
- [x] `SectionPanel` dùng `typography.sectionTitle`; conflict `font-semibold`/CSS 700 đã gỡ.
- [x] `InlineAlert`, `StatusBadge`, `EmptyState`, `ContextStrip`, `CommandBar`, `DataTableShell`, `TableViewport` và table CSS primitives dùng semantic owner.
- [x] Button/Input/Badge/Card đã dùng component typography tokens với companion line-height/weight và giữ geometry cũ.
- [x] Mọi JSX `font-mono` callsite đã migrate sang `typography.code`; raw `font-mono` chỉ còn ở helper canonical.
- [x] Giữ component-specific control typography ở component layer.
- [x] Owner cũ của các primitive đã migrate được gỡ trong cùng patch.
- [x] Common/component tests, full unit suite assertions và headed accessibility-oriented checks đã chạy.

## 11. Wave 5 — Feature migration theo lát dọc

### 5A. Weekly Menu và Coordination

- [x] Coordination và Weekly Menu dùng body/section/code/numeric roles tại page, import jobs và demand surfaces; density-only exceptions vẫn nằm trong allowlist.
- [x] Giữ density của weekly schedule, KHSX, status/action table và dialogs; 9–11px tiếp tục allowlist.
- [x] Headed gate trên `ipc_lane9` kiểm tra dữ liệu ANV có tiếng Việt, số lượng và đơn vị.

### 5B. Purchasing, Approvals và Warehouse

- [x] Purchasing, ApprovalQueue, Warehouse receipt/issue surfaces đã migrate; table typography được sở hữu tại shared primitive và code/numeric values dùng helper.
- [x] Headed gate kiểm tra supplier evidence, purchase code, price variance và lifecycle badges.
- [x] Không đổi action eligibility hoặc permission rendering.

### 5C. Chef và Service Run

- [x] Chef header, checklist, journal, production actions và blocked reason đã dùng semantic roles/shared component owners.
- [x] Giữ numeric alignment cho servings/variance/quantity.
- [x] Headed gate kiểm tra compact table và nhãn tiếng Việt dài.

### 5D. Reports và Admin

- [x] Reports page/price/data-quality và Admin contracts/audit đã dùng semantic roles; audit identifiers/old-new values đi qua `typography.code`.
- [x] Giữ monospace cho audit old/new values và document identifiers.
- [x] Các cỡ 9–11px được review riêng, giữ nguyên và allowlist thay vì auto-map.

### Gate sau mỗi feature wave

- [x] Không có role mới chỉ phục vụ một feature.
- [x] Arbitrary numeric size giảm `73 → 29`; raw font stack không tăng ngoài ba `@font-face` có chủ đích.
- [x] Targeted tests, ESLint và build pass.
- [x] Route đại diện zero overflow; before/after định lượng chứng minh row delta tối đa `1.3px`, control delta `0px`.
- [x] Diff được review theo scope trước khi chuyển wave.

## 12. Wave 6 — Self-host Inter

- [x] Xác minh `@fontsource-variable/inter@5.3.0`, nguồn Google Fonts/Inter và license OFL-1.1.
- [x] Chọn đúng ba WOFF2 Vietnamese, Latin Extended và Latin; variable weight bao phủ 400/500/600/700.
- [x] Asset path canonical là dependency package được pin trong `package-lock.json`, không copy thêm vào `public/`.
- [x] Thêm ba `@font-face` có `font-style`, variable `font-weight`, `font-display` và source chính xác.
- [x] Xóa Google Fonts stylesheet/preconnect trong `frontend/index.html` sau khi local load pass.
- [x] Cold headed, local-only external-network-blocked và production CSP probe đều tải Inter Variable; zero Google/external request và CSP violation.
- [x] Computed font/wrap/CLS được ghi cho before và after cùng điều kiện; manifest giữ số đo thô, không tuyên bố cải thiện performance vượt bằng chứng.
- [x] **N/A:** Asset/license đã sẵn sàng, không còn deferred self-host.

## 13. Enforcement và regression tests

- [x] Tạo `frontend/tests/typographyContract.test.ts` ở vị trí source-aware test canonical.
- [x] Gate exact public roles và cấm alias trùng nghĩa.
- [x] Gate class literal tĩnh; cấm Tailwind interpolation động.
- [x] Gate CSS token tồn tại và không self-reference.
- [x] Gate hard-coded font stack chỉ nằm trong canonical owner.
- [x] Gate mỗi arbitrary numeric font size còn lại có path + reason allowlist.
- [x] Gate arbitrary numeric size không vượt baseline 29 hiện hành.
- [x] Contract cấm raw JSX `font-mono` ngoài helper; mọi code/audit owner phải đi qua `typography.code`.
- [x] Contract source-aware xác minh helper chỉ là class data, không có JSX/wrapper, khóa heading semantics đại diện tại caller.
- [x] Chạy unit tests shared primitives và feature tests bị chạm.
- [x] Chạy `npm run lint`.
- [x] Chạy `npm run build`.
- [x] Chạy `npm run depcruise`.
- [x] Chạy `git diff --check` và declared-scope inspection.

## 14. Visual và accessibility gate

- [x] Chạy Chrome headed đúng năm viewport: `1920×1080`, `1440×900`, `1366×768`, `1365×900`, `1280×900`.
- [x] Có 18 screenshot comparison: đủ năm viewport Weekly Menu và cặp before/after 1440×900 cho Approvals, Warehouse, Chef và Reports.
- [x] Kiểm tra page/section title wrap và breadcrumb/context geometry.
- [x] Kiểm tra table header, row action, badge, input label, helper/error text.
- [x] Zero global horizontal overflow; table scroll ownership giữ nguyên.
- [x] Có 54 focus probe trên năm viewport/feature routes; zero missing indicator và zero clipping sau khi ring TableViewport chuyển vào trong boundary.
- [x] Hai reflow tương đương zoom 200% cho Purchasing và Admin pass, zero overflow.
- [x] Computed style trên mọi route xác nhận `Inter Variable` và `document.fonts.status=loaded`.
- [x] Ghi console/page/request errors, local font responses, CLS và long task trong browser evidence.
- [x] Kết luận dựa trên unit/build và headed evidence, không dựa riêng một gate.

## 15. Documentation và handoff

- [x] Cập nhật `frontend/README.md` với role catalog, usage, self-host và exception policy.
- [x] Cập nhật checklist canonical và evidence index; không copy hash sang file khác.
- [x] Không sửa `docs/UI-CONFORMANCE-MATRIX.md` vì chưa có quyết định normative geometry mới.
- [x] Link research note thay vì chép lại toàn bộ nguồn chính thức.
- [x] Ghi rõ các phần type-scale/component migration còn mở cùng điều kiện evidence cần bổ sung.
- [x] Secret scan docs/evidence không phát hiện credential hoặc connection string thật.

## 16. Rollback strategy

- [x] Foundation/helper/feature/self-host nằm ở file seam riêng, có thể revert theo wave.
- [x] Font loading change tách khỏi semantic token/helper change.
- [x] Giữ historical baseline/count inventory và thêm repeatable before archive + screenshot/metric cùng run, không reset worktree.
- [x] Rollback font source không buộc rollback token/helper.
- [x] Feature migration nằm theo file feature, có thể rollback riêng.
- [x] Không dùng `git reset --hard`, `git checkout --` hoặc xóa thay đổi người dùng.

## 17. Definition of Done

- [x] `--font-sans`, `--font-heading`, `--font-mono` không tự tham chiếu và chỉ có một raw owner.
- [x] Inter chỉ được nạp từ self-hosted package source đã chốt.
- [x] Module `typography` có interface nhỏ, static và type-safe.
- [x] Shared/component primitives và toàn bộ feature slices đã khóa trong `featureRoleContracts`; density exceptions có owner/reason.
- [x] Zero dynamic Tailwind typography fragments.
- [x] Zero hard-coded raw font stack ngoài canonical owner.
- [x] Zero arbitrary numeric font size không có owner/reason.
- [x] Contract scan toàn source dispositions mọi semantic-token + explicit-weight override bằng path/reason allowlist.
- [x] Unit/source-aware assertions, lint, build, dependency check và `git diff --check` pass; scanner dist timeout khi concurrent nhưng pass riêng.
- [x] Headed năm viewport/reflow/font-load/overflow, 18 before/after screenshot, 54 focus probe, local-only và CSP đều pass.
- [x] Docs usage, exceptions, deferred items và rollback path đã ghi rõ.
- [x] Typography changes giữ scope; mọi unrelated dirty-worktree changes được bảo toàn và không commit.

## 18. Thứ tự commit đề xuất khi được phép commit

1. `test(typography): lock current font and size inventory`
2. `style(typography): establish font-family token ownership`
3. `style(typography): add semantic text scale`
4. `feat(typography): add typed shared role helper`
5. `refactor(ui): migrate shared typography primitives`
6. `refactor(<feature>): migrate typography roles` — một commit cho mỗi feature wave
7. `build(fonts): self-host Inter and remove remote loading`
8. `test(typography): enforce exceptions and visual contracts`
9. `docs(typography): document roles and migration outcome`

> Không thực hiện commit tự động trong checklist này. Khi thi công trên worktree bẩn, phải stage theo explicit path và xác minh staged diff trước từng commit.
