# 📋 Quy tắc đóng góp (Contributing Guidelines)

## 🌿 Quy tắc đặt tên Branch

### Cấu trúc

```
<type>/<mô-tả-ngắn>
```

### Các loại branch được phép

| Type | Mục đích | Ví dụ |
|------|----------|-------|
| `feature/` | Phát triển tính năng mới | `feature/user-authentication` |
| `fix/` | Sửa bug | `fix/login-redirect-error` |
| `hotfix/` | Sửa lỗi khẩn cấp trên production | `hotfix/crash-on-checkout` |
| `release/` | Chuẩn bị release phiên bản mới | `release/1.2.0` |
| `chore/` | Cập nhật deps, config, không ảnh hưởng code chính | `chore/update-ef-core` |
| `docs/` | Cập nhật tài liệu | `docs/api-endpoints` |
| `refactor/` | Tái cấu trúc code, không thêm tính năng/fix bug | `refactor/auth-service` |
| `main` | Branch production chính | — |
| `develop` | Branch tích hợp phát triển | — |

### Quy tắc đặt tên

- ✅ **Chỉ dùng chữ thường**, số, dấu `-`, `_`, `.`
- ✅ Mô tả ngắn gọn, rõ ràng bằng **kebab-case**
- ❌ Không dùng chữ hoa, khoảng trắng, ký tự đặc biệt
- ❌ Không commit thẳng vào `main` hoặc `develop`

```bash
# ✅ Đúng
git checkout -b feature/dish-management
git checkout -b fix/jwt-expiry-bug
git checkout -b hotfix/null-pointer-production
git checkout -b release/2.0.0

# ❌ Sai
git checkout -b Feature/DishManagement   # chữ hoa
git checkout -b my-branch                # không có type prefix
git checkout -b fix_login bug            # khoảng trắng
```

---

## 📝 Quy tắc Commit Message

Dự án sử dụng **[Conventional Commits](https://www.conventionalcommits.org/)** và được tự động kiểm tra bằng **commitlint**.

### Cấu trúc

```
<type>(<scope>): <subject>

[body - tuỳ chọn]

[footer - tuỳ chọn]
```

### Các loại commit (type)

| Type | Mục đích | Ví dụ |
|------|----------|-------|
| `feat` | Thêm tính năng mới | `feat(auth): thêm chức năng đăng nhập JWT` |
| `fix` | Sửa bug | `fix(dish): sửa lỗi không tải được danh sách món ăn` |
| `docs` | Cập nhật tài liệu | `docs: cập nhật hướng dẫn cài đặt` |
| `style` | Format code, không thay đổi logic | `style: format lại file Program.cs` |
| `refactor` | Tái cấu trúc code | `refactor(auth): tách AuthService thành các service nhỏ hơn` |
| `perf` | Cải thiện hiệu năng | `perf(query): thêm index cho bảng Ingredient` |
| `test` | Thêm/sửa test | `test(auth): thêm unit test cho LoginService` |
| `chore` | Cập nhật deps, config | `chore: cập nhật EF Core lên 9.0.16` |
| `ci` | Thay đổi CI/CD | `ci: thêm GitHub Actions workflow` |
| `revert` | Hoàn tác commit trước | `revert: revert "feat: thêm module warehouse"` |
| `hotfix` | Sửa lỗi khẩn cấp | `hotfix(api): sửa lỗi 500 trên endpoint /dishes` |

### Scope (tuỳ chọn)

Scope là phạm vi thay đổi, viết trong ngoặc đơn sau type:

```
feat(auth):      # Module xác thực
feat(dish):      # Module món ăn
fix(ingredient): # Module nguyên liệu
chore(frontend): # Frontend
chore(backend):  # Backend
```

### Quy tắc subject

- ✅ Bắt đầu bằng **động từ** (thêm, sửa, cập nhật, xóa, refactor...)
- ✅ Viết **tiếng Việt** hoặc **tiếng Anh** (nhất quán trong project)
- ✅ Tối đa **100 ký tự**
- ❌ Không kết thúc bằng dấu chấm (`.`)
- ❌ Không để trống

### Ví dụ commit hợp lệ

```bash
# ✅ Tính năng mới
feat(auth): thêm chức năng đăng nhập bằng JWT
feat(dish): thêm API tạo món ăn mới với BOM

# ✅ Sửa bug
fix(warehouse): sửa lỗi không cập nhật tồn kho khi xuất nguyên liệu
fix(api): sửa lỗi 401 khi token hết hạn

# ✅ Tài liệu
docs: thêm hướng dẫn chạy dự án trong README
docs(api): cập nhật mô tả endpoint inventory

# ✅ Refactor
refactor(infrastructure): tách repository thành các file riêng biệt

# ✅ Với body và footer
feat(production-plan): thêm chức năng phê duyệt kế hoạch sản xuất

Thêm API endpoint PUT /production-plans/{id}/approve
Cập nhật trạng thái từ Draft → Approved

Closes #42
```

```bash
# ❌ Sai — type không hợp lệ
update: sửa gì đó

# ❌ Sai — subject trống
feat(auth):

# ❌ Sai — chữ hoa ở type
Feat(auth): thêm đăng nhập

# ❌ Sai — không có type
thêm chức năng đăng nhập
```

---

## 🔄 Workflow

```
develop ──────────────────────────────────────► develop
    │                                               ▲
    └── feature/xxx ──► (PR review) ──► merge ─────┘
    └── fix/xxx     ──► (PR review) ──► merge ─────┘

develop ──► release/x.x.x ──► main (tag v x.x.x)
main    ──► hotfix/xxx    ──► main + develop
```

1. Tạo branch từ `develop` (hoặc `main` với hotfix)
2. Commit theo quy tắc Conventional Commits
3. Tạo Pull Request vào `develop`
4. Code review → merge

---

## ⚙️ Hooks tự động (Git Hooks)

Dự án dùng **husky** để tự động kiểm tra khi commit:

| Hook | Kiểm tra |
|------|----------|
| `pre-commit` | Tên branch có đúng quy tắc không |
| `commit-msg` | Commit message có đúng Conventional Commits không |

Nếu vi phạm quy tắc, commit sẽ **bị từ chối** và hiển thị thông báo lỗi.

---

## 🔒 Danh sách GIỮ NGUYÊN — đừng "dọn dẹp" những chỗ này

Những thứ dưới đây **trông như dư thừa hoặc rườm rà nhưng đang gánh việc thật**, và đều có số đo kèm
theo. Chúng là kết quả của các đợt sửa hiệu năng/UX trước, không phải code sót. Sửa vào đây là làm
hỏng một thứ đang chạy đúng mà không ai nhận ra ngay.

**Trước khi đổi bất kỳ mục nào: mở issue nêu rõ số đo hiện tại và số đo sau khi đổi.** Không có số thì
không đổi.

### Frontend

| Giữ nguyên | Nó đang gánh việc gì |
|---|---|
| **Query gating theo tab** — **69** chỗ `skip:` trong code thật (đếm lại 27/07; con số 92 là khi tính cả file test) | Cho **0 request thừa** khi điều hướng warm. Bỏ `skip:` là mỗi lần đổi tab lại gọi lại toàn bộ query của tab khác |
| **Route loader cache + preload trong idle slot** | Click-to-content **11–22ms**, **0 fallback mount** |
| **Giữ panel cũ + overlay khi refetch** — `features/projects/pages/WeeklyMenuPage.tsx:441-455`, `features/workflow/pages/WarehousePage.tsx:611-616` (đã xác minh lại 27/07) | Đây là **nguồn của CLS = 0**. Cả hai chỗ đều là `min-h-[420px]` + `aria-busy` + badge "Đang cập nhật" định vị tuyệt đối. Đổi sang spinner toàn trang là vỡ chỉ số này ngay |
| **Paging server-side** đã có | Layout ổn định với dữ liệu 5–10 năm |
| **Discriminated union của `EmptyState`** | Ép được `onRetry` khi `variant="error"` ở mức kiểu — bỏ union là mất ràng buộc compile-time |
| **Tile dẫn xuất** ở `WarehousePage.tsx:319-323` | Mẫu đúng: tile suy ra từ dữ liệu, không phải state song song |

Mẫu **"model thuần + hook data + section view"** cũng giữ, nhưng lưu ý nó **mới phủ 6/17 sub-module
(35%)**: weekly-menu 6/9, chef 1/6, workflow/purchasing 0/6. Chỗ chưa theo mẫu thì là nợ, không phải
chuẩn thay thế.

### Backend

| Giữ nguyên | Nó đang gánh việc gì |
|---|---|
| **Tầng tên BE: 53/53 bảng + 523/523 cột camelCase** | Đã sạch tuyệt đối. **Không đổi tên gì ở đây** |
| **Hướng phụ thuộc dọc** | Đã sạch sẵn: 0 service gọi controller, 0 kiểu web trong `Services/`, 0 `ApiResponse` trong `Services/` (so với 524 trong `Controllers/`), 0 service-locator, chuỗi service→service tối đa 1 hop, namespace khớp folder 246/247 |
| **`PagedResponseDto<T>`** | 84 lượt dùng ngoài thư mục DTOs — đổi hình dạng là gãy diện rộng |
| **`Program.cs`**: `PropertyNamingPolicy=CamelCase`, `UtcDateTimeJsonConverter`, `JsonStringEnumConverter` | Ba dòng này là hợp đồng wire-format với FE. Bỏ `UtcDateTimeJsonConverter` là mọi timestamp FE lệch 7 giờ trở lại |
| **`InternalsVisibleTo`** trong csproj, **`Resources/Templates`** (LogicalName hard-code trong csproj) | Test và template phụ thuộc trực tiếp |

### Tầng database — bổ sung 27/07/2026

| Giữ nguyên | Nó đang gánh việc gì |
|---|---|
| **CI step `Check EF migration snapshot`** (`has-pending-model-changes`) | Bắt drift giữa model và migration |
| **Hai CI step B13**: replay migration trên MySQL thật + so schema migration với schema model | Trước 27/07 **không migration viết tay nào từng chạy trong CI**. Xem `docs/CURRENT-STATE.md` |
| **Chốt an toàn đầu `backend/database/IPCmanagement.sql`** (bảng `TEMPORARY` + va chạm PRIMARY KEY) | Chặn đúng thứ đã xoá sạch database chính ngày 26/07. Bỏ nó ra là mở lại đường đó |
| **`--set-gtid-purged=OFF`** trong mọi `mysqldump` | Thiếu nó thì restore vào máy đang bật GTID sẽ hỏng |
| **`MigrationHealthCheck` trả `Degraded`, không phải `Unhealthy`** | Cố ý: thiếu migration không làm API mất khả năng phục vụ, đừng để loadbalancer rút API khỏi vòng |
| **`stocktakes.activeWarehouseKey`** — cột `GENERATED ... VIRTUAL` | Dùng để làm unique index có điều kiện; model EF **cố ý không map**. Đang nằm trong danh sách loại trừ của gate so schema |

### Ngoại lệ đã biết, không phải lỗi

`Migrations/` chứa file mà quy ước đặt tên chung không áp dụng: một số migration viết tay có
`[Migration]` inline thay vì `.Designer.cs`. **Không dọn cho "nhất quán"** — và tuyệt đối không chạy
`dotnet ef migrations remove` khi migration cuối thiếu `.Designer.cs` (EF sẽ reset model snapshot gần
như rỗng). Lý do đầy đủ ở `docs/CURRENT-STATE.md`, mục "Ba cái bẫy phải nhớ khi đụng vào migration".
