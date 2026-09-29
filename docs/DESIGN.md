---
title: IPCManagement Product Design System
status: adopted-contract
scope: frontend
owner: IPCManagement
last_reviewed: 2026-09-30
---

# IPCManagement Product Design System

> **Quiet Operational: An industrial precision instrument engineered for high-density food-service logistics and kitchen operations on cool slate.**

Đây là **điểm vào authority duy nhất cho thiết kế frontend** của IPCManagement. Tài liệu này chuẩn hóa toàn bộ product character, visual foundations, token architecture, navigation architecture, page templates, component contracts, trạng thái tương tác và quy tắc tái cấu trúc (reconstruction). Nó được thiết kế để **cả kỹ sư frontend và AI coding agent** có thể xây dựng giao diện vận hành nhất quán từ con số 0 mà không tự suy đoán, không phân mảnh ngôn ngữ thị giác, và không bị trói buộc bởi các wireframe cứng nhắc.

---

## 1. Product Character & Operational Ethos

IPCManagement là hệ thống điều hành sản xuất, quản lý kho vận và đối soát nguyên vật liệu cho bếp ăn công nghiệp phục vụ các vai trò: **Điều phối (Dispatcher), Thu mua (Purchasing), Thủ kho (Warehouse), Bếp trưởng (Chef), Quản lý vận hành (Manager) và Quản trị viên (Admin)**.

### Triết lý "Quiet Operational"
1. **Thông tin dày đặc, tĩnh lặng ở trạng thái bình thường (Information-dense & Quiet):**
   Người vận hành làm việc liên tục 8–10 tiếng dưới ánh đèn huỳnh quang công nghiệp. Giao diện mặc định có **tính nhã nhặn, ít kích thích thị giác, nền slate dịu mắt**. Màu sắc không dùng để trang trí; màu sắc là **tín hiệu cảnh báo dành riêng cho ngoại lệ, điểm tắc và quyết định bắt buộc** (theo chuẩn ISA-101 HMI).
2. **Work Object và Dữ liệu quyết định đứng trước Decoration:**
   Mọi pixel đều phục vụ công việc: phạm vi ngày/ca, đối tượng làm việc, đơn vị tính, số liệu BOM chính xác theo đơn vị đo lường, và hành động kế tiếp hợp lệ. Không dùng card trang trí, khoảng trắng landing-page, gradient phô diễn hay motion thừa thãi.
3. **Chính trực về trạng thái (State Honesty):**
   Không làm giả trạng thái. Không che giấu lỗi 403 bằng bảng rỗng. Không báo "sẵn sàng" khi số liệu chưa được xác minh.
4. **Tối ưu hóa thao tác bàn phím và nhịp quét dữ liệu:**
   Hỗ trợ chuyển đổi nhanh qua phím `Tab`, `Enter`, `Space`, `Escape`. Cột số sử dụng font monospaced/tabular figures để loại bỏ hiện tượng giật layout khi cập nhật dữ liệu.

---

## 2. Authority & Governance Stack

Mọi quyết định giao diện phải tuân thủ thứ bậc 6 tầng nghiêm ngặt:

```text
1. Business Authority (Work object, grain, entity state, permission, mutation owner)
   ↓
2. Design Authority (docs/DESIGN.md — Character, foundations, tokens, templates, state contracts)
   ↓
3. Normative Rules (docs/DASHBOARD-UI-RULES.md — Rule IDs, MUST / SHOULD / MAY)
   ↓
4. Shared Implementation (Route metadata, accessible primitives, token bindings, formatters)
   ↓
5. Feature Composition (Domain page assembly, workflow orchestration)
   ↓
6. Page-Local Styling (Chỉ dùng khi 5 tầng trên không sở hữu vấn đề)
```

### 2.1. Ba Implementation Lens dưới một Authority
Sau khi Business Authority và `DESIGN.md` đã khóa phân cấp và bố cục, việc triển khai mã nguồn sử dụng 3 lens kỹ thuật:

1. **SAP Fiori Enterprise-Workbench Lens:** Hướng dẫn mật độ thông tin, cấu trúc phân chia master-detail, phễu lọc thích ứng (adaptive filters) và thao tác workbench; **không** sao chép theme/CSS hay visual branding của SAP.
2. **shadcn / Base UI / Tailwind Mechanics:** Cung cấp các headless primitive không kiểu dáng (`@base-ui/react`), quản lý focus trap, ARIA APG compliance và gắn kết class-to-token qua Tailwind CSS v4; **không** để mặc định của thư viện quyết định màu sắc hay bố cục sản phẩm.
3. **IPC Taste Anti-Slop Lens:** Rà soát có chủ đích để loại bỏ "AI slop": card bo góc lồng nhau (nested rounded cards), bóng đổ tùy tiện, khoảng trắng vô nghĩa kiểu landing page, và nút bấm dạng viên thuốc (pills) trong bảng dữ liệu.

### 2.2. Authority không đồng nghĩa với Nhân bản Đồng dạng (Anti-Cloning Governance)
Mục tiêu của `DESIGN.md` là **thống nhất ngôn ngữ thị giác và kỷ luật vận hành**, tuyệt đối **không áp đặt một giao diện rập khuôn (cloned template) lên các nghiệp vụ có bản chất khác nhau**:
- **Bất biến về Ngôn ngữ & Token (Authority Invariants):** Bảng màu ngữ nghĩa, độ tương phản WCAG 2.2 AA, viền hairline 1px phẳng, kỷ luật trạng thái ISA-101, font an toàn tiếng Việt, và số liệu `tabular-nums` là bắt buộc toàn hệ thống.
- **Tự do Thích ứng về Hình thái Không gian (Adaptive Topology):** Bố cục không gian tùy biến theo bản chất công việc (ma trận 2D cho lập lịch, bảng hẹp cho quét kho, split master-detail cho đơn hàng, thẻ chạm lớn cho bếp). Hệ thống sản sinh các "màn hình anh em" (sibling screens) hài hòa, không sinh ra các bản sao nhân bản (cloned screens).

*Lưu ý:* `ui-ux-pro-max` và full `design-taste-frontend` bị nghiêm cấm làm router quyết định. Ponytail giữ mức `lite` cho component/layout/visual work và `full` cho non-visual logic.

---

## 3. Compliance Framework: MUST / SHOULD / MAY

| Cấp độ | Định nghĩa và Phạm vi áp dụng | Điều kiện Override |
|---|---|---|
| **MUST** | **Bất biến cứng (Invariants):** An toàn dữ liệu, tính chính trực của quyền (permission truth), tính trung thực của trạng thái (state honesty), tương phản WCAG 2.2 AA, tiếp cận bàn phím cơ bản (không bẫy phím), phông chữ nội bộ (CSP `font-src 'self'`), số liệu động bật `tabular-nums`, sàn cỡ chữ tối thiểu 12px, phân định rõ ràng giữa điều hướng workspace và lọc dữ liệu. | **Không thể override.** Bất kỳ vi phạm nào đều là lỗi chặn release. |
| **SHOULD** | **Mặc định hệ thống mạnh (Strong Defaults):** Thứ bậc floorplan 5 vùng tuần tự khi hiện diện, độ sâu điều hướng sidebar $\le 2$ cấp, hành động chính mặc định 1 nút Primary Navy (trừ ngoại lệ thẩm định), mật độ hiển thị theo phân hệ, chiều cao hàng bảng khuyến nghị (32–36px / 40–44px), cỡ chữ 13/14px, cấu trúc Dialog/Drawer chuẩn, sentence-case cho table headers, kỷ luật triệt tiêu màu trạng thái thường nhật (ISA-101 Quiet Baseline). | Chỉ được override khi nghiệp vụ cụ thể chứng minh được lý do bằng văn bản trong Feature Contract (`docs/domain/*.md`). |
| **MAY** | **Vùng thích ứng linh hoạt (Adaptive Options):** Bố cục split rail vs drawer vs route con, đóng/mở mặc định của khối nguồn (KHSX disclosure), bật/tắt cột nâng cao qua preferences, mật độ hiển thị do người dùng chọn, phím mũi tên điều hướng mở rộng, ghi nhớ trạng thái mở rộng nhóm sidebar. | Được phép tùy biến theo ngữ cảnh người dùng và độ phân giải màn hình. |

---

## 4. Visual Direction: "Quiet Operational"

Hệ thống thị giác của IPCManagement là sự kết hợp có chủ đích giữa **sự tĩnh lặng của phòng điều khiển công nghiệp** và **độ chính xác của bảng tính kế toán**:

- **Nhiệt độ màu trung tính (Neutral Temperature):** Cool Slate (Hue $215^\circ - 222^\circ$, Saturation 8–12%). Nền canvas dịu mắt (`--color-canvas-default` / `surface-base`), bề mặt panel trắng tinh khiết (`--color-surface-base`), đường biên hairline (`--color-border-default`). Tông màu xám lạnh giảm thiểu độ chói gắt thị giác (harsh glare) so với nền trắng tuyền, tạo cảm giác êm dịu khi người vận hành làm việc liên tục nhiều giờ dưới ánh sáng huỳnh quang văn phòng và nhà xưởng.
- **Chiến lược Accent:** Màu Marine Navy (`primary-action` / `--color-action-primary-bg`) là mặc định cho **hành động chính (Primary Action)** trên mỗi bề mặt. Màu xanh Cerulean (`info` / `--color-status-info-fg`) dùng cho thông tin thụ động (Info), hoàn toàn tách biệt về sắc độ và hình thái. Trên bàn thẩm định (Approval Workbench), cho phép cặp nút quyết định đối kháng (Phê duyệt `primary-action` / Từ chối `danger`).
- **Mô hình Bề mặt & Đường viền (Border-First Flat):** Phẳng trên canvas dữ liệu. Đường kẻ 1px hairline theo token `--color-border-default` thay thế bóng đổ để phân định ranh giới cột/hàng. Bóng đổ không dùng trên bảng và card; chỉ cho phép trên lớp nổi (modal dialog, popover, drawer).
- **Hệ thống Bo góc (Radius Vocabulary):** Bộ từ vựng đóng: `--radius-none` cho bảng/tab, `--radius-sm` cho input/select, `--radius-md` cho button/card/lozenge, `--radius-lg` cho dialog. **Tuyệt đối cấm bo tròn pill (`--radius-full`)** cho trạng thái hoặc nút bấm trong bảng.
- **Kỷ luật Trạng thái (ISA-101 Quiet Baseline):** Trạng thái thường nhật hiển thị dưới dạng chữ trung tính không màu; chỉ những ngoại lệ cần xử lý mới nhận màu cảnh báo (Amber) hoặc lỗi chặn (Crimson).

---

## 5. Foundations

*Lưu ý thẩm định:* Các giá trị số cụ thể dưới đây được phân định rõ ràng giữa:
- **VALIDATED AGAINST DOMAIN / SECURITY:** Đã được chứng minh bằng quy chuẩn bảo mật hoặc nghiệp vụ bắt buộc (CSP, số liệu `tabular-nums`, sàn cỡ chữ 12px).
- **LEGACY-VALIDATED:** Đã tồn tại trong mã nguồn/test hiện hành.
- **PROVISIONAL FOR RECONSTRUCTION:** Thông số ứng viên cho thiết kế mới, sẽ được kiểm chứng chính thức qua **Cổng Xác thực Mẫu phẩm Thị giác (Section 20)**.

### 5.1. Color Architecture (3-Tier Layering)
Hệ thống màu tuân thủ chuỗi phụ thuộc một chiều:
`Primitive Scale (Hex) ──► Semantic Tokens (Vai trò) ──► Component Tokens (Ràng buộc)`

#### A. Primitive Scales (Candidate / Provisional Defaults)

```css
:root {
  /* Slate Scale (Cool Blue-Gray: H 215-222, S 8-14%) */
  --ipc-primitive-slate-25:  #f8fafc;
  --ipc-primitive-slate-50:  #f1f5f9;
  --ipc-primitive-slate-100: #e2e8f0;
  --ipc-primitive-slate-200: #cbd5e1;
  --ipc-primitive-slate-300: #94a3b8;
  --ipc-primitive-slate-400: #64748b;
  --ipc-primitive-slate-500: #475569;
  --ipc-primitive-slate-600: #334155;
  --ipc-primitive-slate-700: #1e293b;
  --ipc-primitive-slate-800: #0f172a;
  --ipc-primitive-slate-900: #090d16;

  /* Marine Navy (Primary Brand & Committed Action: H 212-216) */
  --ipc-primitive-marine-50:  #f0f5fc;
  --ipc-primitive-marine-100: #e2ecf8;
  --ipc-primitive-marine-600: #1a56a8;
  --ipc-primitive-marine-700: #164e87; /* Candidate Primary Action */
  --ipc-primitive-marine-800: #113c69; /* Hover */
  --ipc-primitive-marine-900: #0c2b4c; /* Active / Pressed */

  /* Cerulean (Passive Informational Status: H 199-204) */
  --ipc-primitive-cerulean-50:  #f0f9ff;
  --ipc-primitive-cerulean-200: #bae6fd;
  --ipc-primitive-cerulean-600: #0284c7;
  --ipc-primitive-cerulean-700: #0369a1;

  /* Pine Teal (Success & Reconciled: H 170-175) */
  --ipc-primitive-teal-50:  #f0fdfa;
  --ipc-primitive-teal-200: #99f6e4;
  --ipc-primitive-teal-600: #0d9488;
  --ipc-primitive-teal-700: #0f766e;

  /* Amber Ochre (Warning & Attention: H 36-40) */
  --ipc-primitive-amber-50:  #fffbeb;
  --ipc-primitive-amber-200: #fde68a;
  --ipc-primitive-amber-600: #d97706;
  --ipc-primitive-amber-800: #92400e; /* AA Compliant text */

  /* Crimson (Danger, Blocker, Shortage: H 0-4) */
  --ipc-primitive-crimson-50:  #fef2f2;
  --ipc-primitive-crimson-200: #fecaca;
  --ipc-primitive-crimson-600: #dc2626;
  --ipc-primitive-crimson-700: #b91c1c; /* Solid blocker */
}
```

#### B. Semantic Roles Table (Candidate Tokens)

| Tên Token | Giá trị CSS | Vai trò ngữ nghĩa | Điều kiện sử dụng & Ràng buộc | Trạng thái Thẩm định |
|---|---|---|---|:---:|
| `--color-canvas-default` | `#f1f5f9` | Nền gốc toàn màn hình (Page background) | Mọi trang vận hành. Không dùng trắng `#ffffff` làm nền canvas. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-canvas-muted` | `#f4f6f9` | Nền canvas thứ cấp cho khung chia split | Vùng làm việc phụ / rail nền. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-surface-base` | `#ffffff` | Thẻ làm việc, bảng dữ liệu, modal body | Bề mặt chứa nội dung chính. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-surface-subtle` | `#f8fafc` | Tiêu đề bảng (`th`), thanh công cụ, lọc | Tạo phân lớp nhẹ không cần viền đậm. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-surface-selected`| `#f0f5fc` | Hàng bảng được chọn, menu đang kích hoạt | Màu xanh marine cực nhạt. Không dùng màu vàng/cam. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-border-subtle` | `#e2e8f0` | Đường phân cách giữa các hàng bảng | 1px hairline nội bộ bảng. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-border-default`| `#cbd5e1` | Khung ngoài panel, đường bao bảng | Ranh giới container. Viền hairline cấu trúc ~1.4:1 trên trắng. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-border-strong` | `#64748b` | Đường viền input, checkbox, radio | **Bắt buộc cho form control** để đạt WCAG SC 1.4.11 ($\ge 3:1$). | Accessibility: VALIDATED_AGAINST_ACCESSIBILITY <br>Target: PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-border-focus` | `#2d7acf` | Viền focus bàn phím (`:focus-visible`) | Vòng focus ring 2px. Không được tắt `outline`. | Accessibility: VALIDATED_AGAINST_ACCESSIBILITY <br>Target: PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-text-primary` | `#0f172a` | Tiêu đề, dữ liệu bảng chính, giá trị | Tương phản cực cao ~17.9:1 trên nền trắng. | Accessibility: VALIDATED_AGAINST_ACCESSIBILITY <br>Target: PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-text-secondary`| `#334155` | Nhãn form, tiêu đề cột bảng, mô tả | Tương phản ~10.4:1 trên nền trắng. | Accessibility: VALIDATED_AGAINST_ACCESSIBILITY <br>Target: PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-text-muted` | `#475569` | Metadata, dấu thời gian, hint text | Tương phản ~7.6:1 trên trắng, ~7.0:1 trên canvas. | Accessibility: VALIDATED_AGAINST_ACCESSIBILITY <br>Target: PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-text-disabled` | `#94a3b8` | Chữ bị vô hiệu hóa | Chỉ dùng cho phần tử `disabled`. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-action-primary-bg`| `#164e87` | Nút hành động chính | Khuyến nghị 1 nút chính/bề mặt (trừ bàn thẩm định). | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-action-primary-hover`| `#113c69` | Trạng thái hover của nút chính | Tối hơn 1 nấc để tạo phản hồi thị giác rõ rệt. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-action-primary-fg`| `#ffffff` | Màu chữ trên nút chính | Tương phản ~8.5:1 trên nền `#164e87`. | Accessibility: VALIDATED_AGAINST_ACCESSIBILITY <br>Target: PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-status-info-bg` | `#f0f9ff` | Nền mờ cho thông báo thông tin | 10% cerulean tint. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-status-info-border`| `#bae6fd` | Viền hairline cho thông báo thông tin | Viền hairline xanh nhạt. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-status-info-fg` | `#0369a1` | Chữ trạng thái thông tin, link hướng dẫn | Tách biệt với Action Blue. Không dùng nền đặc. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-status-success-bg` | `#f0fdfa` | Nền mờ cho hoàn tất/khớp BOM | 10% teal tint. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-status-success-border`| `#99f6e4` | Viền hairline cho hoàn tất/khớp BOM | Viền hairline xanh ngọc nhạt. | PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-status-success-fg`| `#0f766e` | Hoàn tất đối soát, khớp BOM | Tông Pine Teal dịu mắt. Tương phản ~5.5:1. | Accessibility: VALIDATED_AGAINST_ACCESSIBILITY <br>Current: VALIDATED_AGAINST_CURRENT_IMPLEMENTATION <br>Target: PROVISIONAL_FOR_RECONSTRUCTION |
| `--color-status-warning-bg` | `#fffbeb` | Nền mờ cho cảnh báo/chờ duyệt | 10% amber tint. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-status-warning-border`| `#fde68a` | Viền hairline cho cảnh báo/chờ duyệt | Viền hairline vàng hổ phách nhạt. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-status-warning-fg`| `#92400e` | Chờ duyệt, thiếu hàng nhẹ, cảnh báo | Tông Amber Ochre đậm. Tương phản ~7.1:1. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-status-danger-bg` | `#fef2f2` | Nền mờ cho lỗi chặn/thiếu hụt | 10% crimson tint. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-status-danger-border`| `#fecaca` | Viền hairline cho lỗi chặn/thiếu hụt | Viền hairline đỏ nhạt. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-status-danger-fg` | `#b91c1c` | Thiếu hụt nghiêm trọng, lỗi 403/500 | Tông Crimson Red. Dành cho blocker và cảnh báo nguy hiểm. | PROVISIONAL_FOR_RECONSTRUCTION (Gate 2) |
| `--color-data-row-hover` | `#f0f4f8` | Hover trên hàng bảng | Tăng nhận diện dòng mà không làm mờ chữ. | PROVISIONAL_FOR_RECONSTRUCTION |

---

### 5.2. Contrast Validation Matrix (WCAG 2.2 AA / AAA)

Bảng kiểm tra độ tương phản tính toán theo chuẩn WCAG 2.2 (Level AA / AAA) trên bề mặt nền trắng (`#ffffff`):

```text
[ WCAG Contrast Ratios on #FFFFFF Surface Base ]
Primary Text (#0f172a)     : ~17.9:1  --> PASS (AAA, ngưỡng >= 7.0:1)
Secondary Text (#334155)   : ~10.4:1  --> PASS (AAA)
Muted Text (#475569)       :  ~7.6:1  --> PASS (AAA)
Primary Action Btn (#164e87): ~8.5:1  --> PASS (AAA)
Info Text (#0369a1)        :  ~5.9:1  --> PASS (AA, ngưỡng >= 4.5:1)
Success Text (#0f766e)     :  ~5.5:1  --> PASS (AA)
Warning Text (#92400e)     :  ~7.1:1  --> PASS (AAA)
Danger Text (#b91c1c)      :  ~6.5:1  --> PASS (AA)
Interactive Border (#64748b): ~4.8:1  --> PASS (SC 1.4.11 >= 3.0:1)
Focus Ring (#2d7acf)       :  ~4.4:1  --> PASS (SC 1.4.11 >= 3.0:1)
```

---

### 5.3. Typography & Vietnamese Orthography

1. **Phông chữ chủ lực (Primary Workhorse - VALIDATED AGAINST SECURITY/CSP):**
   `Inter Variable` tải cục bộ (`@fontsource-variable/inter`). Không dùng Google Fonts CDN; tuân thủ nghiêm ngặt Content Security Policy (`font-src 'self'`).
2. **Phông chữ dự phòng Hệ thống (Tier-1 Fallback):**
   `Segoe UI` trên Windows (`system-ui, "Segoe UI", Roboto, Arial, sans-serif`). Metric overrides trong `@font-face` (`ascent-override: 90%`, `descent-override: 22%`, `line-gap-override: 0%`) giảm thiểu hiện tượng dịch chuyển bố cục (CLS) khi nạp fallback font trên Windows; yêu cầu kiểm chứng thực tế qua Playwright trace (Gate 3).
3. **An toàn dấu tiếng Việt trong bảng hẹp (Row height 32–36px):**
   - Tiếng Việt có dấu mũ ghép với thanh điệu (`ế`, `ề`, `ể`, `ễ`, `ệ`, `ố`, `ồ`, `ổ`, `ỗ`, `ộ`, `ắ`, `ằ`, `ẳ`, `ẵ`, `ặ`).
   - Cấm dùng `line-height: normal` hoặc `line-height: 1.0` trên các cell chứa tiếng Việt vì có nguy cơ bị cắt ngọn dấu (*clipping*) khi nằm trong container có `overflow: hidden`.
   - **Chiều cao dòng khuyến nghị:** Chữ 13px (`text-[13px]`) kết hợp `line-height: 18px` (`leading-[18px]`) và padding dọc `6px` (`py-1.5`) là công thức cơ sở khuyến nghị để đạt chiều cao hàng bảng chuẩn `32px`–`36px` mà không làm cắt ngọn dấu thanh ghép (`ế`, `ệ`, `ở`, `ồ`); bắt buộc kiểm chứng thực tế qua mẫu phẩm thị giác (Gate 1).
   - **Ưu tiên Sentence Case:** Tiêu đề bảng dùng Sentence Case (`Tên nguyên vật liệu`) thay vì All-Caps (`TÊN NGUYÊN VẬT LIỆU`) để tránh việc xếp chồng dấu thanh trên chữ in hoa, giúp tiêu đề gọn gàng và không lấn chiếm khoảng đệm dọc của hàng.
4. **Số liệu & Tiền tệ (OpenType Tabular Figures - VALIDATED AGAINST DOMAIN):**
   Mọi cột số lượng, định mức BOM, đơn giá và thành tiền VND **bắt buộc** kích hoạt:
   `font-variant-numeric: tabular-nums; font-feature-settings: "tnum", "cv02", "cv03", "cv04", "cv11";`
   Đảm bảo các chữ số từ 0–9 và ký hiệu `₫` chiếm chiều rộng ngang cố định, triệt tiêu hiện tượng nhảy số khi refetch.

---

### 5.4. Semantic Type Scale & Tokens

Hệ thống rút gọn thành 11 role ngữ nghĩa, loại bỏ hoàn toàn các cỡ chữ marketing (> 24px) trong không gian làm việc:

| Role | Font Family | Size (px / rem) | Line-Height | Weight | Tracking (Candidate) | Mục đích & Phạm vi sử dụng | Trạng thái Thẩm định |
|---|---|---|---|---|---|---|:---:|
| **Page Title** (`h1`) | Sans | 18px / `1.125rem` | 24px (`1.33`) | Bold (700) | `0em` (MAY `-0.015em`) | Tiêu đề route chính tại Zone 1 (`OperationalFrame`). | PROVISIONAL |
| **Workspace Title** (`h2`)| Sans | 16px / `1.000rem` | 22px (`1.37`) | Bold (700) | `0em` | Tiêu đề sub-view, tab lớn, drawer workbench. | PROVISIONAL |
| **Section Title** (`h3`) | Sans | 14px / `0.875rem` | 20px (`1.43`) | SemiBold (600)| `0em` | Tiêu đề `SectionPanel`, card nhóm chức năng. | PROVISIONAL |
| **Subsection** (`h4`) | Sans | 13px / `0.8125rem` | 18px (`1.38`) | SemiBold (600)| `0em` | Tiêu đề nhóm filter, modal sub-heading. | PROVISIONAL |
| **Body Regular** | Sans | 14px / `0.875rem` | 20px (`1.43`) | Regular (400) | `0em` | Văn bản hướng dẫn, form body, dialog message. | PROVISIONAL |
| **Body Small** | Sans | 13px / `0.8125rem` | 18px (`1.38`) | Regular (400) | `0em` | Mô tả phụ, ghi chú nội bộ, chi tiết drawer. | PROVISIONAL |
| **UI Control Label** | Sans | 13px compact / 14px default | 1.0 (flex) | Medium (500) | `0em` | Label nút bấm, select, tabs, input fields. | PROVISIONAL |
| **Table Header** (`th`) | Sans | 12px / `0.750rem` | 16px (`1.33`) | SemiBold (600)| `0em` | Tiêu đề cột bảng. Sentence case ưu tiên. | PROVISIONAL |
| **Table Cell Data** (`td`)| Sans | 13px compact / 14px standard | 18px / 20px | Regular / 500 | `0em` | Dữ liệu bảng: tên món, tên nhà cung cấp, ghi chú. | NEEDS SPECIMEN (Gate 1) |
| **Caption / Metadata** | Sans | 12px / `0.750rem` | 16px (`1.33`) | Regular (400) | `0em` | Dấu thời gian, text trợ giúp, đếm ký tự. | PROVISIONAL |
| **Numeric Display** | Sans | 13px / 14px | 18px / 20px | SemiBold (600)| `0em` | Số lượng, đơn giá, thành tiền VND (`tabular-nums`, căn phải). | VALIDATED (Tabular) |
| **Technical Identity** | Mono | 12px / `0.750rem` | 16px (`1.33`) | Medium (500) | `0em` | Mã chứng từ (`PNK-001`), Lot ID, UUID (`tabular-nums`). | PROVISIONAL |

*Sàn cỡ chữ tối thiểu:* **Nghiêm cấm cỡ chữ dưới 12px** trên mọi văn bản dữ liệu để bảo vệ khả năng đọc dấu tiếng Việt trên màn hình 96 DPI. (Phân loại: `IPC_QUALITY_TARGET` / `PROVISIONAL_FOR_RECONSTRUCTION` chờ kiểm chứng mẫu phẩm Gate 1; hiện tại được bảo vệ trong test hợp đồng cũ).

---

### 5.5. Spacing Scale (4px Base Grid - VALIDATED_AGAINST_CURRENT_IMPLEMENTATION)
*(Lưu ý: Bội số 4px đã được định nghĩa trong CSS và test hợp đồng hiện hành; nhịp điệu khoảng cách cho giao diện tái cấu trúc giữ ở mức PROVISIONAL_FOR_RECONSTRUCTION)*

| Token | Giá trị | Ứng dụng cụ thể |
|---|---|---|
| `--space-1` | `4px` | Khoảng cách icon và text trong badge; khoảng cách checkbox và label. |
| `--space-2` | `8px` | Padding trong cell bảng compact (`px-2`); khoảng cách giữa các nút trong toolbar. |
| `--space-3` | `12px` | Padding trong cell bảng standard; gap giữa các trường form liên quan. |
| `--space-4` | `16px` | Padding bên trong `SectionPanel`; gap giữa các thẻ card kề nhau. |
| `--space-5` | `20px` | Gap giữa các section làm việc độc lập. |
| `--space-6` | `24px` | Margin ngoài của container toàn trang (`OperationalFrame`). |
| `--space-8` | `32px` | Khoảng cách giữa các khối chức năng lớn (tối đa trong layout vận hành). |

---

### 5.6. Density Tiers (Candidate Defaults - PROVISIONAL)

| Mật độ | Chiều cao Control | Chiều cao Hàng Bảng | Cỡ chữ cơ sở | Phân hệ / Màn hình áp dụng |
|---|---|---|---|---|
| **Compact** | **`32px`** (`h-8`) | **`32px` – `36px`** | **13px** | Ma trận Thực đơn tuần, Bảng tính định mức BOM, Phân bổ tồn kho picking, Sổ cái đối soát nguyên vật liệu. |
| **Standard** *(Mặc định)* | **`36px`** (`h-9`) | **`40px` – `44px`** | **14px** | Hàng đợi phê duyệt, Quản lý đơn mua hàng (PO), Nghiệm thu nhập kho, Danh mục khách hàng / Hợp đồng. |
| **Spacious** | **`40px`** (`h-10`) | **`48px` – `56px`** | **14px** | Bàn điều hành tổng quan (Dashboard KPI), Màn hình tablet Bếp trưởng tại khu chế biến, Lịch sử kiểm toán sâu. |

---

### 5.7. Radius Vocabulary (Tập giá trị đóng - PROVISIONAL_FOR_RECONSTRUCTION)

Nghiêm cấm sử dụng bo góc tùy tiện:
- `0px` (`rounded-none`): Bảng dữ liệu, hàng dữ liệu, tab navigation viền dưới, split pane divider.
- `2px` (`rounded-xs` / `--radius-sm`): Input, Select, Checkbox, Code badge.
- `3px` (`rounded-sm` / `--radius-md`): Buttons, Status lozenges, Thẻ panel nhỏ (`SectionPanel`).
- `6px` (`rounded-md` / `--radius-lg`): Modal Dialog, Floating Popover, Toast notification, Sheet Drawer.
- `9999px` (`rounded-full`): **Chỉ dành riêng cho Notification Count Badge nhỏ** (ví dụ badge đếm `(3)` trên chuông thông báo) hoặc avatar hình tròn. **Cấm dùng cho status lozenge hay button**.

---

### 5.8. Borders & Hairlines
- **Mô hình Hairline:** Ranh giới container dùng viền hairline 1px phẳng (`#cbd5e1`, `#e2e8f0`).
- **Form Control Boundary:** Viền ô nhập liệu dùng `--color-border-strong` (`#64748b`) để đảm bảo người khiếm thị nhận biết được viền form (WCAG SC 1.4.11).
- **Anti-pattern:** Không đóng khung lồng nhau 3 lớp (tránh panel lồng card, card lồng box viền đậm).

---

### 5.9. Surfaces & Layering Hierarchy

```text
Level 3: Overlay Layer   (Z: 1000+) --> Modal Dialogs, Critical Confirmations, Floating Toasts
Level 2: Popover Layer   (Z: 500)   --> Dropdown Menus, Date Pickers, Table Preferences
Level 1: Surface Base    (Z: 10)    --> White Work Panels, Data Table Viewports, Sticky Headers
Level 0: Canvas Backdrop (Z: 0)     --> Cool Slate Page Background (#f1f5f9)
```

---

### 5.10. Elevation & Shadow Mechanics
- **Nguyên tắc cốt lõi (SHOULD Design Principle / PROVISIONAL_FOR_RECONSTRUCTION):** Bề mặt 2D trên trang phẳng. Không áp dụng `box-shadow` cho bảng, hàng bảng, card hay nút bấm. (Nguyên tắc thiết kế thị giác theo triết lý ISA-101 HMI, không phải ràng buộc hợp đồng dữ liệu domain).
- **Bóng đổ duy nhất được phép:**
  - Floating Popover / Tooltip: `0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)`
  - Sheet Drawer / Modal Dialog: `0 20px 25px -5px rgb(15 23 42 / 0.12), 0 8px 10px -6px rgb(15 23 42 / 0.08)`

---

### 5.11. Iconography & Bounding Boxes
- **Kích thước chuẩn:** **`16x16px` (`size-4`)** cho mọi nút bấm, hàng bảng, trạng thái và input icon. Dùng `18x18px` hoặc `20x20px` (`size-5`) cho menu điều hướng sidebar.
- **Độ dày nét (Stroke):** `1.5px` đến `1.75px` (Lucide Icons chuẩn). Không dùng nét 2.0px đậm gây nặng nề trong bảng hẹp.
- **Căn chỉnh quang học với Tiếng Việt:** Icon đi kèm nhãn tiếng Việt phải dùng `inline-flex items-center justify-center shrink-0` thay vì căn theo đường chân chữ (baseline), giúp bảo vệ khoảng cách với dấu mũ và dấu móc.

---

## 6. Layout & Spatial Composition

### 6.1. Ngữ pháp Bố cục Thích ứng (Adaptive Layout Grammar)
Mỗi route vận hành được cấu thành từ 5 vai trò chức năng theo thứ tự logic, nhưng **sự hiện diện của từng vùng là có điều kiện**, không ép buộc màn hình đơn giản phải giữ chỗ cho các vùng trống:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [Zone 1] Route Identity: Eyebrow + Breadcrumb + H1 Tiêu đề công việc   │
├────────────────────────────────────────────────────────────────────────┤
│ [Zone 2] Scope & Command Bar: Bộ chọn phạm vi + Nút tác vụ chính       │
├────────────────────────────────────────────────────────────────────────┤
│ [Zone 3] Context & Prerequisite Surface: Trạng thái điều kiện / Cảnh báo│
├─────────────────────────────────────────────────┬──────────────────────┤
│ [Zone 4] Primary Work Surface                   │ [Zone 5]             │
│ (Table / Matrix / Split Workbench / Form Canvas)│ Secondary Rail       │
│                                                 │ (Chứng từ / Lineage) │
└─────────────────────────────────────────────────┴──────────────────────┘
```

1. **Zone 1: Route Identity:** Breadcrumb/eyebrow và H1 tên công việc. Luôn xuất hiện trên cùng. Không lặp lại H1 ở panel con bên dưới.
2. **Zone 2: Scope & Command Bar (`CommandBar`):** Chứa bộ lọc phạm vi (Khách hàng, Ngày/Tuần, Ca làm việc, Kho), ô tìm kiếm và **nút hành động chính**. Chiều cao ôm sát nội dung (`h-9` hoặc `h-10`).
3. **Zone 3: Context & Prerequisite State (Hiện diện có điều kiện):**
   - Khi điều kiện tiên quyết **chưa thỏa mãn** (chưa chọn khách hàng/tuần): Vùng này **thay thế hoàn toàn** vùng làm việc chính. Tuyệt đối **cấm** vẽ bảng dữ liệu rỗng bên dưới một alert thông báo chưa chọn phạm vi.
   - Khi điều kiện **đã thỏa mãn**: Vùng này **tự động unmount**, không để lại panel trắng hay khoảng đệm thừa.
4. **Zone 4: Primary Work Surface:** Không gian làm việc cốt lõi (Bảng, Ma trận, Form). Nhận `flex-1 min-h-0`.
5. **Zone 5: Secondary Rail (`SideRail`):** Thông tin phụ trợ (Lịch sử chứng từ, luồng phê duyệt). Nằm bên phải trên màn hình $\ge 1366\text{px}$ (`w-72` đến `w-80`) hoặc gập xuống đáy trên màn hình hẹp. Tuyệt đối không giữ khoảng trống trắng nếu không có dữ liệu rail.

### 6.2. Hợp đồng Hình học Asynchronous (Geometry Roles)
Mọi container chứa dữ liệu bất đồng bộ (`QueryViewBoundary`) phải khai báo một trong 4 geometry role:

| Geometry Role | Chiều cao & Ràng buộc Layout | Hành vi Skeleton Loader |
|---|---|---|
| `compact` | Chiều cao tự nhiên (`auto`, dải `control-size-compact` đến `control-size-standard`). Cấm `min-height` lớn. | Skeleton dạng 1 dòng ôm sát control. |
| `section` | Chiều cao theo nội dung thẻ card tóm tắt. | Skeleton mô phỏng hình học thẻ card đã biết kích thước. |
| `table` | Khung bảng có phân trang hoặc cuộn dòng. | Skeleton mô phỏng đúng số cột và số hàng của bảng (`TableSkeleton`). |
| `workspace` | Ma trận 2D hoặc canvas editor chiếm trọn không gian. | Skeleton dạng lưới toàn phần có placeholder có chủ đích. |

---

## 7. Navigation Architecture (Kiến trúc Điều hướng Toàn hệ thống)

Hệ thống điều hướng của IPCManagement tuân thủ triết lý: **Định vị tức thì, phân cấp tường minh theo mô hình 7 tầng, chuyển đổi workspace qua Sidebar có thể mở rộng, và nghiêm cấm nhân bản điều hướng workspace thành tab bên trong trang (Anti-Duplication Invariant - MUST NOT).**

```text
Level 1: Application (Vỏ ứng dụng toàn hệ thống — Chế độ DEFAULT vs MATERIAL_RECONCILIATION)
  └── Level 2: Module / Group (Nhóm phân hệ nghiệp vụ trên Sidebar: Kế hoạch, Kho vận, Thu mua, Bếp, Đối soát)
        └── Level 3: Workspace / Route (Tuyến đường làm việc độc lập / URL Route chuyên trách)
              ├── Level 4: Local View (In-Page Tabs chuyển đổi góc nhìn của cùng 1 đối tượng)
              ├── Level 5: Filter / Scope (Bộ chọn phạm vi ngày/ca/trạng thái trong Zone 2 CommandBar)
              ├── Level 6: Disclosure (Khối mở rộng nội dòng / Accordion chi tiết)
              └── Level 7: Object Detail (Drawer xem chi tiết chứng từ / Modal thao tác)
```

### 7.1. Bảng Phân loại 7 Tầng Ngữ nghĩa Điều hướng (7-Level Navigation Taxonomy)

| Level | Tên tầng | Bản chất & Vai trò | Vị trí / Primitive | URL Mapping | Ví dụ cụ thể trong IPCManagement |
|---|---|---|---|---|---|
| **L1** | **Application** | Vỏ ứng dụng toàn hệ thống & Chế độ vận hành | Top Shell Bar / User Menu | Root context | `DEFAULT` vs `MATERIAL_RECONCILIATION` |
| **L2** | **Module / Group** | Nhóm phân hệ nghiệp vụ cha trên Sidebar | Sidebar Accordion Group | Path segment | `Kế hoạch & Điều phối`, `Kho nguyên liệu`, `Thu mua` |
| **L3** | **Workspace / Route** | Tuyến đường làm việc độc lập chuyên trách | Sidebar leaf navigation link | Route pathname | `/planning/weekly-menu`, `/planning/material-demand` |
| **L4** | **Local View** | Chuyển đổi góc nhìn của cùng một đối tượng | In-page `ViewSwitcher` | Query param `?view=` | Bảng lịch (`matrix`) vs Danh sách (`list`) |
| **L5** | **Filter / Scope** | Thu hẹp & phân lát dữ liệu đang xem | Zone 2 `CommandBar` | Query params `?date=&cust=` | Khách hàng ANV, Tuần 2026-09-21, Ca sáng |
| **L6** | **Disclosure** | Ẩn/hiện khối nội dung phụ trợ | Accordion `<details>` | Local state / Hash | Khối nguồn KHSX, Bóc tách BOM món |
| **L7** | **Object Detail** | Xem chi tiết một bản ghi cụ thể | Drawer / Sheet / Modal | ID param / Drawer state | Chi tiết Phiếu nhập `PNK-001`, Hồ sơ món `MON-02` |

---

### 7.2. Weekly Menu Workspace Reclassification (Tái phân loại Thực đơn tuần)
*Quyết định Thẩm quyền của Product Owner:* Toàn bộ 6 góc nhìn trước đây của Thực đơn tuần được **tái phân loại từ LOCAL_TAB thành WORKSPACE / ROUTE ứng viên** trực thuộc nhóm `Kế hoạch & Điều phối` trên Sidebar:

| Phân hệ / Tên góc nhìn | Phân loại Cũ | Phân loại Mới | Trạng thái Route | Rationale Nghiệp vụ | Persona Hợp lệ (VERIFIED) |
|---|:---:|:---:|:---:|---|---|
| **Kế hoạch tuần** | LOCAL_TAB | **WORKSPACE / ROUTE** | DEFINED INTENT (Provisional URL) | Lập ma trận thực đơn, gán món, duyệt kế hoạch tuần. Đối tượng: Kế hoạch tuần. | **Điều phối** (`coordination.read`) |
| **Nhu cầu nguyên liệu** | LOCAL_TAB | **WORKSPACE / ROUTE** | DEFINED INTENT (Provisional URL) | Tính toán định mức nổ BOM, kiểm tra lỗi thời, duyệt nhu cầu. Đối tượng: Nhu cầu NVL. | **Điều phối / Quản lý** (`demand.generate`) |
| **Kế hoạch sản xuất** | LOCAL_TAB | **WORKSPACE / ROUTE** | DEFINED INTENT (Provisional URL) | Kiểm tra lệnh sản xuất theo ca/món cho bếp. Đối tượng: Lệnh sản xuất ca. | **Bếp trưởng / Quản lý** (`production.read`) |
| **Bàn giao tuần** | LOCAL_TAB | **WORKSPACE / ROUTE** | DEFINED INTENT (Provisional URL) | Tổng hợp nguyên liệu bàn giao kho sang bếp, xuất CSV. Đối tượng: Tổng hợp bàn giao. | **Thủ kho / Thu mua** (`warehouse.read`, `purchase.read`) |
| **Giá vốn tuần** | LOCAL_TAB | **WORKSPACE / ROUTE** | DEFINED INTENT (Provisional URL) | Kiểm toán biên lợi nhuận, giá vốn theo ngày. Đối tượng: Báo cáo giá vốn. | **Quản lý / Admin** (`report.read`, `coordination.read`) |
| **Định mức theo món** | LOCAL_TAB | **WORKSPACE / ROUTE** | DEFINED INTENT (Provisional URL) | Kiểm tra tỷ lệ định mức khay món, Food Cost %. Đối tượng: Công thức món. | **Bếp trưởng / Quản lý** (`catalog.read`, `coordination.read`) |

*Bất biến Loại trừ Nhân bản (Anti-Duplication Invariant - MUST):* Khi các không gian làm việc này được đưa lên Sidebar Navigation, các trang con **tuyệt đối không được giữ lại thanh tab ngang 6 mục cũ**. Cấm mô hình: Sidebar có 6 mục + Trang lại có đúng 6 tab đó.

---

### 7.3. Cấu trúc Cây Sidebar Đề xuất (Target Sidebar Information Architecture)
Cấu trúc cây Sidebar 2 cấp tinh gọn, nông (Shallow $\le 2$ levels), phản ánh chính xác các workspace độc lập:

```text
IPCManagement Primary Navigation (Shallow Hierarchy <= 2 Levels)
├── [ ] Bàn điều hành hôm nay (Dashboard - Standalone L1)
│
├── [v] Kế hoạch & Điều phối (Module Group)
│   ├── Kế hoạch tuần (Weekly Schedule Matrix)
│   ├── Nhu cầu nguyên liệu (Material Demand Workbench)
│   ├── Kế hoạch sản xuất (Production Orders)
│   ├── Bàn giao tuần (Kitchen Handover Summary)
│   ├── Giá vốn tuần (Food Cost Audit)
│   ├── Định mức theo món (Dish BOM Tray Cost)
│   └── Điều phối suất ăn (Meal Order Distribution)
│
├── [v] Kho nguyên liệu (Module Group)
│   ├── Nhập kho NCC (Goods Receiving)
│   ├── Xuất kho sản xuất (Kitchen Issuing)
│   ├── Xử lý ngoại lệ (Warehouse Exceptions)
│   └── Tra cứu & Sổ kho (Stock Lookup & Ledger)
│
├── [v] Thu mua vật tư (Module Group)
│   ├── Đơn mua định kỳ (Routine Purchasing Orders)
│   ├── Mua hàng bổ sung (Supplemental Purchasing)
│   └── Báo giá nhà cung cấp (Supplier Quotations)
│
├── [v] Bếp & Chế biến (Module Group)
│   ├── Ca sản xuất (Kitchen Shift Execution)
│   └── Chứng từ bàn giao (Kitchen Receipts & Returns)
│
├── [v] Duyệt vận hành (Module Group)
│   ├── Duyệt chứng từ (Transaction Approval Queue)
│   └── Duyệt điều chỉnh thực đơn (Menu Amendment Approval)
│
├── [v] Báo cáo vận hành (Module Group)
│   ├── Biến động giá (Price Variance Analytics)
│   ├── Nhu cầu vật tư (Material Demand Analytics)
│   ├── Tiến độ mua sắm (Procurement Progress)
│   ├── Tồn kho & Luân chuyển (Inventory Balances & Ledger)
│   └── Tiêu hao thực tế (Kitchen Consumption Variance)
│
└── [v] Quản trị hệ thống (Admin Module Group)
    ├── BOM & Định mức giá (Master BOM Formulas)
    ├── Hợp đồng khách hàng (Customer Contracts)
    ├── Quản trị tồn kho (Admin Inventory Master)
    ├── Nhân viên & Phân quyền (Users & RBAC)
    └── Quy trình phê duyệt (Approval Workflow Rules)
```

---

### 7.4. Quản lý Ngữ cảnh Dùng chung giữa các Tuyến đường (Shared Business Scope)
Các tham số và trạng thái trong hệ thống IPCManagement được phân định rõ ràng theo **Mô hình Thẩm quyền 4 Tầng (4-Tier Authority Model)** nhằm bảo đảm tính toàn vẹn dữ liệu, cô lập đa tab và hỗ trợ điều hướng nhất quán:

1. **Tier 1: Shareable / Navigation-Relevant Scope (Phạm vi Chia sẻ & Điều hướng - SHOULD):**
   - **Thành phần:** `customerId`, `weekStartDate`, `pricingTier`, phân hệ workspace hiện tại, `serviceDate` khi cần deep-link, và các bộ lọc báo cáo/danh sách khi cần phục hồi chính xác qua lịch sử Back/Forward.
   - **Nguyên tắc:** **SHOULD** thông thường có biểu diễn kinh điển (canonical representation) phục hồi được trên URL Query (`?customerId=CUST-01&weekStartDate=2026-08-24`).
   - **Lợi ích vận hành:**
     - Cho phép deep-linking và chia sẻ liên kết làm việc trực tiếp giữa các nhân sự điều phối.
     - Bảo đảm cô lập đa tab (Multi-tab isolation): Mở Customer A ở Tab 1 và Customer B ở Tab 2 hoàn toàn độc lập, không bị xung đột hay ghi đè chéo.
     - Duy trì điều hướng lịch sử trình duyệt Back/Forward trực quan và có thể tái tạo (reproducible).
     - Khi người dùng chuyển đổi giữa các workspace con trong cùng nhóm (ví dụ: từ *Kế hoạch tuần* sang *Nhu cầu nguyên liệu*), ứng dụng tự động bảo toàn các tham số phạm vi tương thích sang URL của route mới.

2. **Tier 2: Server-Authoritative Scope (Phạm vi Thẩm quyền Máy chủ - MUST):**
   - **Thành phần:** Danh tính người dùng xác thực (`authenticatedUser`), phân quyền vai trò (`permissions` / RBAC), năng lực tính năng hệ thống (`capabilities`), chế độ vận hành nghiệp vụ (`operationMode`: `DEFAULT` vs `MATERIAL_RECONCILIATION`), và trạng thái vòng đời thực thể (`entity lifecycle state`: Nháp, Đã gửi, Đã duyệt, Đã khóa). *(Ghi chú: IPCManagement hiện tại không có khái niệm multi-tenant trong mô hình nguồn).*
   - **Nguyên tắc:** Thẩm quyền máy chủ/phiên/miền nghiệp vụ (Backend / session / domain authority) **luôn giữ vai trò nguồn sự thật kinh điển (Canonical Authority)**. Client và URL Query tuyệt đối không được phép tự ý thay thế, ghi đè hoặc bypass thẩm quyền kiểm thực từ backend.

3. **Tier 3: Local UI State (Trạng thái Giao diện Cục bộ - MAY):**
   - **Thành phần:** Trạng thái đóng/mở khối chi tiết (`disclosure/accordion open/closed`), vùng chọn dòng tạm thời (`temporary row selection`), trạng thái soạn thảo/trình bày chưa lưu (`unsaved presentation state`), tương tác hover/focus, và trạng thái đóng/mở ngăn kéo cục bộ (`local drawer/dialog state`).
   - **Nguyên tắc:** **MAY** lưu trữ tại component state hoặc bộ nhớ cục bộ của ứng dụng (application memory state). Trạng thái này chỉ phục vụ cơ học tương tác (mechanics), không can thiệp vào thẩm quyền nghiệp vụ.

4. **Tier 4: Presentation Preference (Tùy chọn Trình bày Cá nhân - MAY):**
   - **Thành phần:** Trạng thái thu gọn sidebar (`sidebar collapsed state`: mở rộng vs icon rail), tùy chọn mật độ hiển thị (`density preference`: chuẩn vs cô đọng), và trạng thái ẩn/hiện cột tùy chọn trên bảng dữ liệu.
   - **Nguyên tắc:** **MAY** sử dụng `localStorage` hoặc cơ chế client storage tương đương để ghi nhớ tùy chọn cá nhân giữa các phiên làm việc của cùng một trình duyệt. Không nhúng tên khóa storage cục bộ cụ thể vào tài liệu thẩm quyền thiết kế.

5. **Bất biến Kiến trúc Thẩm quyền (Authority Invariant - MUST):**
   - **MUST NOT:** `localStorage` **tuyệt đối không được trở thành thẩm quyền** cho phạm vi nghiệp vụ cốt lõi (nghiêm cấm lưu `customerId`, `weekStartDate`, hay `batchId` vào `localStorage` làm nguồn sự thật) để triệt tiêu hoàn toàn rủi ro ô nhiễm chéo giữa các tab (Cross-tab pollution) hoặc thao tác nhầm khách hàng/dữ liệu.
   - **MUST:** Trạng thái UI cục bộ có thể phản chiếu phạm vi nghiệp vụ để phục vụ cơ học hiển thị (ví dụ: đồng bộ giá trị dropdown), nhưng **không được phép âm thầm trở thành nguồn sự thật cạnh tranh (competing source of truth)** với URL hoặc Server Authority.

---

### 7.5. Hợp đồng Tương tác Sidebar (Sidebar Interaction Contract)
1. **Cơ chế Disclosure thuần túy cho Nhóm Phân hệ (MUST & IPC Navigation Decision):**
   - **Bất biến ngữ nghĩa (MUST):** Tiêu đề nhóm phân hệ (Module Group) bắt buộc dùng `<button type="button">` thuần túy với thuộc tính `aria-expanded="true|false"`.
   - **Hướng dẫn kỹ thuật (Implementation Guidance - SHOULD):** Thuộc tính `aria-controls="..."` trỏ tới ID container danh sách con là khuyến nghị cài đặt kỹ thuật, không phải điều kiện MUST tiên quyết nếu cấu trúc DOM của container con nằm ngay liền kề sau nút bấm trong luồng đọc tự nhiên (tránh khóa chặt phụ thuộc ID không cần thiết).
   - **Quyết định Điều hướng IPC (IPC Navigation Decision):** Tiêu đề nhóm phân hệ không được đóng vai trò kép vừa là đích điều hướng (navigation target) vừa là nút kích hoạt mở rộng (disclosure trigger) khi gây nhập nhằng trải nghiệm. Nhóm phân hệ chỉ đóng vai trò là khối mở rộng (pure disclosure header); mọi đích đến điều hướng thực tế bắt buộc phải là các liên kết trang lá độc lập (thẻ `<a>`). Quyết định này triệt tiêu hoàn toàn xung đột thao tác trên thiết bị cảm ứng và bàn phím.
2. **Quy tắc Tự động Nâng cấp Mục Đơn (Single-Child Auto-Promotion Rule - SHOULD):**
   Khi kiểm tra quyền của người dùng (RBAC):
   - Nếu nhóm có **0 con hợp lệ**: Ẩn hoàn toàn nhóm cha khỏi DOM.
   - Nếu nhóm chỉ có **đúng 1 con hợp lệ**: Hệ thống **SHOULD** phẳng hóa mục đó thành một liên kết Level 1 trực tiếp. Nhãn của liên kết được nâng cấp phải thể hiện rõ miền nghiệp vụ (ví dụ: `Kho nguyên liệu` thay vì để nhãn mơ hồ "Danh sách").
   - Nếu nhóm có **$\ge 2$ con hợp lệ**: Render dưới dạng Expandable Disclosure Group.
3. **Tự động Mở khi Deep-Link (Deep-Link Auto-Expansion - MUST):**
   Khi người dùng vào thẳng một URL con hoặc refresh trang, nhóm cha chứa route active **bắt buộc phải tự động mở** (`aria-expanded="true"`), và link con nhận `aria-current="page"` để người dùng luôn định vị được vị trí trong hệ thống.
4. **Chỉ báo Tổ tiên (Ancestor Active Indicator - SHOULD):**
   Nếu người dùng chủ động thu gọn nhóm chứa route đang active, tiêu đề nhóm cha nên hiển thị vạch chỉ báo hoặc chấm màu nhận diện để không làm mất phương hướng.

---

### 7.6. Chính sách Điều hướng Thích ứng (Semantic Responsive Navigation)
Thay vì áp đặt các con số pixel cố định làm luật bất biến, hành vi điều hướng responsive được định nghĩa theo **chính sách ngữ nghĩa (Semantic Policies)** và sẽ được kiểm chứng qua mẫu phẩm thị giác dựa trên độ rộng khả dụng của bảng dữ liệu:

- **Khung nhìn Rộng (Wide Viewport):**
  Áp dụng **Sidebar mở rộng cố định (Persistent Expanded Sidebar)** khi bề mặt làm việc chính duy trì đủ không gian hiển thị các cột dữ liệu. Toàn bộ nhãn chữ và chevron hiển thị đầy đủ, giúp người vận hành bao quát toàn bộ các phân hệ làm việc.
- **Khung nhìn Trung bình (Medium Viewport):**
  Áp dụng **Sidebar thu gọn dạng Icon Rail (Compact Navigation Rail)** hoặc thu hẹp độ rộng thanh bên khi cần bảo vệ diện tích ngang cho các bảng dữ liệu dày đặc (bảng BOM, ma trận tuần). Hover/Focus hiển thị tooltip; click vào icon nhóm mở ra Popover Flyout bên cạnh mà không đẩy dồn diện tích của các bảng dữ liệu nhiều cột. Cho phép người dùng bấm nút ghim mở rộng nếu muốn.
- **Khung nhìn Hẹp (Narrow Viewport):**
  Áp dụng **Ngăn kéo Điều hướng Tạm thời (Temporary Navigation Drawer)** khi thanh bên cố định gây co ép không gian làm việc quá mức. Ẩn hoàn toàn khỏi màn hình làm việc; kích hoạt qua nút Hamburger trên header, hiển thị đè lên một lớp backdrop mờ và kích hoạt focus trap. Phím `Escape` hoặc bấm backdrop đóng drawer và hoàn trả focus về nút Hamburger. Điểm ngắt chính xác được xác định dựa trên chiều rộng tối thiểu của bảng dữ liệu và kết quả kiểm thử mẫu phẩm.

---

### 7.7. Tiếp cận Điều hướng & Chuẩn hóa ARIA APG (Accessibility Attribution)

1. **Chuẩn hóa Diện tích Bấm (Target Size - SOURCE FACT vs. IPC DECISION):**
   - **SOURCE FACT (WCAG 2.2 SC 2.5.8 Level AA):** Quy định diện tích tối thiểu cho phần tử tương tác là **$24 \times 24\text{ CSS px}$** (hoặc có vòng đệm cách ly $24\text{px}$).
   - **IPC DECISION:** Do đặc thù môi trường nhà bếp và kho bãi (tay ướt, đeo găng, thao tác vội), IPCManagement **chủ động áp dụng chuẩn công thái học cao hơn (IPC Usability Target)**: khuyến nghị kích thước tối thiểu theo token `control-size-standard` trên desktop và `control-size-touch` trên màn hình cảm ứng (tiệm cận chuẩn Level AAA SC 2.5.5). Đây là **quyết định công thái học của IPC, không phải mức sàn tối thiểu của WCAG AA**.
2. **Kỷ luật Bàn phím cho Disclosure Navigation Menu:**
   - **SOURCE FACT (W3C ARIA APG):** Bàn phím điều hướng menu website chuẩn mực dựa trên luồng phím `Tab` / `Shift+Tab` tự nhiên; phím `Enter` / `Space` đóng/mở nút disclosure. **Các phím mũi tên `ArrowLeft` / `ArrowRight` KHÔNG phải là yêu cầu bắt buộc của WCAG** đối với menu website dạng disclosure (phím mũi tên là tính năng tăng cường - MAY, không phải MUST).
   - **IPC DECISION:** Áp dụng luồng `Tab` / `Shift+Tab` làm cơ chế tiếp cận cốt lõi. Phím `Escape` đóng popover flyout hoặc mobile drawer.
3. **Tuyệt đối Cấm Dùng `role="menu"` cho Điều hướng Trang:**
   - **SOURCE FACT (W3C ARIA APG):** `role="menu"` và `role="menuitem"` được thiết kế riêng cho menu ứng dụng desktop (như menu File, Edit trên desktop app). Áp dụng chúng vào điều hướng website là một lỗi tiếp cận nghiêm trọng vì làm mất ngữ nghĩa link của trình đọc màn hình.
   - **IPC DECISION (MUST):** Bắt buộc dùng `<nav aria-label="Điều hướng chính">`, chứa `<ul role="list">`, `<li>`, thẻ liên kết `<a>` (với `aria-current="page"` khi active), và nút mở rộng `<button type="button">` (với `aria-expanded`). Cơ chế liên kết cấp thấp như `aria-controls` thuộc về hướng dẫn triển khai component, không ép thành MUST bắt buộc của toàn bộ thiết kế sản phẩm.

---

## 8. Page Templates (10 Reusable Enterprise Grammars)

Hệ thống định nghĩa 10 ngữ pháp trang chuẩn thay cho wireframe cố định. Mỗi template mô tả **Cấu trúc Ngữ nghĩa (Semantic Anatomy)**, phân định rõ giữa bất biến kiến trúc (MUST), mặc định khuyến nghị (SHOULD), và vùng thích ứng linh hoạt (MAY):

---

### Template 1: Operational Dashboard (Bàn điều hành vận hành)
- **Purpose:** Nhận diện tình huống vận hành và điểm tắc theo thời gian thực trong 2–3 giây theo chuẩn ISA-101.
- **Primary work object:** Ca vận hành hoặc chu kỳ điều phối hiện tại.
- **MUST (Semantic requirements only):**
  - Zone 1 thể hiện rõ định danh ca/ngày, phạm vi cơ sở và mốc thời gian cập nhật dữ liệu gần nhất.
  - Bề mặt cảnh báo ngoại lệ phải hiển thị rõ ràng ngay trong màn hình đầu tiên (Above-the-fold): hiển thị cảnh báo Tier 3/Tier 4 nếu có sự cố, hoặc xác nhận trạng thái danh định (All-clear / Nominal) khi hệ thống ổn định.
  - Cung cấp đường dẫn hoặc hành động điều hướng trực tiếp (1-click drill-down) từ điểm nghẽn đến hàng đợi xử lý tương ứng.
  - Toàn bộ trang vận hành sử dụng một ngữ cảnh cuộn duy nhất (Window scroll), nghiêm cấm bẫy cuộn lồng nhau (nested scroll trap) làm gián đoạn thao tác cuộn của điều phối viên.
- **SHOULD (Strong defaults):**
  - Các thẻ chỉ số vận hành cốt lõi (`MetricCard`) được ưu tiên theo mức độ khẩn cấp, tập trung vào thông lượng và số lượng ngoại lệ của ca.
  - Hiển thị tiến độ vòng đời ca/quy trình vận hành (`Stepper` hoặc `Timeline`).
  - Nút làm mới dữ liệu và chỉ báo trạng thái đồng bộ (`RefreshStatus`).
- **MAY (Valid layout options):**
  - Biểu đồ xu hướng phụ (Sparkline/Sparkbar) thể hiện dao động trong ca.
  - Bộ chọn nhanh cơ sở/dây chuyền tại Zone 2.
  - Sắp xếp và ưu tiên thứ tự hiển thị khối cảnh báo theo vai trò người dùng (Role-based layout).
- **When NOT to use (Chống chỉ định):**
  - Nhập liệu chi tiết, chỉnh sửa nhiều trường, hoặc soạn thảo hồ sơ giao dịch.
  - Thẩm định công thức phức tạp hoặc so sánh Before/After chi tiết (dùng Template 7).
  - Báo cáo phân tích đối soát đa kỳ hoặc đối chiếu số liệu lịch sử (dùng Template 10).

---

### Template 2: Worklist / Queue (Hàng đợi công việc / Triage Queue)
- **Purpose:** Sàng lọc, phân loại, ưu tiên và xử lý dứt điểm khối lượng lớn các đối tượng giao dịch đang chờ (hàng đợi duyệt, hàng đợi nhập kho, hàng đợi kiểm định).
- **Primary work object:** Mục hàng đợi giao dịch đơn lẻ (Queue Transaction Item).
- **MUST (Semantic requirements only):**
  - Zone 1 hiển thị chỉ số đếm số lượng mục chờ xử lý (Queue volume count badge).
  - Zone 2 cung cấp công cụ tìm kiếm và lọc trạng thái để người dùng nhanh chóng thu hẹp danh sách cần xử lý.
  - Phân định rõ hai trạng thái rỗng riêng biệt (`EmptyState`): "0 việc tồn đọng" (đã hoàn thành toàn bộ) vs "0 kết quả phù hợp" (không tìm thấy theo bộ lọc hiện tại).
  - Mỗi mục hàng đợi phải có định danh xác thực rõ ràng, trạng thái vòng đời hiển thị trực quan và hành động kích hoạt xử lý trực tiếp.
  - Bố cục danh sách/bảng phải duy trì được định danh hàng khi tương tác.
- **SHOULD (Strong defaults):**
  - Bảng cuộn dọc trong khung nhìn hoặc trang dài nên có tiêu đề dính (`sticky header`).
  - Khi bảng phát sinh cuộn ngang do vượt khung nhìn, cột định danh chính (Mã/Tên) nên được cố định bên trái (`sticky left`).
  - Tập trung vào các cột phục vụ quyết định sàng lọc; ẩn hoặc đẩy thông tin thứ yếu vào bề mặt chi tiết.
  - Mật độ hiển thị Compact/Standard theo token hệ thống; chiều cao hàng và nút bấm đồng bộ theo quy chuẩn mật độ.
  - Áp dụng phân trang phía máy chủ (`PaginationBar`) hoặc cuộn ảo khi tập dữ liệu hàng đợi có quy mô lớn (>50–100 mục).
- **MAY (Valid layout options):**
  - Nếu nghiệp vụ cho phép xử lý hàng loạt: cung cấp checkbox chọn dòng và thanh tác vụ gộp (`Batch Action Bar`) nêu rõ số lượng đang chọn.
  - Tabs phân loại nhanh theo trạng thái khẩn cấp (*Tất cả*, *Cần gấp*, *Quá hạn*).
  - Phân trang hoặc lọc phía client đối với các hàng đợi cục bộ có số lượng giới hạn theo ca.
  - Tùy biến ẩn/hiện cột qua `TablePreferencesControl`.
  - Hàng mở rộng chi tiết (Inline expandable row) để xem nhanh lý do ngoại lệ.
- **When NOT to use (Chống chỉ định):**
  - Lập kế hoạch và phân bổ nguồn lực trên ma trận 2 chiều (chuyển sang Template 3).
  - So sánh chi tiết sai lệch Trước vs Sau có tác động tài chính (chuyển sang Template 7).
  - Xem và lưu trữ chứng từ pháp lý độc lập duy nhất (chuyển sang Template 6).

---

### Template 3: Planning Workspace / Matrix (Ma trận Lập kế hoạch 2 chiều)
- **Purpose:** Lập kế hoạch, điều phối và cân bằng nguồn lực trên hai trục trực giao độc lập (Thời gian $\times$ Vị trí/Ca, Dây chuyền $\times$ Đơn hàng, hoặc Trạm $\times$ Món).
- **Primary work object:** Ô kế hoạch / phân bổ chỉ tiêu 2 chiều (Cell Assignment Slot).
- **MUST (Semantic requirements only):**
  - Zone 2 cung cấp bộ điều khiển phạm vi xác định rõ hai trục tọa độ, mốc chu kỳ kế hoạch, phiên bản và trạng thái khóa/ghi nhận.
  - Ma trận lưới 2D phải đồng bộ chuyển động cuộn trên cả hai trục, đảm bảo tiêu đề tọa độ không bị lệch khỏi ô dữ liệu tương ứng.
  - Trạng thái của từng ô phải phân biệt rõ ràng: ô trống, đã phân bổ, xung đột/vượt định mức, hoặc đã khóa.
  - Không để các hàng tiêu đề gom nhóm (Section Merge Header) làm rách bố cục lưới khi cuộn ngang.
- **SHOULD (Strong defaults):**
  - Cố định hàng tiêu đề trục ngang (`sticky top`) và cột định danh trục dọc (`sticky left`) khi ma trận vượt quá kích thước khung nhìn.
  - Khung ma trận tự động lấp đầy chiều cao khả dụng (`flex-1 min-h-0`) để tối đa hóa số ô quan sát được.
  - Hỗ trợ phím điều hướng nhanh giữa các ô (`ArrowKeys`, `Enter` mở chọn/nhập, `Escape` đóng/hủy).
  - Zone 3 hoặc thanh tóm tắt ngữ cảnh (`ContextStrip`) tổng hợp tổng lượng phân bổ, tỷ lệ lấp đầy, hoặc số điểm xung đột.
- **MAY (Valid layout options):**
  - Kéo-thả (Drag & Drop) đối tượng giữa các ô kế hoạch khi phù hợp với thiết bị chuột.
  - Bật/tắt hiển thị các lớp dữ liệu phụ trợ (chi phí, định mức nhân công, calo) theo nhu cầu phân tích.
  - Chuyển đổi góc nhìn ma trận (theo Ngày / theo Tuần, hoặc theo Dây chuyền / theo Sản phẩm).
- **When NOT to use (Chống chỉ định):**
  - Danh sách giao dịch tuyến tính 1 chiều (chuyển sang Template 2).
  - Dữ liệu dạng cây phân cấp sâu không có hệ tọa độ giao nhau (chuyển sang Template 4 hoặc 5).
  - Biểu mẫu nhập liệu tuần tự đơn lẻ (chuyển sang Template 8).

---

### Template 4: Dense Data Workspace (Bảng tính Dữ liệu Mật độ cao)
- **Purpose:** Tính toán chuyên sâu, kiểm toán số học, đối soát và hiệu chỉnh các tập dữ liệu định lượng quy mô lớn với nhiều cột phức tạp (BOM đa cấp, Nhu cầu NVL, Bảng phân bổ chi phí).
- **Primary work object:** Dòng định lượng hoặc dòng đối soát chi tiết (Ledger Line Item / BOM Line Item).
- **MUST (Semantic requirements only):**
  - Toàn bộ cột dữ liệu định lượng (số tiền, số lượng, tỷ lệ %) bắt buộc **căn phải** và bật **`font-variant-numeric: tabular-nums`**.
  - Số chữ số thập phân hiển thị phải tuân thủ nghiêm ngặt quy tắc đơn vị đo lường nghiệp vụ.
  - Cột định danh chính của dòng dữ liệu phải được giữ vững tầm nhìn khi bảng phát sinh cuộn ngang.
  - Phân vùng cuộn ngang cục bộ phải duy trì ranh giới chứa, không phá vỡ khung bao của trang hoặc gây tràn màn hình tổng thể.
- **SHOULD (Strong defaults):**
  - Bề mặt ngữ cảnh (`ContextStrip`) hiển thị các chỉ số tổng hợp định lượng cốt lõi (tổng giá trị, tổng khối lượng, số dòng sai lệch/ngoại lệ).
  - Sử dụng mật độ Compact (`density="compact"`) để tối ưu hóa lượng thông tin hiển thị trên màn hình làm việc mà vẫn đảm bảo khả năng click/focus.
  - Áp dụng tiêu đề cột 2 tầng (Grouped Column Headers) đối với các bảng có nhiều nhóm thuộc tính liên đới.
  - Áp dụng màu nền cảnh báo nhẹ hoặc trạng thái trực quan cho các dòng có thiếu hụt/ngoại lệ số liệu.
- **MAY (Valid layout options):**
  - Cố định cột đầu tiên (Frozen first column) hoặc cho phép cuộn tự do tùy thuộc vào số lượng cột hiển thị.
  - Công cụ tùy biến ẩn/hiện hoặc đổi thứ tự cột (`TablePreferencesControl`).
  - Chức năng xuất dữ liệu (Excel/CSV) tại Zone 2.
  - Cho phép chỉnh sửa số liệu trực tiếp trên dòng (Inline cell editing) theo quyền hạn.
- **When NOT to use (Chống chỉ định):**
  - Giao diện thẻ lớn, bố cục quảng bá nhiều khoảng trắng, hoặc văn bản tự sự dài.
  - Bàn điều hành tổng quan không yêu cầu thao tác bảng chi tiết (chuyển sang Template 1).
  - Nhập liệu biểu mẫu từng bản ghi đơn lẻ (chuyển sang Template 8).

---

### Template 5: Master–Detail (Phân tách Danh mục – Chi tiết / Split Workbench)
- **Purpose:** Kiểm tra, đối soát và thao tác trên danh sách đối tượng cha đồng thời theo dõi, xác nhận các dòng con phụ thuộc mà không làm mất ngữ cảnh và vị trí của danh sách cha.
- **Primary work object:** Cặp đối tượng tổng hợp Cha – Con (Parent–Child Aggregate, ví dụ: PO $\rightarrow$ Dòng hàng, Khách hàng $\rightarrow$ Thực đơn tuần).
- **MUST (Semantic requirements only):**
  - Bề mặt Master và Detail phải duy trì ngữ cảnh liên tục: mục đang được chọn trên Master bắt buộc có chỉ báo trực quan rõ nét và bền vững.
  - **Nghiêm cấm dùng Modal Dialog chặn màn hình chỉ để xem dòng con phụ thuộc (Rule M1.1)**, tránh làm mất định vị so sánh trong danh sách.
  - **Hợp đồng Ngữ nghĩa Chi tiết theo Hành vi Thực tế (Behavior-Based Semantics):**
    - **Bố cục Master–Detail bền vững (Persistent Master–Detail - SHOULD):** Khi nội dung là một phần cấu trúc trang thông thường, **SHOULD** ưu tiên bố cục chia vùng (Split Workbench), khung phụ trợ `<aside role="complementary">`, vùng `<section role="region">`, hoặc panel bên bền vững (persistent side panel).
    - **Hộp thoại Phi phương thức (Non-modal Dialog - MAY):** **MAY** được sử dụng khi tương tác thực sự hành xử như một non-modal dialog độc lập (ví dụ cửa sổ công cụ/thanh kiểm tra có thể di chuyển hoặc tách rời) mà không tạo backdrop chặn tương tác. Không cấm non-modal dialog một cách máy móc nếu tương tác thực sự hành xử như vậy.
    - **Hộp thoại / Ngăn kéo Phương thức (Modal Dialog / Drawer - MUST):** **MUST** chỉ sử dụng ngữ nghĩa modal (`role="dialog"`, `aria-modal="true"`, focus trap, nền `inert`) khi tương tác nền thực sự bị chặn (ví dụ trên màn hình nhỏ hoặc form chỉnh sửa sâu cần tập trung). Thuộc tính `aria-modal="true"` bắt buộc phải phản ánh tính phương thức thực tế; không quy định ARIA chỉ dựa trên vẻ ngoài thị giác.
  - Phím `Escape` đóng Detail và hoàn trả focus về phần tử kích hoạt trên Master.
- **SHOULD (Strong defaults):**
  - Trên màn hình rộng, ưu tiên bố cục chia đôi đồng thời (`SplitWorkbench` 50/50 đến 65/35) hoặc bảng chia trên/dưới.
  - Detail panel có thanh tiêu đề riêng, hiển thị định danh dòng cha đang chọn và nút đóng nhanh.
- **MAY (Valid layout options):**
  - Sử dụng hàng mở rộng nội dòng (Inline expandable row) nếu thông tin dòng con gọn nhẹ (<3–4 thuộc tính).
  - Thanh phân chia kích thước có thể kéo đổi tỷ lệ (Resizable Split Pane).
  - Cho phép chọn nhiều dòng Master để tổng hợp dữ liệu chung trên bề mặt Detail.
- **When NOT to use (Chống chỉ định):**
  - Dòng con đòi hỏi quy trình xử lý độc lập phức tạp, có chuỗi chứng từ và tab riêng biệt (chuyển sang Template 6).
  - Danh sách đơn giản mà toàn bộ thông tin chi tiết đã hiển thị trọn vẹn trong 5–7 cột của bảng (chuyển sang Template 2).

---

### Template 6: Object Detail / Document View (Hồ sơ Chứng từ / Document Record)
- **Purpose:** Kiểm tra toàn diện, xác nhận pháp lý, lưu trữ, in ấn hoặc phê duyệt một chứng từ/hồ sơ vận hành duy nhất.
- **Primary work object:** Bản ghi chứng từ nghiệp vụ duy nhất (Authoritative Document Record, ví dụ: Phiếu Nhập kho, Đơn đặt hàng).
- **MUST (Semantic requirements only):**
  - Zone 1 hiển thị breadcrumb định hướng quay lại danh sách cha, mã định danh chứng từ chuẩn mực và badge trạng thái vòng đời hiện tại.
  - Zone 2 hiển thị các hành động vòng đời phù hợp với trạng thái của chứng từ và quyền hạn của người dùng (In, Sửa, Xuất, Hủy).
  - Phân tách cấu trúc rõ ràng giữa khối thuộc tính định danh (Header Metadata) và khối nội dung chi tiết (Document Body).
  - Bắt buộc hỗ trợ hiển thị và in ấn sạch qua `@media print`, loại bỏ hoàn toàn sidebar điều hướng, nút bấm thao tác và các rail phụ trợ khi in.
- **SHOULD (Strong defaults):**
  - Lưới thuộc tính chứng từ thích ứng linh hoạt theo kích thước khung nhìn, tránh để khoảng trống dư thừa lớn.
  - Nếu chứng từ chứa danh mục hàng hóa/tài chính: hiển thị bảng dòng hàng có chân bảng (`tfoot`) tổng kết số tiền, thuế và số lượng.
  - Zone 5 SideRail thể hiện chuỗi tiến trình phê duyệt, lịch sử trạng thái hoặc các chứng từ liên đới trên màn hình rộng ($\ge 1366\text{px}$).
- **MAY (Valid layout options):**
  - Cung cấp nút sao chép nhanh mã chứng từ nếu mã này thường dùng trong đối soát ngoại bộ.
  - Khối thuộc tính cho phép thu gọn/mở rộng đối với chứng từ có quá nhiều trường thông tin.
  - Tab đính kèm chứng từ gốc, tệp scan hoặc ảnh nghiệm thu.
  - Bộ so sánh lịch sử các phiên bản sửa đổi (Revision History).
- **When NOT to use (Chống chỉ định):**
  - Thao tác hàng loạt nhiều chứng từ cùng lúc (chuyển sang Template 2).
  - So sánh đối chiếu trực tiếp các sai lệch Trước vs Sau giữa hai phiên bản (chuyển sang Template 7).

---

### Template 7: Approval / Decision Workbench (Bàn thẩm định & Ra quyết định)
- **Purpose:** Thẩm định rủi ro, đánh giá bằng chứng và ra quyết định phê duyệt hoặc từ chối đối với các yêu cầu điều chỉnh, đề xuất mua sắm hoặc hồ sơ đệ trình mới.
- **Primary work object:** Hồ sơ yêu cầu phê duyệt / Đề xuất điều chỉnh (Approval Request / Decision Object).
- **MUST (Semantic requirements only):**
  - Zone 1 định danh rõ đối tượng quyết định, người khởi tạo, thời điểm gửi và trạng thái xử lý hiện tại.
  - Bề mặt thẩm định cung cấp **đầy đủ bằng chứng xác thực cần thiết** để ra quyết định (Current Decision State & Supporting Evidence).
  - Chỉ hiển thị các hành động quyết định mà người dùng hiện tại có thẩm quyền thực hiện (Allowed Decision Actions).
  - Phản hồi trực quan rõ ràng về trạng thái sau khi ra quyết định (Resulting-State Feedback).
  - Nhập lý do từ chối (Rejection Rationale) **chỉ bắt buộc khi hợp đồng nghiệp vụ của domain yêu cầu**.
  - Phân định rõ ngữ nghĩa giữa hai hành động quyết định: Phê duyệt (`variant="primary"`) và Từ chối (`variant="destructive"`).
- **SHOULD (Strong defaults):**
  - Cặp nút hành động quyết định được neo giữ ở vị trí dễ thấy (CommandBar trên cùng hoặc thanh Dock cố định) để không bị khuất khi duyệt hồ sơ dài.
  - Đối với các yêu cầu điều chỉnh số liệu, nên làm nổi bật các giá trị bị thay đổi để người duyệt tập trung vào điểm sai lệch.
  - Zone 5 SideRail hiển thị các cấp phê duyệt trong quy trình và ý kiến thẩm định của các cấp trước đó.
- **MAY (Valid layout options):**
  - Bảng so sánh Trước vs Sau (Before vs After Diff Table) khi nghiệp vụ là điều chỉnh số lượng/công thức.
  - Bảng tổng hợp chỉ tiêu đơn lẻ đối với các hồ sơ tạo mới (không có dữ liệu cũ để so sánh).
  - Phê duyệt kèm điều kiện hoặc ghi chú nghiệp vụ bổ sung.
  - Ghi chú trực tiếp trên từng dòng dữ liệu bị lệch.
- **When NOT to use (Chống chỉ định):**
  - Duyệt các giao dịch thường nhật hàng loạt không có ngoại lệ hay chênh lệch định mức (chuyển sang Template 2).
  - Chỉnh sửa trực tiếp nội dung biểu mẫu nghiệp vụ (chuyển sang Template 8).

---

### Template 8: Form / Editor (Biểu mẫu Cấu hình & Soạn thảo)
- **Purpose:** Nhập liệu, cấu hình và khởi tạo các thực thể có cấu trúc phức tạp với cơ chế bảo vệ tính toàn vẹn dữ liệu tại biên tin cậy (Trust Boundary).
- **Primary work object:** Thực thể cấu hình hoặc bản ghi nghiệp vụ đang trong trạng thái soạn thảo/chỉnh sửa (Master Record / Draft Entity).
- **MUST (Semantic requirements only):**
  - Nhãn (Label) của mọi trường bắt buộc luôn hiển thị rõ ràng; **tuyệt đối không dùng placeholder để thay thế nhãn trường (Rule I1)**.
  - **Nghiêm cấm disable nút Submit khi form có lỗi (Rule I4 / F1.2)**: khi người dùng bấm Submit, form phải hiển thị thông báo lỗi, tự động cuộn đến trường lỗi đầu tiên và focus vào input đó.
  - Thông báo lỗi phải đặt sát trường nhập liệu, có cả biểu tượng và văn bản mô tả, không chỉ đổi màu viền (Rule I3).
  - Phân định rõ hành động Lưu/Submit với hành động Hủy. Nút Xóa mang tính phá hủy **chỉ xuất hiện khi chỉnh sửa thực thể đã tồn tại và có quyền xóa, cấm đưa vào form tạo mới**.
  - Bắt buộc kích hoạt cảnh báo rời trang (`isDirty` guard) nếu người dùng có dữ liệu đã thay đổi nhưng chưa lưu.
- **SHOULD (Strong defaults):**
  - Gom cụm các trường nhập liệu có liên quan thành các khối chuyên đề (`SectionPanel`) để người dùng dễ theo dõi.
  - Phân chia quy trình theo từng bước rõ ràng (`Stepper`) khi biểu mẫu có các giai đoạn phụ thuộc tuần tự.
  - Bố cục lưới form thích ứng theo loại dữ liệu và kích thước màn hình (1 cột trên mobile, đa cột hợp lý trên desktop).
- **MAY (Valid layout options):**
  - Cơ chế tự động lưu nháp (Autosave Draft) đối với các biểu mẫu dài.
  - Tùy chọn "Lưu và tiếp tục tạo mới" để tăng tốc nhập liệu liên tục.
  - Zone 5 SideRail cung cấp hướng dẫn nghiệp vụ, giải thích chính sách hoặc bảng xem trước kết quả tính toán tức thì.
- **When NOT to use (Chống chỉ định):**
  - Nhập liệu số lượng lớn các dòng bảng tính lặp đi lặp lại (chuyển sang Template 4).
  - Bật/tắt các thiết lập đơn giản dạng công tắc đơn lẻ không cần màn hình soạn thảo riêng.

---

### Template 9: Read-only / Locked Workspace (Không gian làm việc Đã khóa)
- **Purpose:** Xem, kiểm toán và đối chiếu các chứng từ hoặc kế hoạch đã chốt sổ bất biến nhằm ngăn chặn hoàn toàn việc vô tình sửa đổi khi quy trình hạ nguồn đã vận hành.
- **Primary work object:** Hồ sơ kế hoạch, kỳ kế toán, hoặc chứng từ ở trạng thái khóa bất biến (Locked / Archived Artifact).
- **MUST (Semantic requirements only):**
  - Zone 1 hiển thị rõ ràng chỉ báo trạng thái khóa kèm biểu tượng ổ khóa.
  - Cung cấp ngữ cảnh lý do khóa và chứng từ hạ nguồn liên đới để người dùng hiểu lý do không thể chỉnh sửa.
  - Loại bỏ hoàn toàn các nút thao tác làm thay đổi dữ liệu (Lưu, Sửa, Xóa, Gửi duyệt). Các hành động cho phép chỉ gồm: Xem, Xuất dữ liệu, In ấn, Xem lịch sử, hoặc "Yêu cầu mở điều chỉnh".
  - Dữ liệu hiển thị phải thể hiện rõ tính chất không thể chỉnh sửa nhưng vẫn đảm bảo độ tương phản cao, dễ đọc theo chuẩn WCAG AA; không sử dụng kiểu chữ mờ xám khó đọc của các trường disabled thông thường.
- **SHOULD (Strong defaults):**
  - Giữ nguyên cấu trúc hình học và vị trí các trường của màn hình gốc để người dùng duy trì khả năng định vị không gian quen thuộc.
  - Thể hiện dữ liệu dưới dạng văn bản tĩnh sắc nét (Static Typography) đối với biểu mẫu, hoặc thuộc tính `readOnly` đối với các ô bảng tính/lưới phức tạp nhằm bảo toàn khả năng sao chép và định dạng ô.
  - Cung cấp liên kết trực tiếp (Deep-link) đến các chứng từ hạ nguồn có liên quan.
- **MAY (Valid layout options):**
  - Nút "Yêu cầu mở điều chỉnh" kích hoạt quy trình phê duyệt mở khóa (chuyển tiếp sang Template 7).
  - Dấu mộc chìm (Archival Watermark) xác nhận hồ sơ lưu trữ chính thức.
  - Cho phép chuyển đổi giữa chế độ đọc tinh gọn và chế độ xem chi tiết từng trường.
- **When NOT to use (Chống chỉ định):**
  - Bản ghi đang trong giai đoạn soạn thảo, lập nháp hoặc đang chờ duyệt (dùng Template 6, 7 hoặc 8).
  - Báo cáo phân tích tổng hợp không bắt nguồn từ một hồ sơ chứng từ gốc có thể chỉnh sửa (chuyển sang Template 10).

---

### Template 10: Report / Analytics (Báo cáo Phân tích & Đối soát Đa kỳ)
- **Purpose:** Phân tích dữ liệu lịch sử tổng hợp, tỷ lệ hao hụt nguyên vật liệu, sai lệch định mức và hiệu suất cung ứng qua nhiều chu kỳ phục vụ đối soát và lập kế hoạch chiến lược.
- **Primary work object:** Tập dữ liệu phân tích / Kỳ đối soát tổng hợp (Historical Analytical Dataset).
- **MUST (Semantic requirements only):**
  - Zone 2 bộ lọc đa chiều bắt buộc phải được đồng bộ hai chiều với tham số URL (URL Query Params) để bảo toàn trạng thái khi lưu bookmark hoặc chia sẻ liên kết.
  - Mọi cột dữ liệu định lượng phải **căn phải** và bật **`font-variant-numeric: tabular-nums`**, đồng thời ghi rõ đơn vị đo lường tại tiêu đề cột.
  - Các hoạt động cập nhật dữ liệu ngầm **tuyệt đối không được làm gián đoạn phân tích của người dùng**: không tự ý nhảy trang, không làm dịch chuyển vị trí cuộn chuột và không âm thầm thay thế dữ liệu khi người dùng đang đối chiếu số liệu.
  - Trạng thái rỗng phải phân biệt rõ giữa "Kỳ này chưa có dữ liệu ghi nhận" và "Không có dữ liệu thỏa mãn bộ lọc hiện tại".
- **SHOULD (Strong defaults):**
  - Zone 3 ContextStrip tóm tắt các chỉ số hiệu suất và tổng lượng cốt lõi theo phạm vi lọc đã chọn.
  - Áp dụng phân trang phía máy chủ hoặc cuộn ảo khi tập dữ liệu phân tích có quy mô lớn hoặc mở rộng không giới hạn (>100 dòng); đối với các báo cáo tổng hợp theo kỳ cố định (ví dụ: 12 tháng), hiển thị trọn vẹn phía client.
  - Chức năng xuất dữ liệu (Excel/CSV) tại Zone 2 tự động đính kèm đầy đủ các tham số bộ lọc đang kích hoạt.
  - Bảng dữ liệu có dòng tổng kết cố định ở chân bảng (`tfoot`) cho các cột tích lũy số học.
- **MAY (Valid layout options):**
  - Nút chuyển đổi linh hoạt giữa Chế độ Bảng số liệu chi tiết và Chế độ Biểu đồ trực quan hóa xu hướng.
  - Tương tác Drill-down: bấm vào một dòng dữ liệu tổng hợp để mở danh sách giao dịch chi tiết cấu thành.
  - Khả năng lưu cấu hình bộ lọc yêu thích của người dùng.
- **When NOT to use (Chống chỉ định):**
  - Điều phối và xử lý dứt điểm các sự cố vận hành trực tiếp trong ngày (chuyển sang Template 1).
  - Kiểm tra pháp lý hoặc ký duyệt một chứng từ đơn lẻ (chuyển sang Template 6 hoặc 7).

---

## 9. Design Readiness & Process Governance (Quy trình Sẵn sàng Thiết kế)

Áp dụng trước mọi thay đổi **tạo, sửa hoặc loại bỏ UI**. Thiết kế phải truy vết được từ bài toán người dùng đến luồng công việc, authority, dữ liệu, composition và oracle kiểm chứng:

### 9.1. Design Brief Bắt buộc (14 trường)
```text
Problem/outcome: Ai gặp vấn đề gì; hoàn thành công việc hoặc ra quyết định nào?
Change: Tạo UI | Sửa UI | Bỏ UI; phạm vi và ngoài phạm vi.
Context: Chế độ vận hành (DEFAULT / MRX); work object, grain, đơn vị và data scope.
Actors: Người khởi tạo, người xem, người quyết định, người nhận việc tiếp theo; phân tách trách nhiệm.
Authority: Quyết định nghiệp vụ; BE policy/claims/state guard; FE route/query/action owner.
Journey: Đầu vào/entry point -> tác vụ hiện tại -> đầu ra/next owner; ngữ cảnh Back/deep-link.
Actions: Tiền điều kiện -> điều hướng hoặc lệnh -> hậu điều kiện -> đích chuyển tiếp.
Visibility: Hiển thị route/tab/row/field/action theo actor; lý do ẩn/disabled/read-only/forbidden.
States/recovery: Query state + entity state + draft/pending; lỗi, conflict/stale, retry/cancel/recovery.
Data safety: Tác động tạo/sửa/xóa; draft chưa lưu, dependent records, lịch sử bất biến, audit, undo.
Composition: Floorplan 5 vùng, scope controls, primary action, mapping một state/một surface; geometry role.
Coherence: Cùng object/state ở màn hình upstream và downstream có cùng nhãn và hành động hợp lệ.
Acceptance: Rule IDs, kịch bản kiểm thử, kết quả kỳ vọng, red-capable oracle, viewport scope.
Open decisions: Điều chưa rõ về nghiệp vụ/quyền/dữ liệu cần Product Owner quyết định.
```

### 9.2. Ma trận Actor–Action–Transition
Mọi kịch bản thay đổi quyền hoặc trạng thái phải được lập ma trận:
`Actor | Mode | Data Scope | Entity State | Action | BE Guard | FE Eligibility | Block Reason | Destination | Next Owner | Evidence`
- **Bắt buộc phân định cả actor bị từ chối**, không chỉ mô tả luồng thành công của Admin.
- Backend bắt buộc chặn request trái phép; không fetch dữ liệu nhạy cảm rồi chỉ che bằng CSS.

### 9.3. Cổng Đánh giá Sẵn sàng (Ready Gate)
- `PASS`: Brief đầy đủ, authority nhất quán, acceptance quan sát được, oracle kiểm chứng rõ ràng.
- `BLOCKED`: Thiếu quyết định nghiệp vụ/quyền hạn; dừng triển khai phần phụ thuộc, không đoán mò để code tiếp.
- `NEEDS_EVIDENCE`: Chưa có source/oracle cần thiết để khóa quyết định.

---

## 10. Components Catalog

Hệ thống phân định rõ giữa **Headless Mechanics** (xử lý sự kiện, focus, accessibility) và **Operational Primitives** (bố cục và hiển thị dữ liệu):

```text
IPC UI KIT
├── Headless Mechanics (Base UI + Tailwind v4)
│   ├── Button, Input, Textarea, Select, Checkbox, RadioGroup
│   ├── Tabs (Roving tabIndex), Dialog (Modal focus trap), Drawer (Modal vs Concurrent Region)
│   ├── Popover, Tooltip, DropdownMenu (Action-only)
│   └── Sidebar Navigation (Disclosure Nav, Semantic Links, Icon Rail)
└── Operational Primitives
    ├── Layout: OperationalFrame, CommandBar, SectionPanel, SplitWorkbench, SideRail
    ├── Data: TableViewport, TableSkeleton, ContextStrip, MetricCard, PaginationBar
    └── Feedback: QueryViewBoundary, EmptyState, InlineAlert, StatusBadge, ToastProvider
```

### Quy tắc Bất biến về Component
1. **Không tạo song song (MUST):** Nghiêm cấm tạo `ButtonV2`, `CustomTable`, hay `NewDialog`. Nếu component thiếu tính năng, mở rộng component hiện có bằng kiểm thử hồi quy.
2. **Component không chứa logic nghiệp vụ (MUST):** Các component trong `shared/ui` không được import model nghiệp vụ hoặc enum của domain.

### 10.2. Giải phẫu Thành phần & Bố cục Phối hợp (Component Anatomy & Composition)
Giao diện vận hành của IPCManagement tuân thủ ngữ pháp 5 phân vùng cố định trên nền canvas Cool Slate (`#f1f5f9`):
1. **Zone 1: Định danh Vùng làm việc (`OperationalFrame`)**:
   - Chứa Breadcrumb điều hướng, Tiêu đề trang H1 (Sentence Case, font-bold 18px), nhãn trạng thái tổng thể và hành động then chốt.
   - Sở hữu đường viền hairline dưới `border-b border-[#cbd5e1]`, loại bỏ hoàn toàn viền đóng hộp 4 cạnh.
2. **Zone 2: Thanh Lệnh & Phạm vi (`CommandBar`)**:
   - Chứa bộ lọc phạm vi bắt buộc (Khách hàng, Tuần thực đơn, Ca làm việc), ô tìm kiếm nội dòng (`w-64`), nút lọc mở rộng và nút xuất file Excel/CSV.
   - Chiều cao điều khiển đồng bộ 32px (Compact) hoặc 36px (Standard), liên kết chặt chẽ với mật độ bảng bên dưới.
3. **Zone 3: Phân khúc Điều hướng Cục bộ (`WorkspaceTabs`)**:
   - Sử dụng thẻ tab phẳng không viền hộp, chỉ báo active bằng đường viền đáy 2px màu Primary Action Navy (`#164e87`) với transition 150ms.
4. **Zone 4: Vùng Bảng Biểu Vận hành (`TableViewport`)**:
   - Bề mặt làm việc chính màu trắng (`#ffffff`), bao bọc bởi duy nhất một đường viền ngoài 1px (`border border-[#cbd5e1] rounded-[3px]`).
   - Tuyệt đối cấm lồng thêm viền thẻ con bên trong (`box-in-a-box syndrome`). Tiêu đề cột `th` dùng Sentence Case trên nền `bg-[#f8fafc]`.
5. **Zone 5: Khung Bổ trợ / Ngăn kéo Chi tiết (`ComplementaryAside` / `Drawer`)**:
   - Xuất hiện song song (Modality C) trên màn hình $\ge 1366\text{px}$ qua vạch phân chia hairline đứng `border-l border-[#e2e8f0]`, hoặc trượt từ mép phải (Modality B) trên tablet/mobile.

---

## 11. Iconography, Data Display & Table Patterns

### 11.1. Kiến trúc Biểu tượng Hai tầng (Two-Tier Icon Architecture)
Nhằm giải quyết triệt để sự nhập nhằng giữa các biểu tượng cơ học giao diện và các khái niệm nghiệp vụ bếp ăn công nghiệp, hệ thống thiết lập kiến trúc hai tầng dứt khoát:

```text
TWO-TIER ICON ARCHITECTURE
├── TIER 1: SYSTEM MECHANICS ICONS (Biểu tượng Cơ học Giao diện)
│   ├── Bộ icon nền tảng: Lucide Icons (chuẩn hóa stroke 2.0px, viewBox 0 0 24 24)
│   ├── Kích thước chuẩn đóng: 16px (size-4) trong input/nút/bảng; 20px (size-5) trong header/nav
│   └── Vai trò: Search, X, ChevronDown, Filter, Plus, Trash2, Pencil, Download, Upload, Copy, RefreshCw...
└── TIER 2: CURATED DOMAIN ICON VOCABULARY (Danh mục Biểu tượng Nghiệp vụ Chọn lọc)
    ├── Bản chất hiện tại: Các phép ẩn dụ ngữ nghĩa chọn lọc từ thư viện Lucide (Curated Lucide Semantic Metaphors)
    ├── Phong cách hình học: Đơn sắc (monochrome), tối giản, nét stroke 2.0px đồng nhất với Lucide (không sticker màu)
    └── Nguyên tắc cốt lõi: CÙNG MỘT BIỂU TƯỢNG KHÔNG ĐƯỢC MANG Ý NGHĨA XUNG ĐỘT (không lạm dụng tạo icon cho mọi danh từ)
```

### 11.2. Chính sách Hình tượng Nghiệp vụ & Phân loại 22 Biểu tượng Domain
Dựa trên kết quả khảo sát từ Flaticon và kho dữ liệu thực tế 571 tệp/91 icon Lucide hiện hành:
1. **Dấu hiệu Nhận diện Sản phẩm Hiện hành (Current Product Mark - ChefHat):**
   - Biểu tượng `ChefHat` được phân loại là **CURRENT PRODUCT MARK** (dấu hiệu sản phẩm hiện hành của IPC System trên Login và đỉnh Sidebar). Đây là dấu hiệu tạm thời được bảo lưu, không tự động coi là nhận diện thương hiệu vĩnh viễn (Final Brand Identity).
   - Tuyến đường phân hệ Bếp (`/chef/*`) và vai trò Bếp trưởng bắt buộc chuyển sang sử dụng hình tượng chuẩn **`CookingPot`**, giải quyết triệt để va chạm ngữ nghĩa với logo hệ thống.
2. **Tháo dỡ Nạp chồng 6-Hướng của Biểu tượng Scale (MUST):**
   - Biểu tượng `Scale` (Chiếc cân) bị nạp chồng vô độ trong code cũ (dùng cho cả đối chiếu, tính giá, nổ BOM, cân thực tế, kế hoạch phần ăn).
   - **Quy tắc bảo tồn 1-1:** Biểu tượng `Scale` **CHỈ ĐƯỢC PHÉP SỬ DỤNG DUY NHẤT** cho phân hệ **Đối chiếu Sai lệch & Cân đối Vật tư (Material Variance Reconciliation)**.
   - Các nghiệp vụ khác được phân rã sang hình tượng đặc thù:
     - Công thức nấu & Định mức BOM $\rightarrow$ **`BookOpen`**
     - Giá vốn, Biên lợi nhuận & Tài chính $\rightarrow$ **`Coins`**
     - Thao tác cân trọng lượng thực phẩm thừa tại dock $\rightarrow$ **`Weight`**
     - Nhu cầu vật tư tính toán từ kế hoạch $\rightarrow$ **`Calculator`**
     - Chứng từ đơn mua hàng thương mại $\rightarrow$ **`ReceiptText`**
     - Quản lý tồn kho & Thẻ kho $\rightarrow$ **`Boxes`**
3. **Phân loại Trạng thái Danh mục 22 Biểu tượng Nghiệp vụ:**
   - **`KEEP` (14 biểu tượng cốt lõi):** `CookingPot` (Bếp), `Warehouse` (Kho), `PackageCheck` (Nhập NCC), `PackageMinus` (Xuất sản xuất), `ArrowRightLeft` (Bàn giao kho-bếp), `Boxes` (Tồn kho/thẻ kho), `Scale` (Đối chiếu NVL), `BookOpen` (Công thức/BOM), `Coins` (Giá vốn/lãi), `Weight` (Cân thực tế), `Calculator` (Nhu cầu NVL), `ReceiptText` (Đơn mua PO), `Handshake` (Hợp đồng NCC), `Utensils` (Điều phối suất ăn).
   - **`OPTIONAL` (4 biểu tượng thứ cấp):** `CalendarClock` (Lập lịch tuần), `ClipboardCheck` (Hàng đợi duyệt), `FolderTree` (Cây danh mục), `LayoutDashboard` (Bàn điều hành).
   - **`MERGE_SEMANTICALLY` (2 biểu tượng gộp):** `PlusCircle` (gộp vào `Plus` cơ học kèm nhãn chữ), `TrendingUp` (gộp vào `Coins` hoặc nhãn tỷ lệ % dạng text).
   - **`NEEDS_EVIDENCE` (2 biểu tượng):** `Flame` (Nhiệt độ chế biến - chờ phân hệ HACCP), `Package` (Bưu kiện chung - chờ chuẩn hóa kho vận).
4. **Quy chế Nghiên cứu & Giới hạn Pháp lý từ Flaticon (MUST):**
   - Kho tư liệu Flaticon chỉ được sử dụng cho mục đích **nghiên cứu phép ẩn dụ hình ảnh (Metaphor Research)** trong tài liệu thiết kế.
   - **Nghiêm cấm tải trực tiếp SVG/PNG của Flaticon vào mã nguồn production**, loại bỏ rủi ro bẫy bản quyền ghi công (Attribution Trap) và nguy cơ rác hình ảnh (visual noise từ các gói sticker đa màu). Mọi biểu tượng nghiệp vụ mới phải được chuẩn hóa bằng vector SVG đơn sắc tuân thủ thông số kỹ thuật Lucide.

### 11.3. Quy chuẩn Hiển thị Dữ liệu & Bảng Vận hành (Data Display & Tables)
1. **Căn lề dữ liệu chuẩn (MUST):**
   - Cột văn bản, tên nguyên vật liệu, tên nhà cung cấp: **Căn trái** (`text-left`).
   - Cột số lượng, định mức BOM (6 số thập phân), đơn giá, thành tiền VND, tỷ lệ %: **Căn phải** (`text-right`) và **bắt buộc dùng `tabular-nums`**.
   - Cột mã chứng từ ngắn, ngày tháng, trạng thái: **Căn giữa** hoặc **Căn trái** tùy header.
2. **Kỷ luật Sentence Case cho Tiêu đề Cột (MUST):**
   Tiêu đề bảng bắt buộc viết dạng Sentence Case (`Mã NVL`, `Tên nguyên vật liệu`, `Định mức BOM`) thay vì All-Caps để triệt tiêu hiện tượng xếp chồng dấu thanh tiếng Việt và giữ khoảng thoáng hàng 32px/36px an toàn.
3. **Ưu tiên Tên nghiệp vụ trước Mã kỹ thuật (Rule L1 - SHOULD):**
   Tên nguyên vật liệu hoặc tên món ăn hiển thị in đậm ở dòng chính; mã kỹ thuật (`NVL-0012`) hiển thị dạng monospace nhỏ hơn ở dòng phụ bên dưới, đi kèm nút copy tiện ích.
4. **Cố định Header & Cột nhận diện (Rule T7 - SHOULD):**
   Bảng cuộn ngang nên cố định cột tiêu đề (`thead` sticky top) và cột nhận diện đầu tiên (Tên/Mã NVL sticky left với nền trắng tuyền).

---

## 12. Status, Criticality & Feedback (Mô hình ISA-101 4-Tier)

Để triệt tiêu hội chứng "Dashboard Cầu Vồng" (Rainbow Dashboard), trạng thái được phân cấp theo **mức độ nghiêm trọng vận hành** thay vì gán màu theo cảm tính:

```text
[ Tier 4 ]  Solid Filled Badge  (Ngoại lệ rất hiếm)    LỖI CHẶN VẬN HÀNH / THIẾU NVL NGHIÊM TRỌNG (Crimson)
[ Tier 3 ]  Subtle Soft Lozenge (Cần can thiệp)        Chờ phê duyệt / Cần kiểm tra / Cảnh báo (Amber/Teal 10% tint)
[ Tier 2 ]  Colored Dot + Text  (Tiến trình động)      Đang xử lý / Đang giao / Lưu nháp (Chấm 6px + Text trung tính)
[ Tier 1 ]  Plain Neutral Text  (Mặc định bình thường) TRẠNG THÁI HOÀN TẤT / DANH MỤC KHÔNG ĐỔI (Slate Text, không màu)
```

1. **Kỷ luật triệt tiêu màu (ISA-101 Quiet Baseline - SHOULD):**
   Khi một trạng thái chiếm ưu thế trong bảng (trạng thái bình thường như "Đã duyệt", "Hoàn tất", "Khớp BOM"), trạng thái đó **mặc định hiển thị dạng chữ xám trung tính không màu** (`--color-text-secondary` / text-muted). Màu sắc chỉ dành riêng cho việc thu hút ánh mắt người vận hành vào các ngoại lệ cần xử lý.
2. **Không truyền đạt trạng thái chỉ bằng màu sắc (WCAG 1.4.1 - MUST):**
   Mọi badge trạng thái phải có chữ tường minh (`GLOSSARY.md`) và icon hình học đặc trưng (Ví dụ: Tam giác cảnh báo cho Warning, Hình bát giác cho Danger, Vòng tròn tick cho Success).

---

## 13. Interaction State Contracts

Mọi tương tác trên các control cốt lõi phải tuân thủ danh mục 16 trạng thái chuẩn mực và 6 quy tắc giải quyết xung đột thứ tự ưu tiên:

### 13.1. Danh mục 16 Trạng thái Tương tác Chuẩn (Canonical Interaction States)
*Nguyên tắc Thẩm quyền: Phân định ranh giới giữa Từ vựng Trạng thái Toàn cục (Global State Vocabulary) và Cơ chế Thành phần Cụ thể (Component-Specific Mechanics). Không áp đặt cơ chế vô hiệu hóa cứng cho mọi trường hợp.*

- **ST-01: Default / Rest** — Trạng thái tĩnh ban đầu, viền chuẩn `--color-border-strong` (`#64748b`) cho form controls, độ tương phản $\ge 3:1$.
- **ST-02: Hover** — Phản hồi lướt chuột: Nút chính tăng độ tối 10% (`#113c69`), hàng bảng chuyển nền `#f0f4f8`.
- **ST-03: Active / Pressed** — Phản hồi bấm micro-tactile: Nút bấm dịch chuyển 1px theo trục Y (`translate-y-px`), duy trì trong 100ms.
- **ST-04: Focus-Visible** — Điều hướng bàn phím: Vòng ring 2px xanh `#2d7acf`, offset 2px trên thẻ trắng, hoặc inset ring 2px trên sidebar.
- **ST-05: Disabled / Unavailable Variations** — Phân định rõ 4 hình thái không khả dụng tùy theo ngữ cảnh thành phần:
  - *Native Disabled (`<button disabled>`)*: Dành cho phần tử hoàn toàn không áp dụng, không cần giải thích; loại khỏi luồng Tab, opacity 50%, `cursor: not-allowed`.
  - *Aria-Disabled (`<button aria-disabled="true">`)*: Dành cho hành động bị khóa có điều kiện (ví dụ nút Duyệt khi chưa chọn dòng). **Bắt buộc duy trì trong luồng Tab**, cấm dùng `pointer-events: none`, cho phép focus để đọc tooltip giải thích lý do bị khóa và điều kiện cần mở.
  - *Readonly (`<input readOnly>`)*: Dữ liệu chỉ đọc theo phân quyền; duy trì focus và khả năng bôi đen/copy chữ, nền xám nhạt không thể sửa.
  - *Locked*: Bản ghi bị khóa do chu kỳ đã chốt/đã duyệt; hiển thị icon ổ khóa kèm liên kết truy nguyên chứng từ khóa.
- **ST-06: Loading / Pending Mutation** — Đang gửi yêu cầu: Khóa tương tác (`aria-busy="true"`), hiển thị icon xoay tròn `Loader2`, cố định kích thước bề mặt (không gây giật chiều rộng).
- **ST-07: Invalid / Error** — Dữ liệu không hợp lệ: `aria-invalid="true"`, viền đỏ Crimson `#b91c1c`, kèm thông điệp hỗ trợ lỗi bên dưới.
- **ST-08: Selected** — Mục được chọn trong bảng/danh sách: Nền xanh nhạt `#f0f5fc`, checkbox tích chọn, duy trì trạng thái khi cuộn.
- **ST-09: Indeterminate** — Checkbox chọn một phần: Hiển thị dấu gạch ngang (`Minus`), `aria-checked="mixed"`.
- **ST-10: Current / Active Route** — Tuyến đường hiện tại trên Sidebar: `aria-current="page"`, vạch nhận diện bên trái 3px màu `#164e87`, nền `bg-[#f0f5fc]`.
- **ST-11: Expanded / Collapsed** — Trạng thái mở/đóng danh mục: `aria-expanded="true|false"`, chevron xoay 180°, chuyển đổi chiều cao bằng CSS Grid.
- **ST-12: Readonly Display** — Hiển thị dạng chữ tĩnh thuần túy không viền hộp khi form chuyển sang chế độ xem hồ sơ.
- **ST-13: Locked Document Link** — Liên kết chứng từ đã chốt dẫn tới hồ sơ quyết toán hoặc PO gốc.
- **ST-14: Stale / Disconnected** — Dữ liệu cũ do mất kết nối mạng: Cảnh báo icon hổ phách, bảo toàn dữ liệu chỉnh sửa dở trong form.
- **ST-15: Ancestor Active** — Nhóm Sidebar bị đóng nhưng chứa route con đang active: Hiển thị chấm tròn nhận diện 6px tại tiêu đề nhóm cha.
- **ST-16: Drag / Reorder** — Thao tác sắp xếp lại: Cursor `grab` / `grabbing`, đường chỉ thị vị trí thả (drop target line) 2px màu xanh `#164e87`.

### 13.2. Sáu Quy tắc Thứ tự Ưu tiên khi Xung đột Trạng thái (State Precedence Rules)
1. **Quy tắc 1: Input Lỗi + Focus Bàn phím (`Invalid` + `Focus-Visible`)**:
   Khi một trường nhập liệu vừa không hợp lệ (`aria-invalid="true"`) vừa nhận focus bàn phím, **màu đỏ cảnh báo lỗi chiến thắng hoàn toàn**. Viền input giữ màu Crimson `#b91c1c` và vòng focus ring nhận màu đỏ mờ 25% (`ring-rose-500/25`), tuyệt đối không bị màu xanh `#2d7acf` đè bẹp.
2. **Quy tắc 2: Link Sidebar Hiện tại + Focus Bàn phím (`Current` + `Focus-Visible`)**:
   Khi tab hoặc link sidebar đang ở trang hiện tại (`aria-current="page"`) nhận focus bàn phím, **vạch chỉ báo trái 3px màu `#164e87` bắt buộc được bảo toàn nguyên vẹn**, đồng thời vòng focus ring 2px được vẽ lùi vào trong (inset ring) để không làm vỡ căn lề.
3. **Quy tắc 3: Nút bấm Đang nạp + Hover / Disabled (`Loading` + `Hover` / `Disabled`)**:
   Khi nút bấm đang trong trạng thái loading, `pointer-events: none` được kích hoạt ngay lập tức. Mọi hiệu ứng hover hoặc active bị vô hiệu hóa; chiều rộng và chiều cao nút được cố định tuyệt đối bằng CSS (`min-w-[...]`) để tránh co giật khi chuyển từ text sang spinner.
4. **Quy tắc 4: Hàng Bảng Đang chọn + Lướt chuột (`Selected` + `Hover`)**:
   Hàng bảng đang được chọn (`bg-[#f0f5fc]`) khi hover chuột sẽ chuyển sang tông xanh đậm hơn một nấc (`bg-[#e2edf9]`), giữ vững nhận diện đã chọn nhưng vẫn cung cấp phản hồi vị trí con trỏ chuột.
5. **Quy tắc 5: Checkbox Đã chọn + Vô hiệu hóa (`Checked` + `Disabled`)**:
   Dấu tích chọn màu trắng được giữ nguyên nhưng nền xanh chuyển sang màu xám Slate-400 (`#94a3b8`), `opacity-50`, thông báo rõ ràng rằng mục này đã được chọn nhưng không được phép hủy.
6. **Quy tắc 6: Nhóm Mở rộng + Con Hiện tại + Focus (`Expanded` + `Current-Descendant` + `Focus`)**:
   Nhóm cha duy trì chỉ báo ancestor active, chevron xoay 180°, và nhận vòng focus ring bao quanh nút mở rộng mà không làm mất trạng thái của các link con bên trong.

---

## 14. Motion & Reduced Motion Rules

Hệ thống chuyển động của IPCManagement được thiết kế như một **công cụ đo lường công nghiệp tĩnh lặng (Quiet Precision Instrument)**: nhanh, dứt khoát, không rung lắc, cung cấp phản hồi xúc giác tức thì mà không gây reflow layout.

### 14.1. Bộ Token Thời lượng & Easing Ngữ nghĩa (Semantic Motion Tokens)
```css
:root {
  /* Motion Duration Tokens */
  --motion-duration-instant: 0ms;       /* Chuyển trạng thái tức thì, chuẩn baseline cho reduced-motion */
  --motion-duration-micro: 100ms;       /* Phản hồi xúc giác: Bấm nút, tick checkbox, radio scale, popover */
  --motion-duration-component: 150ms;   /* Thành phần giao diện: Dropdown, accordion mở rộng, trượt tab, tooltip */
  --motion-duration-overlay: 200ms;     /* Lớp phủ màn hình: Dialog modal, drawer slide-in, flyout rail */

  /* Motion Easing Curves (Tối ưu hóa phản hồi công nghiệp) */
  --motion-ease-standard: cubic-bezier(0.16, 1, 0.3, 1); /* Đường cong giảm tốc dứt khoát chuẩn enterprise */
  --motion-ease-enter: cubic-bezier(0, 0, 0.2, 1);        /* Giảm tốc nhanh khi tiến vào màn hình */
  --motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);         /* Tăng tốc nhanh khi rời khỏi màn hình */
}
```

### 14.2. Danh mục Thuộc tính Cho phép & Quy tắc Chống Reflow Layout
1. **Thuộc tính Cho phép (GPU Composite Layer Whitelist):**
   - Chỉ được phép tạo animation trên: `transform` (`translate3d`, `scale`, `rotate`), `opacity`.
   - Màu sắc (`color`, `background-color`, `border-color`) và bóng đổ focus (`box-shadow`) chỉ áp dụng transition trên các bề mặt nhỏ.
2. **Quy tắc Chống Reflow Layout (Reflow Prevention Rules - MUST):**
   - **Nghiêm cấm** animate các thuộc tính gây tính toán lại bố cục toàn trang: `width`, `height`, `min-width`, `max-width`, `margin`, `padding`, `top`, `left`.
   - **Quy tắc Bounded Layout Transition:** Khi mở rộng nhóm danh mục hoặc thanh bên, **cấm dùng transition `height: auto`**. Bắt buộc dùng CSS Grid:
     ```css
     .ipc-disclosure-content {
       display: grid;
       grid-template-rows: 0fr;
       transition: grid-template-rows 150ms var(--motion-ease-standard);
     }
     .ipc-disclosure-content[data-state="expanded"] {
       grid-template-rows: 1fr;
     }
     .ipc-disclosure-content > div {
       overflow: hidden;
     }
     ```
     Kỹ thuật chuyển đổi bố cục cục bộ giới hạn (Bounded Layout Transition) này giữ công việc tính toán layout bên trong container disclosure, hạn chế tối đa nguy cơ ảnh hưởng giàn trang lan truyền tới các bảng dữ liệu lớn bên ngoài.

### 14.3. Hợp đồng 12 Mẫu Chuyển động Vận hành Cốt lõi
1. **Nút Bấm (Button Press):** 100ms, `translateY(1px)` khi active, standard curve.
2. **Vòng Focus (Focus Ring):** 100ms, nở đều từ 0px lên 2px quanh phần tử, enter curve.
3. **Checkbox Pop:** 100ms, scale từ 0.5 lên 1.0 kèm opacity fade cho dấu SVG tick.
4. **Sidebar Accordion:** 150ms, grid-template-rows 0fr $\rightarrow$ 1fr, chevron xoay 180°.
5. **Rail Flyout:** 200ms, trượt ngang 8px kèm fade-in từ mép icon rail.
6. **Tooltip:** 150ms, scale 0.96 $\rightarrow$ 1.0 kèm fade-in, không làm xê dịch layout xung quanh.
7. **Chỉ báo Tab (Tab Indicator):** 150ms, trượt viền đáy mượt mà giữa các tab.
8. **Dialog Modal:** 200ms, overlay backdrop fade (opacity 0 $\rightarrow$ 1), dialog card scale 0.98 $\rightarrow$ 1.0.
9. **Drawer Slide-in:** 200ms, GPU translate3d(100% $\rightarrow$ 0%), không gây cuộn giật màn hình nền.
10. **Toast Notification:** 150ms, trượt từ dưới lên `translateY(8px -> 0px)` kèm fade-in.
11. **Skeleton Pulse:** Chu kỳ 1200ms nhấp nháy êm dịu ở chế độ chuẩn.
12. **Chọn Hàng Bảng (Row Selection):** 100ms chuyển màu nền sang xanh nhạt khi click chọn.

### 14.4. Kiến trúc Triệt tiêu Chuyển động (`prefers-reduced-motion: reduce`)
Tuân thủ tiêu chuẩn WCAG 2.2 SC 2.3.3 Level AAA (áp dụng như quy chuẩn bắt buộc nội bộ IPC Decision):
Khi người dùng kích hoạt reduced motion trong hệ điều hành, toàn bộ duration bị ép về `0ms`, chuyển động vị trí bị xóa bỏ, và khung xương skeleton chuyển về bề mặt xám tĩnh mờ cố định:
```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-instant: 0ms;
    --motion-duration-micro: 0ms;
    --motion-duration-component: 0ms;
    --motion-duration-overlay: 0ms;
  }

  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .animate-pulse {
    animation: none !important;
    opacity: 0.75 !important;
  }
}
```

---

## 15. Asynchronous State System (12 Lifecycle States - MUST)

Mọi khối dữ liệu bất đồng bộ phải xử lý tường minh 12 trạng thái vòng đời, không để sót góc chết:

1. **Initial Loading:** Hiển thị `TableSkeleton` hoặc khung xương có kích thước khớp với layout thực tế; cấm dùng spinner xoay tròn giữa màn hình trắng.
2. **Refreshing / Refetching:** Giữ nguyên dữ liệu hiện tại, hiển thị thanh tiến trình nhỏ ở góc trên (`RefreshStatus`). Không khóa màn hình, không giật layout.
3. **Ready:** Dữ liệu hiển thị đầy đủ, kích hoạt các nút thao tác.
4. **Ready-Empty:** Truy vấn thành công nhưng có 0 bản ghi. Hiển thị `EmptyState` kèm icon, tiêu đề giải thích lý do rỗng và nút tạo mới.
5. **Prerequisite Missing:** Chưa chọn phạm vi bắt buộc (khách hàng/tuần). Nút bấm trên banner đưa focus ngay tới bộ chọn ở CommandBar.
6. **Forbidden (403):** Thông báo rõ người dùng không có quyền và cung cấp link liên hệ cấp quyền; cấm giả mạo thành bảng rỗng không có dữ liệu.
7. **Recoverable Error (500/503):** Hiển thị `InlineAlert variant="danger"` kèm nút "Thử lại" (`retry()`).
8. **Fatal Error:** Error Boundary toàn trang với nút "Tải lại trang" (`window.location.reload()`).
9. **Stale Data:** Cảnh báo dữ liệu có thể đã cũ do mất kết nối mạng; bảo toàn dữ liệu đang sửa dở.
10. **Readonly vs. Locked:** Phân biệt rõ quyền chỉ đọc do role (Readonly) và trạng thái bị khóa do quy trình đã chốt (Locked kèm mã chứng từ hạ nguồn).
11. **Pending Mutation:** Nút bấm hiển thị spinner và khóa tương tác để tránh double-submit.
12. **Success Feedback:** Toast tự đóng sau 5000ms hoặc thông báo hoàn tất chuyển trạng thái.

---

## 16. Accessibility & Keyboard Invariants (WCAG 2.2 AA)

### Danh mục MUST (Bắt buộc theo chuẩn WCAG 2.2 AA):
1. **Bàn phím hoàn chỉnh (No Keyboard Traps - SC 2.1.1, 2.1.2):** Mọi chức năng dùng chuột được thì phải dùng bàn phím được (`Tab`, `Shift+Tab`, `Space`, `Enter`).
2. **Focus Trap trong Modal Dialog:** Khi modal mở, focus bị khóa bên trong modal; phím `Escape` đóng modal và đưa focus trả về nút đã bấm mở modal. Các phần tử phía sau nhận thuộc tính `inert`.
3. **Roving Tabindex trên Tablist (W3C ARIA APG Tabs / SC 2.1.1, SC 2.4.3):** Dùng phím mũi tên `ArrowLeft` / `ArrowRight` để chuyển đổi giữa các tab; phím `Home` về đầu, `End` về cuối. (Lưu ý: Phím mũi tên chỉ áp dụng cho tablist/lưới dữ liệu; menu website dạng disclosure sử dụng `Tab`/`Enter`/`Space` làm mặc định).
4. **Diện tích mục tiêu tương tác tối thiểu (SC 2.5.8 Level AA):** Sàn quy chuẩn WCAG AA là $\ge 24 \times 24\text{ CSS px}$ (hoặc có khoảng cách ly). Lưu ý: Chuẩn $36\text{px}$–$40\text{px}$ (desktop) và $44\text{px}$ (cảm ứng) là quyết định công thái học nội bộ của IPC (IPC Usability Target) vượt trên mức sàn WCAG AA.
5. **Độ tương phản tối thiểu (SC 1.4.3, 1.4.11):** Chữ thường $\ge 4.5:1$, viền form control và focus ring $\ge 3.0:1$.
6. **Thông báo qua ARIA Live Region (SC 4.1.3):** Các thay đổi động, lưu ngầm hoặc toast phải có `role="status"` và `aria-live="polite"`. Lỗi nghiêm trọng dùng `role="alert"` và `aria-live="assertive"`.
7. **Hợp đồng Ngăn kéo / Vùng Chi tiết theo Hành vi Thực tế:**
   - **Drawer chặn tương tác (Modal Dialog / Drawer - MUST):** Bắt buộc dùng `role="dialog"`, `aria-modal="true"`, focus trap và nền `inert` khi tương tác nền thực sự bị khóa.
   - **Vùng xem chi tiết bền vững (Persistent Master–Detail - SHOULD):** Ưu tiên `<aside role="complementary">`, `<section role="region">`, hoặc Split Workbench khi nội dung thuộc cấu trúc trang thông thường.
   - **Hộp thoại phi phương thức (Non-modal Dialog - MAY):** Non-modal dialog (`aria-modal="false"`) MAY được dùng khi tương tác thực sự hành xử như một non-modal dialog độc lập. Thuộc tính `aria-modal` bắt buộc phản ánh đúng hành vi tương tác thực tế, không suy diễn từ vẻ ngoài thị giác.

---

## 17. Responsive Adaptation Strategy

Chính sách thích ứng theo ngữ cảnh khung nhìn:

- **Khung nhìn Rộng (Wide Viewport):**
  Sidebar mở rộng cố định theo token `--sidebar-expanded-width`. Bảng 10–15 cột hiển thị đầy đủ. Master-Detail dạng split song song.
- **Khung nhìn Trung bình (Medium Viewport):**
  Sidebar thu gọn thành Icon Rail theo token `--sidebar-compact-width` (hoặc `--sidebar-rail-width`) kèm popover flyout khi click. Bảng cuộn ngang cục bộ với cột đầu sticky.
- **Khung nhìn Hẹp (Narrow Viewport):**
  Sidebar ẩn vào Off-Canvas Drawer (nút hamburger). Form 2 cột chuyển thành 1 cột. Nút bấm nâng lên tối thiểu theo token `control-size-touch` để chạm cảm ứng an toàn trong môi trường bếp/kho (IPC Touch Target; vượt chuẩn tối thiểu 24px của WCAG 2.5.8 AA).

---

## 18. Do / Don't Rules (Cặp quy tắc đối ứng)

| Lĩnh vực | DO (Bắt buộc làm) | DON'T (Tuyệt đối cấm) |
|---|---|---|
| **Điều hướng & Sidebar** | Dùng `<button type="button">` thuần túy để đóng/mở nhóm sidebar; link là thẻ `<a>` riêng biệt. | Cấm gán nhãn nhóm phân hệ đóng vai trò kép vừa là link chuyển trang vừa là nút đóng/mở (tránh nhập nhằng mục tiêu điều hướng và gây xung đột thao tác cảm ứng/bàn phím). |
| **Nhân bản Điều hướng** | Khi workspace đã có trên Sidebar, dùng layout chuyên trách cho trang đó. | Cấm lặp lại một hàng tab ngang gồm đúng các workspace đã có trên Sidebar. |
| **Hành động & Màu sắc** | Nút chính mặc định dùng semantic token `primary-action` (`--color-action-primary-bg`); cho phép cặp Duyệt (`primary-action`) / Từ chối (`danger`) trên bàn thẩm định. | Cấm đặt 2 nút Primary cùng loại cạnh nhau hoặc dùng màu Primary cho các bộ lọc thường. |
| **Bảng & Số liệu** | Căn phải toàn bộ số lượng, đơn giá, thành tiền và bật `tabular-nums`. | Cấm căn giữa hoặc căn trái số tiền/định lượng BOM. Cấm để số bị co giãn khi refetch. |
| **Bóng đổ & Bề mặt** | Dùng viền hairline 1px theo token `border-default` (`--color-border-default`) để phân định bảng và card trên nền canvas. | Cấm dùng drop-shadow đậm trên các hàng bảng hoặc thẻ card thông thường. |
| **Trạng thái & Badge** | Trạng thái bình thường hiển thị chữ xám trung tính không viền theo ISA-101. | Cấm biến toàn bộ bảng thành "cầu vồng" với các lozenge xanh/đỏ/vàng dày đặc. |
| **Bo góc (Radius)** | Giữ đúng bộ từ vựng: `--radius-none` bảng, `--radius-sm` input, `--radius-md` button, `--radius-lg` modal. | Cấm dùng bo góc dạng viên thuốc (`--radius-full` / pill) cho nút bấm hoặc trạng thái trong bảng. |
| **Tiếng Việt & Font** | Dùng chiều cao dòng an toàn (khuyến nghị theo token typography chuẩn cho bảng) và sentence case cho tiêu đề bảng. | Cấm dùng `line-height: 1.0` hoặc all-caps dài khiến dấu mũ tiếng Việt bị cắt ngọn. |
| **Bố cục & Rỗng** | Hiển thị đúng một bề mặt giải thích khi thiếu phạm vi (Prerequisite state). | Cấm render bảng rỗng trắng tinh rồi chèn thêm một alert giải thích ở dưới. |
| **Quyền & Lỗi** | Trả về thông báo từ chối quyền rõ ràng khi nhận mã HTTP 403 Forbidden. | Cấm biến lỗi 403 thành "Không tìm thấy dữ liệu" đánh lừa người dùng. |

---

## 19. Reconstruction Policy (Tái cấu trúc giao diện)

**LEGACY UI LÀ BẰNG CHỨNG NGHIỆP VỤ, KHÔNG PHẢI MỤC TIÊU THỊ GIÁC.**

Khi tiến hành tái cấu trúc presentation layer từ đầu (Greenfield presentation + Brownfield verified behavior):
1. **Được phép thay thế hoàn toàn:** Mã CSS cũ, file CSS redesign tạm bợ, cây JSX cũ, các hàng tab ngang mức route cũ (bao gồm cả 6 tab Thực đơn tuần khi chuyển lên Sidebar), cấu trúc thẻ card thừa thãi, khoảng cách pixel cũ, và các snapshot hình ảnh cũ không phản ánh đúng chuẩn này.
2. **Bắt buộc bảo toàn nguyên vẹn (MUST preserve):** Luồng nghiệp vụ đã kiểm chứng, từ vựng domain (`GLOSSARY.md`), quyền hạn actor, các guard chặn chuyển trạng thái, công thức tính toán tài chính và tính chính trực của chuỗi dữ liệu FE $\rightarrow$ API $\rightarrow$ DB.
3. **Phân loại kiểm thử khi refactor:**
   - *Behavior & Contract tests:* Bắt buộc giữ nguyên hoặc mở rộng để chứng minh logic nghiệp vụ không đổi.
   - *Accessibility tests:* Bắt buộc PASS theo WCAG 2.2 AA.
   - *Legacy Presentation string-matching tests:* Phải được audit và tái cấu trúc bằng `test-audit`, loại bỏ các test chỉ mirror tên class CSS cũ.

---

## 20. Visual Specimen Validation Phase (Xác thực Mẫu phẩm Thị giác)

Giao diện vận hành của IPCManagement **không thể được chứng minh chỉ bằng kết quả kiểm thử headless hay một ảnh chụp đơn lẻ**. Mọi thay đổi presentation layer bắt buộc phải trải qua quy trình Xác thực Mẫu phẩm Thị giác (Visual Specimen Validation) trên môi trường non-production trước khi merge vào nhánh chính:

### 20.1. Khái niệm Mẫu phẩm Thị giác (Visual Specimen)
Mẫu phẩm thị giác là **ảnh chụp màn hình kết xuất thực tế từ trình duyệt có đầu (headed Chrome)** của một route hoặc component cụ thể, được ghi nhận trong điều kiện vận hành xác thực:
- Đúng vai trò người dùng (Actor credentials thật).
- Đúng chế độ vận hành (Operation mode: DEFAULT hoặc MATERIAL_RECONCILIATION).
- Đúng hạt dữ liệu (Data grain: ngày/ca thực tế, không dùng chuỗi mock tùy tiện).
- Đúng độ phân giải mục tiêu trong ma trận viewport.

### 20.2. Ba Cổng Xác thực Mẫu phẩm Phân loại theo Hạng mục (Three Specimen Gates by Category)

Trước khi khởi động tái cấu trúc quy mô lớn, hệ thống phải vượt qua 3 cổng kiểm thử mẫu phẩm được phân loại minh bạch theo 4 nhóm kiểm định (Standards Gate, IPC Quality Target, Candidate Token Validation, Optional Manual Exploration):

#### Gate 1: Diacritic Orthography Specimen Suite (Kiểm thử Dấu Tiếng Việt)
Trang mẫu non-production chứa các chuỗi stress-test tiếng Việt phức tạp (`Điều phối`, `Định mức theo món`, `Bếp trưởng`, `1.234.567 ₫`, `136,571 kg`) trên Windows Chrome & Edge tại Display Scaling 100%, 125%, 150%, và Browser Zoom 200%.
- **[B. IPC QUALITY TARGET]** Không cắt ngọn, chồng đè hoặc biến dạng dấu thanh ghép tiếng Việt (`ế`, `ệ`, `ở`, `ồ`) trong mọi trạng thái hiển thị và zoom trình duyệt.
- **[C. CANDIDATE TOKEN VALIDATION]** Kiểm chứng thực nghiệm mật độ ô bảng với ứng viên `32px` (`py-1 text-[13px] leading-[18px]`) và `36px` (`py-1.5 px-2 text-[13px] leading-[18px]`): xác định biên độ an toàn của khoảng đệm ô và độ cao dòng (`leading`) khi render glyph tiếng Việt có dấu kép.

#### Gate 2: Multi-Monitor Color Calibration Suite (Kiểm định Màu sắc Đa màn hình)
- **[A. STANDARDS GATE]** Tương phản toán học WCAG 2.2 AA tự động (Automated Contrast): Tối thiểu $4.5:1$ cho văn bản thông thường và $3.0:1$ cho thành phần giao diện / viền đồ họa quan trọng (`border-strong` `#64748b` trên canvas `#f1f5f9`).
- **[C. CANDIDATE TOKEN VALIDATION]** Phân định sắc độ và hình thái rõ ràng giữa Primary Action Navy `#164e87` và Info Blue `#0369a1`; viền form input `#64748b` nhận diện rõ trên nền slate canvas mà không bị lẫn vào nền.
- **[D. OPTIONAL MANUAL EXPLORATION]** Đánh giá trực quan đa màn hình (Multi-Monitor Visual Inspection): Kiểm tra độ sai lệch màu và khả năng đọc trên các loại tấm nền văn phòng phổ thông (TN, VA, IPS) và laptop giá rẻ tại cơ sở sản xuất làm tín hiệu tham khảo thủ công, không chặn CI tự động.
- **[D. OPTIONAL MANUAL EXPLORATION]** Tín hiệu tương phản cảm nhận bổ trợ (APCA Supplemental Signal): Sử dụng thuật toán APCA để đo lường độ đọc cảm nhận (perceptual readability) cho các cấp bậc chữ nhỏ/mờ làm tín hiệu tham khảo tối ưu hóa thêm, không dùng để thay thế chuẩn WCAG 2.2 AA.

#### Gate 3: Fallback Font Swap & Layout Stability Trace (Kiểm định CLS)
Playwright giả lập độ trễ nạp font trên đường truyền mạng Windows 10/11:
- **[B. IPC QUALITY TARGET]** Chỉ số ổn định bố cục (Cumulative Layout Shift - CLS) khi hoán đổi phông chữ từ hệ thống Segoe UI sang Inter Variable đạt tiêu chuẩn nghiêm ngặt: $\text{CLS} < 0.05$.

### 20.3. Yêu cầu Mẫu phẩm Hệ thống Điều hướng Sidebar (Navigation Specimen) Phân loại theo Hạng mục
Mẫu phẩm điều hướng Sidebar bắt buộc chứng minh và phân loại rõ các tiêu chí sau:

1. **[A. STANDARDS GATE] Cơ học Phím & Tiếp cận W3C ARIA APG:**
   - Trạng thái chỉ báo focus bàn phím rõ nét (`focus-visible:ring-2 focus-visible:ring-[#2d7acf]`).
   - Luồng phím tuần tự `Tab` / `Shift+Tab`; phím `Enter` / `Space` kích hoạt nút disclosure; phím `Escape` đóng drawer/popover.
   - Không xuất hiện bẫy bàn phím (No keyboard trap).
   - Thẻ ngữ nghĩa hợp lệ: Dùng `<nav>`, `<ul>`, `<li>`, `<a>` và `<button type="button">`. Khai báo thuộc tính trợ năng chính xác: `aria-current="page"` trên liên kết active, `aria-expanded="true|false"` trên nút mở rộng. Tuyệt đối không dùng `role="menu"` cho điều hướng trang.
2. **[B. IPC QUALITY TARGET] Cơ học Điều hướng & Trình bày Nghiệp vụ IPC:**
   - Chế độ hiển thị linh hoạt: Sidebar mở rộng cố định (Persistent Expanded) trên màn hình lớn và thanh thu gọn (Compact Rail) trên màn hình trung bình.
   - Nhóm mở rộng (Expandable Group) chuyển đổi mượt mà giữa trạng thái mở và đóng.
   - Link con đang active luôn hiển thị vạch chỉ báo nhận diện.
   - Nhóm cha bị đóng nhưng chứa link con active phải hiển thị chỉ báo tổ tiên (Ancestor Active Indicator).
   - Quy tắc nâng cấp mục đơn (Single-Child Auto-Promotion): Nhóm chỉ có đúng 1 route con hợp lệ phải được phẳng hóa thành liên kết cấp 1 trực tiếp.
   - Chống vỡ layout: Các nhãn điều hướng tiếng Việt dài tự động ngắt dòng hoặc rút gọn an toàn mà không làm rách khung Sidebar.
   - Phục hồi ngữ cảnh deep-link: Tự động mở đúng nhóm cha và focus/định vị đúng route con khi nạp trang trực tiếp từ URL.
   - **Quyết định về Compact Rail (Architecture Decision):** `COMPACT_RAIL` được phân loại là **`OPTIONAL / PROVISIONAL`**. Mô hình 2-tier rút gọn (Expanded Sidebar trên Desktop $\rightarrow$ Temporary Drawer trên Tablet/Mobile) được khuyến nghị làm kiến trúc responsive mặc định tinh gọn hơn, giúp giảm bớt sự phân mảnh nhận thức và độ phức tạp bảo trì của trạng thái trung gian 3-chế độ.

### 20.4. Kiến trúc Tách biệt Hai Mặt bằng Mẫu phẩm (Dual-Surface Model)
Nhằm khắc phục triệt để hiện tượng mẫu phẩm thị giác bị biến thành "bảng chẩn đoán kỹ thuật gồ ghề", hệ thống phân tách dứt khoát thành hai bề mặt độc lập trong cùng một harness `/tests/fixtures/specimen.html`:

```text
NON-PRODUCTION SPECIMEN HARNESS (/tests/fixtures/specimen.html)
├── SURFACE 1: DESIGN SYSTEM GALLERY (Thư viện Thành phần & Quy chuẩn Vận hành)
│   ├── Đối tượng phục vụ: Đánh giá trực quan của con người, PM, Designer, Frontend Engineers
│   ├── Trực quan thuần khiết: 100% sạch bóng các badge QA ("PASS", "NON-PRODUCTION", "SC 1.4.11")
│   ├── Bố cục thực tế: Thể hiện đúng giao diện sản phẩm thật với Zone 1 OperationalFrame, Zone 2 CommandBar
│   ├── Không gian vận hành mẫu: Workbench Nhu cầu NVL (Material Demand) với số liệu thực tế, định mức BOM 6 số
│   └── Chuẩn mực thẩm mỹ: Nền Cool Slate (#f1f5f9), thẻ trắng (#ffffff), hairline 1px (#cbd5e1), ISA-101 tĩnh lặng
└── SURFACE 2: TECHNICAL EVIDENCE LABORATORY (Phòng Thí nghiệm Đo lường Kỹ thuật)
    ├── Đối tượng phục vụ: Playwright runner, Vitest suites, CI/CD automated gates, audit tiếp cận
    ├── Dụng cụ đo lường tự động:
    │   ├── Thiết bị đo 1: Bảng tính toán độ tương phản sRGB WCAG 2.2 tự động cho 12 cặp màu cốt lõi
    │   ├── Thiết bị đo 2: Cảm biến quét tràn dấu Tiếng Việt (DOM ScrollHeight Probe so sánh clientHeight)
    │   ├── Thiết bị đo 3: Máy đo vi sai bề rộng ký tự số Tabular Figures (độ lệch < 0.20px)
    │   └── Thiết bị đo 4: Mô phỏng co giãn 320px CSS width (Reflow 200% Zoom) không sinh thanh cuộn ngang
    └── Đầu ra máy đọc: Khối JSON `#specimen-telemetry-output` phục vụ trích xuất tự động trong CI pipeline
```

### 20.5. Sáu Chiến lược Phân định Thị giác theo Trật tự "Quiet Operational"
Bố cục giao diện công nghiệp của IPCManagement tuân thủ nghiêm ngặt 6 chiến lược phân định thị giác, ưu tiên từ ít mực thị giác nhất (Quiet / Zero-ink) đến đậm nhất:
1. **Khoảng cách & Độ gần (Spacing & Proximity - Zero-ink):** Sử dụng hệ nhịp 4px (`--space-1` = 4px, `--space-2` = 8px, `--space-4` = 16px, `--space-6` = 24px). Nếu khoảng trắng đủ để nhóm các phần tử liên đới, tuyệt đối không vẽ đường viền bao quanh.
2. **Sắc thái Màu nền (Background Tone - Subtle):** Phân định ranh giới tự nhiên giữa nền canvas Cool Slate (`#f1f5f9`), bề mặt thẻ làm việc trắng tuyền (`#ffffff`), và tiêu đề bảng `th` xám nhẹ (`#f8fafc`). Tương phản nhẹ 1.05:1 tự động tạo khối mà không cần viền đậm.
3. **Phân cấp Chữ & Căn lề (Typography & Alignment - Semantic):** Căn phải các cột số định lượng và mã tiền tệ VND tạo thành các luồng đọc dọc tự nhiên; tiêu đề phân cấp rõ bằng kích cỡ (18px/16px/14px/13px/12px) và màu sắc (`#0f172a` primary vs `#334155` secondary vs `#475569` muted).
4. **Vạch Phân cách Hairline 1D (Hairline Divider - 1px Subtle):** Dùng đường kẻ hairline 1px (`#e2e8f0`) để ngăn cách giữa các hàng bảng hoặc các cụm công cụ; tuyệt đối không đóng thành hộp 4 cạnh.
5. **Đường bao Vùng Vận hành Ngoài cùng (Container Perimeter - 1px Structural):** Chỉ sử dụng 1 đường viền duy nhất (`border border-[#cbd5e1] rounded-[3px]`) bao quanh phân vùng lớn nhất (như toàn bộ `TableViewport` hoặc `SplitWorkbench`). **Ngăn chặn hội chứng lồng hộp nhiều tầng (Box-in-a-box syndrome).**
6. **Bóng đổ & Nổi bề mặt (Elevation & Shadows - Floating Layers Only):** Bề mặt phẳng 2D toàn trang. Bóng đổ (`shadow-md`, `shadow-xl`) chỉ được phép xuất hiện trên các lớp nổi độc lập (Popover, Dropdown Menu, Modal Dialog, Drawer).

### 20.6. Bảng Phân loại Trạng thái Bằng chứng Token & Thành phần (Evidence Reclassification Ledger)
Thay vì sử dụng nhãn gộp chung, mọi quyết định thiết kế và token được phân định minh bạch theo 7 trạng thái bằng chứng:

| Nhóm Quy chuẩn | Hạng mục / Token Cụ thể | Trạng thái Bằng chứng Hiện hành | Căn cứ Kiểm chứng Thực nghiệm |
|---|---|:---:|---|
| **Kiến trúc Chuyển động** | Motion Tokens (0ms/100ms/150ms/200ms) | **`DEFINED`** | Đã định nghĩa 4 thời lượng và 3 easing chuẩn trong `DESIGN.md`. |
| **Hướng Chuyển động Thị giác** | Tactile Press (1px), Tab Slide, Overlay | **`SPECIMEN_ACCEPTED`** | Đã nghiệm thu hình thái trên `MotionSpecimen.tsx`. |
| **Cơ học Trình duyệt Motion** | Computed transitionDuration (0.1s, 0.15s) | **`MECHANICALLY_VALIDATED`** | Playwright đo lường trực tiếp giá trị CSS computed trong Chrome 153. |
| **Hiệu năng Chuyển động** | Bounded Layout Transition qua CSS Grid | **`PROVISIONAL_FOR_PRODUCTION_SLICE`** | Không phát sinh tụt khung hình cảm nhận được trong kịch bản mẫu phẩm. |
| **Màu Hành động Chính** | `--color-action-primary-bg` (`#164e87`) | **`ACCESSIBILITY_VALIDATED`** | Tương phản chữ trắng 8.51:1 (WCAG 2.2 AA PASS), phân định với Info Blue. |
| **Độ rõ Nét Viền Form** | `--color-border-strong` (`#64748b`) | **`ACCESSIBILITY_VALIDATED`** | Tương phản 4.76:1 trên trắng và 4.34:1 trên canvas slate (WCAG SC 1.4.11 PASS). |
| **Mật độ Ô bảng** | Compact 32px vs Standard 36px | **`MECHANICALLY_VALIDATED`** | Không phát sinh cắt dấu DOM (+8.5px headroom an toàn) trong 14 mẫu thử. |
| **Số liệu Dạng bảng** | `tabular-nums` với VND `₫` | **`MECHANICALLY_VALIDATED`** | Độ lệch vi sai bề rộng ký tự số đo được 0.02px < ngưỡng cho phép 0.20px. |
| **Kiến trúc Icon Tier 1** | Lucide Mechanics v1 (16px/20px) | **`DEFINED`** | Chuẩn hóa stroke 2.0px, viewBox 0 0 24 24. |
| **Bản đồ Icon Nghiệp vụ** | Curated Domain Vocabulary (14 Core Icons) | **`SPECIMEN_ACCEPTED`** | Giải quyết triệt để va chạm ChefHat và nạp chồng Scale 6-hướng. |
| **Bộ Icon Pictogram Tự vẽ** | Custom IPC SVG Pictogram Family | **`NOT_CREATED / PROVISIONAL`** | Chưa vẽ bộ SVG riêng; hiện sử dụng phép ẩn dụ chọn lọc từ Lucide. |
| **Điều hướng Compact Rail** | Icon Rail (~60px) kèm Flyout | **`OPTIONAL / PROVISIONAL`** | Đã xác thực mở flyout; khuyến nghị rút gọn về mô hình 2-tier (Expanded $\rightarrow$ Drawer). |

---

## 21. Agent Implementation Guide (Prompt Recipes & Quick Reference)

### A. Quick Color Reference cho AI Agent
- Canvas: `#f1f5f9` (`--color-canvas-default`)
- Card / Panel Surface: `#ffffff` (`--color-surface-base`)
- Hairline Border: `#cbd5e1` (`--color-border-default`)
- Form Input Border: `#64748b` (`--color-border-strong`)
- Text Primary: `#0f172a` (`--color-text-primary`)
- Text Secondary: `#334155` (`--color-text-secondary`)
- Text Muted: `#475569` (`--color-text-muted`)
- Primary CTA Button: `#164e87` (Hover: `#113c69`, Text: `#ffffff`)
- Focus Ring: `2px solid #2d7acf` (Offset: `2px`)

### B. Mẫu Hợp đồng Thành phần Chuẩn

#### 1. Primary Action Button Contract
- **Thẻ ngữ nghĩa:** `<button type="button">`
- **Kích thước chuẩn:** `h-9` (`36px`), `px-3.5`, `gap-1.5`, `rounded-sm` (`3px`). (Compact: `h-8` `32px`).
- **Token Bindings:** Nền `#164e87`, hover `#113c69`, text `#ffffff` (`text-sm font-medium`).
- **Focus Ring:** `focus-visible:ring-2 focus-visible:ring-[#2d7acf] focus-visible:ring-offset-2`.
- **Cơ học Tương tác:** `active:translate-y-px`. Spinner `Loader2` (`size-4`) quay khi loading mà không đổi kích thước nút.

#### 2. Compact Data Table Row Contract
- **Thẻ ngữ nghĩa:** `<tr>` với viền dưới `border-b border-[#e2e8f0]`, hover `bg-[#f0f4f8]`, active `bg-[#f0f5fc]`.
- **Chiều cao dòng:** Ô dữ liệu dùng `py-1.5 px-2`, chữ `text-[13px] leading-[18px]` để bảo vệ dấu tiếng Việt.
- **Căn lề:** Tên văn bản căn trái; số lượng/tiền tệ căn phải với font-mono `tabular-nums`.

#### 3. Warning Status Lozenge Contract (Tier 3)
- **Thẻ ngữ nghĩa:** `<span>` bo góc `rounded-sm` (`3px`), viền `border border-[#fde68a]`, nền `bg-[#fffbeb]`, padding `px-1.5 h-5`.
- **Nội dung:** Icon hình học `AlertTriangle` (`size-3.5`) đi kèm text tiếng Việt tường minh `text-xs font-semibold text-[#92400e]`.

---

## 22. Canonical Feature Contracts & Open Architecture Ledgers

Các quy tắc tính toán chi tiết và luồng điều hướng đặc thù của từng phân hệ đã được di chuyển về đúng tài liệu sở hữu nghiệp vụ:

1. **Weekly Menu Business & UI Contract:** Xem chi tiết tại [`docs/domain/weekly-menu-contract.md`](domain/weekly-menu-contract.md).
   *(Quy định định mức BOM 6 chữ số thập phân, tỷ lệ 85/15 Chay/Mặn, bố cục Nhu cầu theo ngày, và loại bỏ route demand-preview).*
2. **Warehouse & Logistics UI Contract:** Xem chi tiết tại [`docs/domain/warehouse-contract.md`](domain/warehouse-contract.md).
   *(Quy định lối tắt Xem tồn kho, liên kết bàn giao Bếp, giới hạn 20 chứng từ trên rail, và lọc mặc định allowedActions cho Admin).*
3. **Material Reconciliation Closed Loop Contract:** Xem chi tiết tại [`docs/domain/material-reconciliation.md`](domain/material-reconciliation.md).
4. **Hồ sơ quyết định kiến trúc (ADR):** Lịch sử các lần nâng cấp thành phần Nhu cầu (2026-09-29) và thu hồi bản thử nghiệm được lưu vết tại `.planning/notes/` và GSD history ledger.
