using System.Security.Cryptography;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Admin;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Admin;

public class AdminEmployeeService : IAdminEmployeeService
{
    private const int SamplePasswordLength = 16;
    private const string SamplePasswordAlphabet =
        "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";

    private readonly IpcManagementContext _context;
    private static readonly (Guid RoleId, string RoleCode, string RoleName)[] DefaultRoles =
    [
        (Guid.Parse("00000000-0000-0000-0000-000000000001"), "ADMIN", "Admin"),
        (Guid.Parse("00000000-0000-0000-0000-000000000002"), "MANAGER", "Quản lý"),
        (Guid.Parse("00000000-0000-0000-0000-000000000003"), "COORDINATOR", "Điều phối"),
        (Guid.Parse("00000000-0000-0000-0000-000000000004"), "CHEF", "Bếp trưởng"),
        (Guid.Parse("00000000-0000-0000-0000-000000000005"), "WAREHOUSESTAFF", "Thủ kho"),
        (Guid.Parse("00000000-0000-0000-0000-000000000006"), "PURCHASING", "Thu mua"),
        (Guid.Parse("00000000-0000-0000-0000-000000000007"), "STAFF", "Nhân viên")
    ];

    public AdminEmployeeService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<List<AdminRoleDto>> GetRolesAsync()
    {
        await EnsureDefaultRolesAsync();

        return await _context.Roles
            .AsNoTracking()
            .OrderBy(role => role.RoleName)
            .Select(role => new AdminRoleDto
            {
                RoleId = GuidHelper.ToGuidString(role.RoleId),
                RoleCode = role.RoleCode,
                RoleName = role.RoleName
            })
            .ToListAsync();
    }

    public async Task<PagedResponseDto<EmployeeDto>> GetPagedAsync(PagedRequestDto request)
    {
        var query = _context.Users
            .AsNoTracking()
            .Include(user => user.Role)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.SearchKeyword))
        {
            var keyword = request.SearchKeyword.Trim();
            query = query.Where(user =>
                user.FullName.Contains(keyword) ||
                user.Username.Contains(keyword) ||
                user.Role.RoleName.Contains(keyword));
        }

        var totalCount = await query.CountAsync();
        var users = await query
            .OrderByDescending(user => user.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        return PagedResponseDto<EmployeeDto>.Create(
            users.Select(MapEmployee),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<EmployeeDto?> GetByIdAsync(string id)
    {
        var userId = GuidHelper.ParseGuidString(id);
        if (userId is null)
            return null;

        var user = await LoadEmployeeEntityAsync(userId);
        return user is null ? null : MapEmployee(user);
    }

    public async Task<EmployeeDto> CreateAsync(CreateEmployeeDto request)
    {
        // ResolveRoleIdAsync gọi EnsureDefaultRolesAsync và hàm đó tự SaveChangesAsync. Trước đây đây là
        // hai lần commit rời rạc: nếu insert user hỏng (trùng username, lỗi kết nối) thì 7 role mặc định
        // vừa được chèn vẫn nằm lại vĩnh viễn. Gộp cả hai vào một transaction: hoặc có đủ role + user,
        // hoặc không thay đổi gì.
        byte[] createdUserId;
        await using (var transaction = await _context.Database.BeginTransactionAsync())
        {
            try
            {
                var roleId = await ResolveRoleIdAsync(request.RoleId);
                await EnsureUsernameAvailableAsync(request.Username);

                var user = new User
                {
                    UserId = GuidHelper.NewId(),
                    FullName = request.FullName.Trim(),
                    Username = request.Username.Trim(),
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                    RoleId = roleId,
                    IsActive = request.IsActive,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Users.Add(user);
                await SaveChangesGuardingUsernameAsync();
                await transaction.CommitAsync();

                createdUserId = user.UserId;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        var created = await LoadEmployeeEntityAsync(createdUserId)
            ?? throw new InvalidOperationException("Không thể tải nhân viên vừa tạo.");

        return MapEmployee(created);
    }

    public async Task<EmployeeDto?> UpdateAsync(string id, UpdateEmployeeDto request, string? changedByUserId)
    {
        var userId = GuidHelper.ParseGuidString(id);
        if (userId is null)
            return null;

        // Giống CreateAsync: ResolveRoleIdAsync có thể commit role mặc định trước khi user + auditlog
        // được ghi. Một transaction duy nhất cho cả hai lượt SaveChangesAsync.
        byte[] updatedUserId;
        await using (var transaction = await _context.Database.BeginTransactionAsync())
        {
            try
            {
                var updated = await ApplyEmployeeUpdateAsync(userId, request, changedByUserId);
                if (updated is null)
                {
                    return null;
                }

                await transaction.CommitAsync();
                updatedUserId = updated;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        var reloaded = await LoadEmployeeEntityAsync(updatedUserId)
            ?? throw new InvalidOperationException("Không thể tải nhân viên vừa cập nhật.");

        return MapEmployee(reloaded);
    }

    private async Task<byte[]?> ApplyEmployeeUpdateAsync(
        byte[] userId,
        UpdateEmployeeDto request,
        string? changedByUserId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(item => item.UserId == userId);
        if (user is null)
            return null;

        var roleId = await ResolveRoleIdAsync(request.RoleId);
        await EnsureUsernameAvailableAsync(request.Username, user.UserId);

        byte[]? changedByBytes = null;
        if (!string.IsNullOrEmpty(changedByUserId))
        {
            changedByBytes = GuidHelper.ParseGuidString(changedByUserId);
        }

        // Audit Log list to insert
        var audits = new List<AuditLog>();
        var changedAt = DateTime.UtcNow;

        if (user.FullName != request.FullName.Trim())
        {
            audits.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = changedByBytes ?? GuidHelper.NewId(),
                BusinessArea = "Admin",
                EntityName = nameof(User),
                EntityId = user.UserId,
                FieldName = nameof(user.FullName),
                OldValue = user.FullName,
                NewValue = request.FullName.Trim(),
                Reason = "Cập nhật họ tên nhân viên."
            });
            user.FullName = request.FullName.Trim();
        }

        if (user.Username != request.Username.Trim())
        {
            audits.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = changedByBytes ?? GuidHelper.NewId(),
                BusinessArea = "Admin",
                EntityName = nameof(User),
                EntityId = user.UserId,
                FieldName = nameof(user.Username),
                OldValue = user.Username,
                NewValue = request.Username.Trim(),
                Reason = "Cập nhật tên đăng nhập nhân viên."
            });
            user.Username = request.Username.Trim();
        }

        if (!user.RoleId.SequenceEqual(roleId))
        {
            audits.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = changedByBytes ?? GuidHelper.NewId(),
                BusinessArea = "Admin",
                EntityName = nameof(User),
                EntityId = user.UserId,
                FieldName = nameof(user.RoleId),
                OldValue = GuidHelper.ToGuidString(user.RoleId),
                NewValue = request.RoleId,
                Reason = "Thay đổi vai trò nhân viên."
            });
            user.RoleId = roleId;
        }

        if ((user.IsActive ?? false) != request.IsActive)
        {
            audits.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = changedByBytes ?? GuidHelper.NewId(),
                BusinessArea = "Admin",
                EntityName = nameof(User),
                EntityId = user.UserId,
                FieldName = nameof(user.IsActive),
                OldValue = (user.IsActive ?? false).ToString(),
                NewValue = request.IsActive.ToString(),
                Reason = "Cập nhật trạng thái hoạt động."
            });
            user.IsActive = request.IsActive;
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            var oldPasswordHash = user.PasswordHash;
            var newPasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            user.PasswordHash = newPasswordHash;

            audits.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = changedByBytes ?? GuidHelper.NewId(),
                BusinessArea = "Admin",
                EntityName = nameof(User),
                EntityId = user.UserId,
                FieldName = nameof(user.PasswordHash),
                OldValue = "[HIDDEN]",
                NewValue = "[CHANGED]",
                Reason = "Đổi/Reset mật khẩu nhân viên."
            });
        }

        if (audits.Count > 0)
        {
            _context.Auditlogs.AddRange(audits);
        }

        await SaveChangesGuardingUsernameAsync();

        return user.UserId;
    }

    public async Task<EmployeeDto?> UpdateStatusAsync(string id, UpdateEmployeeStatusDto request, string? changedByUserId)
    {
        var userId = GuidHelper.ParseGuidString(id);
        if (userId is null)
            return null;

        var user = await _context.Users.FirstOrDefaultAsync(item => item.UserId == userId);
        if (user is null)
            return null;

        if ((user.IsActive ?? false) != request.IsActive)
        {
            byte[]? changedByBytes = null;
            if (!string.IsNullOrEmpty(changedByUserId))
            {
                changedByBytes = GuidHelper.ParseGuidString(changedByUserId);
            }

            var changedAt = DateTime.UtcNow;
            var audit = new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = changedByBytes ?? GuidHelper.NewId(),
                BusinessArea = "Admin",
                EntityName = nameof(User),
                EntityId = user.UserId,
                FieldName = nameof(user.IsActive),
                OldValue = (user.IsActive ?? false).ToString(),
                NewValue = request.IsActive.ToString(),
                Reason = request.IsActive ? "Kích hoạt tài khoản nhân viên." : "Khóa tài khoản nhân viên."
            };

            user.IsActive = request.IsActive;
            _context.Auditlogs.Add(audit);
            await _context.SaveChangesAsync();
        }

        var updated = await LoadEmployeeEntityAsync(user.UserId)
            ?? throw new InvalidOperationException("Không thể tải nhân viên vừa cập nhật.");

        return MapEmployee(updated);
    }

    private async Task<byte[]> ResolveRoleIdAsync(string roleId)
    {
        await EnsureDefaultRolesAsync();

        var bytes = GuidHelper.ParseGuidString(roleId)
            ?? throw new ArgumentException("Vai trò không hợp lệ.");

        var roleExists = await _context.Roles.AnyAsync(role => role.RoleId == bytes);
        if (!roleExists)
            throw new InvalidOperationException("Vai trò không tồn tại.");

        return bytes;
    }

    private async Task EnsureDefaultRolesAsync()
    {
        var existingCodes = await _context.Roles
            .Select(role => role.RoleCode)
            .ToListAsync();
        var existingCodeSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missingRoles = DefaultRoles
            .Where(role => !existingCodeSet.Contains(role.RoleCode))
            .Select(role => new Role
            {
                RoleId = GuidHelper.ToBytes(role.RoleId),
                RoleCode = role.RoleCode,
                RoleName = role.RoleName
            })
            .ToList();

        if (missingRoles.Count == 0)
        {
            return;
        }

        _context.Roles.AddRange(missingRoles);
        await _context.SaveChangesAsync();
    }

    private async Task EnsureUsernameAvailableAsync(string username, byte[]? currentUserId = null)
    {
        var normalizedUsername = username.Trim();
        var ownerId = await _context.Users
            .AsNoTracking()
            .Where(user => user.Username == normalizedUsername)
            .Select(user => user.UserId)
            .FirstOrDefaultAsync();

        if (ownerId is null)
            return;

        if (currentUserId is null || !ownerId.SequenceEqual(currentUserId))
            throw new ResourceConflictException("Tên đăng nhập đã tồn tại.");
    }

    /// <summary>
    /// Kiểm tra username ở trên là check-then-write nên hai request song song vẫn lọt được cả hai.
    /// Chốt chặn thật nằm ở unique index `username` của bảng users; ở đây chỉ dịch lỗi khóa trùng
    /// của database thành đúng ngữ nghĩa xung đột (409) thay vì để nó rơi thành lỗi hệ thống 500.
    /// </summary>
    private async Task SaveChangesGuardingUsernameAsync()
    {
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException exception) when (IsUniqueConstraintViolation(exception))
        {
            throw new ResourceConflictException("Tên đăng nhập đã tồn tại.", exception);
        }
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException exception)
    {
        for (var inner = exception.InnerException; inner is not null; inner = inner.InnerException)
        {
            if (inner.Message.Contains("Duplicate entry", StringComparison.OrdinalIgnoreCase) ||
                inner.Message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private async Task<User?> LoadEmployeeEntityAsync(byte[] userId)
        => await _context.Users
            .AsNoTracking()
            .Include(user => user.Role)
            .FirstOrDefaultAsync(user => user.UserId == userId);

    private static EmployeeDto MapEmployee(User user)
        => new()
        {
            UserId = GuidHelper.ToGuidString(user.UserId),
            FullName = user.FullName,
            Username = user.Username,
            RoleId = GuidHelper.ToGuidString(user.RoleId),
            RoleName = user.Role?.RoleName ?? string.Empty,
            IsActive = user.IsActive ?? false,
            CreatedAt = user.CreatedAt
        };

    public async Task<IReadOnlyDictionary<string, string>> SeedSampleUsersAsync()
    {
        // Cùng lỗi hai lần commit rời rạc như CreateAsync: EnsureDefaultRolesAsync tự lưu role trước,
        // rồi mới tới lượt lưu 6 user mẫu. Bọc chung một transaction để seed là thao tác tất-cả-hoặc-không.
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var credentials = await SeedSampleUsersCoreAsync();
            await transaction.CommitAsync();
            return credentials;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task<IReadOnlyDictionary<string, string>> SeedSampleUsersCoreAsync()
    {
        await EnsureDefaultRolesAsync();

        var sampleUsers = new[]
        {
            (Guid.Parse("00000000-0000-0000-0000-000000000001"), "admin", "Admin User"),
            (Guid.Parse("00000000-0000-0000-0000-000000000002"), "quanly", "Quản lý"),
            (Guid.Parse("00000000-0000-0000-0000-000000000003"), "dieuphoi", "Điều phối"),
            (Guid.Parse("00000000-0000-0000-0000-000000000004"), "beptruong", "Bếp trưởng"),
            (Guid.Parse("00000000-0000-0000-0000-000000000005"), "thukho", "Thủ kho"),
            (Guid.Parse("00000000-0000-0000-0000-000000000006"), "thumua", "Thu mua")
        };

        var createdCredentials = new Dictionary<string, string>();

        foreach (var (roleId, username, fullName) in sampleUsers)
        {
            var existingUser = await _context.Users.AnyAsync(u => u.Username == username);
            if (!existingUser)
            {
                var password = GenerateSamplePassword();
                _context.Users.Add(new User
                {
                    UserId = GuidHelper.NewId(),
                    FullName = fullName,
                    Username = username,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                    RoleId = GuidHelper.ToBytes(roleId),
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                });
                createdCredentials[username] = password;
            }
        }

        await _context.SaveChangesAsync();
        return createdCredentials;
    }

    private static string GenerateSamplePassword()
        => RandomNumberGenerator.GetString(SamplePasswordAlphabet, SamplePasswordLength);
}
