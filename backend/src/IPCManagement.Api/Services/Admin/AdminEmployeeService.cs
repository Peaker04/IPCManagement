using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Admin;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Admin;

public class AdminEmployeeService : IAdminEmployeeService
{
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
        await _context.SaveChangesAsync();

        var created = await LoadEmployeeEntityAsync(user.UserId)
            ?? throw new InvalidOperationException("Không thể tải nhân viên vừa tạo.");

        return MapEmployee(created);
    }

    public async Task<EmployeeDto?> UpdateAsync(string id, UpdateEmployeeDto request)
    {
        var userId = GuidHelper.ParseGuidString(id);
        if (userId is null)
            return null;

        var user = await _context.Users.FirstOrDefaultAsync(item => item.UserId == userId);
        if (user is null)
            return null;

        var roleId = await ResolveRoleIdAsync(request.RoleId);
        await EnsureUsernameAvailableAsync(request.Username, user.UserId);

        user.FullName = request.FullName.Trim();
        user.Username = request.Username.Trim();
        user.RoleId = roleId;
        user.IsActive = request.IsActive;

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        }

        await _context.SaveChangesAsync();

        var updated = await LoadEmployeeEntityAsync(user.UserId)
            ?? throw new InvalidOperationException("Không thể tải nhân viên vừa cập nhật.");

        return MapEmployee(updated);
    }

    public async Task<EmployeeDto?> UpdateStatusAsync(string id, UpdateEmployeeStatusDto request)
    {
        var userId = GuidHelper.ParseGuidString(id);
        if (userId is null)
            return null;

        var user = await _context.Users.FirstOrDefaultAsync(item => item.UserId == userId);
        if (user is null)
            return null;

        user.IsActive = request.IsActive;
        await _context.SaveChangesAsync();

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
            throw new InvalidOperationException("Tên đăng nhập đã tồn tại.");
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

    public async Task SeedSampleUsersAsync()
    {
        await EnsureDefaultRolesAsync();

        var sampleUsers = new[]
        {
            (Guid.Parse("00000000-0000-0000-0000-000000000001"), "admin", "admin", "Admin User"),
            (Guid.Parse("00000000-0000-0000-0000-000000000002"), "quanly", "quanly", "Quản lý"),
            (Guid.Parse("00000000-0000-0000-0000-000000000003"), "dieuphoi", "dieuphoi", "Điều phối"),
            (Guid.Parse("00000000-0000-0000-0000-000000000004"), "beptruong", "beptruong", "Bếp trưởng"),
            (Guid.Parse("00000000-0000-0000-0000-000000000005"), "thukho", "thukho", "Thủ kho"),
            (Guid.Parse("00000000-0000-0000-0000-000000000006"), "thumua", "thumua", "Thu mua")
        };

        foreach (var (roleId, username, password, fullName) in sampleUsers)
        {
            var existingUser = await _context.Users.AnyAsync(u => u.Username == username);
            if (!existingUser)
            {
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
            }
        }

        await _context.SaveChangesAsync();
    }
}
