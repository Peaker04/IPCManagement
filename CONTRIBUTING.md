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
