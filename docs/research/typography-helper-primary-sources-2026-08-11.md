# Chuẩn hóa typography helper — research nhanh

**Ngày:** 2026-08-11  
**Phạm vi:** frontend React 19 + TypeScript + Tailwind CSS 4; không thay đổi code trong research này.

## Kết luận

Nên dùng **Tailwind v4 theme variables làm source of truth** cho font family và type scale. Helper TypeScript chỉ nên là map có kiểu từ semantic role sang **chuỗi class hoàn chỉnh, tĩnh**. Không nên để helper runtime tự ghép `text-${size}` hoặc lặp lại giá trị CSS.

Phương án nhỏ nhất:

1. Tạo raw tokens riêng (`--ipc-font-sans`, `--ipc-font-mono`) và expose chúng qua `@theme inline` thành `--font-sans`, `--font-heading`, `--font-mono`.
2. Khai báo một type scale semantic hẹp bằng `--text-*` kèm line-height/weight, ví dụ `page-title`, `section-title`, `body`, `label`, `caption`, `code`.
3. Thêm `typography` typed lookup; component dùng `cn(typography.sectionTitle, className)` khi cần override có chủ đích.

## Hiện trạng repo

- [`frontend/src/styles/index.css`](../../frontend/src/styles/index.css) đã đặt Inter và monospace trong `:root`, áp sans toàn cục, cho form control inherit, và expose `font-heading`/`font-sans`/`font-mono` qua `@theme inline`. Tuy nhiên `--font-sans: var(--font-sans)` và `--font-mono: var(--font-mono)` dùng cùng tên cho raw token lẫn Tailwind token, khó phân biệt ownership và dễ tự tham chiếu khi tách file/thay thứ tự cascade.
- [`frontend/index.html`](../../frontend/index.html) tải Inter 400–700 từ Google Fonts với `display=swap`; vì vậy font hiện phụ thuộc network bên ngoài. Trong khi đó [`docs/ARCHITECTURE-AUDIT-2026-07-26.md`](../ARCHITECTURE-AUDIT-2026-07-26.md) từng ghi hướng “self-host font Inter”. Khi implement cần chốt một owner duy nhất, không giữ hai cách nạp.
- [`frontend/src/styles/components/documents.css`](../../frontend/src/styles/components/documents.css) lặp lại nguyên stack monospace thay vì dùng token chung.
- [`frontend/src/styles/components/shell.css`](../../frontend/src/styles/components/shell.css), [`frontend/src/styles/index.css`](../../frontend/src/styles/index.css) và [`frontend/src/components/common/SectionPanel.tsx`](../../frontend/src/components/common/SectionPanel.tsx) định nghĩa page/section title bằng nhiều CSS/class rời; `SectionPanel` còn có `font-semibold` chồng lên `.ipc-section-title { font-weight: 700; }`.
- [`frontend/src/components/ui/card.tsx`](../../frontend/src/components/ui/card.tsx) là chỗ hiếm hoi đã dùng `font-heading`; [`frontend/src/lib/utils.ts`](../../frontend/src/lib/utils.ts) đã có `cn()` cho composition và conflict resolution.
- Typography declaration hiện xuất hiện trong 81 file (79 TSX, 2 CSS). Scan `frontend/src/**/*.{ts,tsx}` có 234 `text-xs`, 121 `text-sm`, 76 cỡ arbitrary (23 `text-[12px]`, 22 `text-[14px]`, 10 `text-[10px]`, còn lại rải 9–20px), 209 `font-semibold`, 112 `font-medium`, 61 `font-bold`, 17 `font-mono`, nhưng chỉ một `font-heading` và một `font-sans`. Vấn đề chính là **role/scale/weight phân mảnh**, không phải thiếu global font-family.
- [`docs/UI-CONFORMANCE-MATRIX.md`](../UI-CONFORMANCE-MATRIX.md) vẫn ghi typography geometry là `UNRESOLVED`; helper/token là cơ sở để đo và gate nó, không tự nó chứng minh geometry đã pass.

## Các phương án

| Phương án | Lợi ích | Hạn chế | Kết luận |
|---|---|---|---|
| Chỉ CSS/Tailwind tokens | Native Tailwind v4, zero runtime, class được generate tĩnh | Component vẫn phải nhớ role class | Nền tảng bắt buộc |
| Tokens + typed lookup TS | Tên role nhất quán, autocomplete, dùng lại `cn()` | Thêm một module cần gate chống drift | **Khuyến nghị** |
| Tạo component `<Text variant>` cho mọi text | Enforce mạnh | Bọc DOM dày, migration lớn, dễ làm sai semantics heading/label/table | Chưa nên làm |
| Giữ arbitrary utility tại callsite | Linh hoạt | Không chuẩn hóa, khó audit | Chỉ cho ngoại lệ có lý do |

## Helper API tối thiểu đề xuất

```ts
export const typography = {
  pageTitle: 'font-heading text-page-title',
  sectionTitle: 'font-heading text-section-title',
  body: 'font-sans text-body',
  label: 'font-sans text-label',
  caption: 'font-sans text-caption',
  code: 'font-mono text-code tabular-nums',
} as const

export type TypographyRole = keyof typeof typography
```

API này không cần React component hoặc function mới; dùng `cn(typography[role], className)` là đủ. Mọi value phải là literal hoàn chỉnh để Tailwind source scanner nhận diện. Semantic HTML (`h1`–`h4`, `label`, `code`) vẫn do component sở hữu; helper chỉ quyết định presentation.

## Lộ trình migration an toàn

1. Chuẩn hóa family token và nơi nạp Inter; thay hard-code monospace, chưa đổi cỡ chữ.
2. Thêm semantic text tokens với giá trị khớp pixel hiện tại; migrate shared primitives/page shell trước.
3. Migrate theo feature; chỉ gộp 9/10/11/12/12.5/13/14px sau visual review. Các cỡ rất nhỏ có thể là density contract của Fiori compact, không được mass-replace mù.
4. Chỉ cân nhắc `<Text>` sau khi token/helper đã hội tụ và có nhu cầu semantics thật.

## Rủi ro và gate kiểm chứng

- Đổi font source, line-height hoặc weight có thể đổi wrap, chiều cao table/control, overflow và screenshot; cần production build, targeted component tests và visual gate đúng năm desktop viewport canonical trong `MEMORY.md`.
- Self-host Inter cần WOFF2 được track, khai báo đúng weight range và `font-display`; Google-hosted cần chấp nhận network/privacy/CSP dependency. Không nạp cả hai.
- Không đổi `font-mono` cho mã chứng từ/audit/countdown sang sans; đó là semantic role hợp lệ.
- Thêm source-aware test: role map chỉ chứa class literal; token được khai báo; không còn raw `font-family` ngoài token/font-face; arbitrary size mới phải nằm trong allowlist có lý do.
- Tailwind build là gate bắt buộc: class ghép động có thể không xuất hiện trong CSS dùng production.

## Nguồn chính thức

- [Tailwind CSS v4 — Theme variables](https://tailwindcss.com/docs/theme): `--font-*`, `@theme inline`, chia sẻ token qua CSS import.
- [Tailwind CSS — Font family](https://tailwindcss.com/docs/font-family): custom family, `@font-face`, WOFF2 và `font-display`.
- [Tailwind CSS — Font size](https://tailwindcss.com/docs/font-size): `--text-*` kèm line-height, letter-spacing và weight.
- [Tailwind CSS — Detecting classes](https://tailwindcss.com/docs/detecting-classes-in-source-files): không ghép class fragments; map props sang chuỗi class tĩnh.
- [Tailwind CSS — Custom utilities](https://tailwindcss.com/docs/adding-custom-styles#adding-custom-utilities): `@utility` chỉ phù hợp khi theme namespace chưa biểu diễn được bundle cần thiết.
- [MDN — `font-family`](https://developer.mozilla.org/en-US/docs/Web/CSS/font-family): fallback theo thứ tự và generic family cuối danh sách.
- [MDN — `font-display`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display): block/swap/fallback behavior của web font.
