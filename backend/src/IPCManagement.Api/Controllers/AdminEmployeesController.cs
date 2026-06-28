using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Admin;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/admin/employees")]
[Authorize(Policy = AuthorizationPolicies.AdminAccess)]
[EnableRateLimiting("api-general")]
public class AdminEmployeesController : ControllerBase
{
    private readonly IpcManagementContext _context;

    public AdminEmployeesController(IpcManagementContext context)
    {
        _context = context;
    }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _context.Roles
            .AsNoTracking()
            .OrderBy(role => role.RoleName)
            .Select(role => new AdminRoleDto
            {
                RoleId = GuidHelper.ToGuidString(role.RoleId),
                RoleCode = role.RoleCode,
                RoleName = role.RoleName
            })
            .ToListAsync();

        return Ok(ApiResponse<List<AdminRoleDto>>.SuccessResult(roles));
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
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

        var items = users.Select(MapEmployee).ToList();

        var result = PagedResponseDto<EmployeeDto>.Create(items, totalCount, request.PageNumber, request.PageSize);
        return Ok(ApiResponse<PagedResponseDto<EmployeeDto>>.SuccessResult(result));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var userId = GuidHelper.ParseGuidString(id);
        if (userId is null)
            return BadRequest(ApiResponse.FailResult("ID nhân viên không hợp lệ."));

        var user = await _context.Users
            .AsNoTracking()
            .Include(item => item.Role)
            .FirstOrDefaultAsync(item => item.UserId == userId);

        if (user is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nhân viên với ID: {id}"));

        return Ok(ApiResponse<EmployeeDto>.SuccessResult(MapEmployee(user)));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeDto request)
    {
        var validationError = await ValidateEmployeeRequestAsync(request.Username, request.Password, request.RoleId);
        if (validationError is not null)
            return validationError;

        var roleId = GuidHelper.ParseGuidString(request.RoleId)!;
        var roleExists = await _context.Roles.AnyAsync(role => role.RoleId == roleId);
        if (!roleExists)
            return BadRequest(ApiResponse.FailResult("Vai trò không tồn tại."));

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

        var created = await LoadEmployeeAsync(user.UserId);
        return CreatedAtAction(nameof(GetById), new { id = GuidHelper.ToGuidString(user.UserId) },
            ApiResponse<EmployeeDto>.SuccessResult(created!, "Tạo tài khoản nhân viên thành công."));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateEmployeeDto request)
    {
        var userId = GuidHelper.ParseGuidString(id);
        if (userId is null)
            return BadRequest(ApiResponse.FailResult("ID nhân viên không hợp lệ."));

        var user = await _context.Users.FirstOrDefaultAsync(item => item.UserId == userId);
        if (user is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nhân viên với ID: {id}"));

        var validationError = await ValidateEmployeeRequestAsync(request.Username, request.Password, request.RoleId, user.UserId);
        if (validationError is not null)
            return validationError;

        var roleId = GuidHelper.ParseGuidString(request.RoleId)!;
        var roleExists = await _context.Roles.AnyAsync(role => role.RoleId == roleId);
        if (!roleExists)
            return BadRequest(ApiResponse.FailResult("Vai trò không tồn tại."));

        user.FullName = request.FullName.Trim();
        user.Username = request.Username.Trim();
        user.RoleId = roleId;
        user.IsActive = request.IsActive;

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        }

        await _context.SaveChangesAsync();

        var updated = await LoadEmployeeAsync(user.UserId);
        return Ok(ApiResponse<EmployeeDto>.SuccessResult(updated!, "Cập nhật nhân viên thành công."));
    }

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateEmployeeStatusDto request)
    {
        var userId = GuidHelper.ParseGuidString(id);
        if (userId is null)
            return BadRequest(ApiResponse.FailResult("ID nhân viên không hợp lệ."));

        var user = await _context.Users.FirstOrDefaultAsync(item => item.UserId == userId);
        if (user is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nhân viên với ID: {id}"));

        user.IsActive = request.IsActive;
        await _context.SaveChangesAsync();

        var updated = await LoadEmployeeAsync(user.UserId);
        return Ok(ApiResponse<EmployeeDto>.SuccessResult(updated!, request.IsActive ? "Đã kích hoạt tài khoản." : "Đã khóa tài khoản."));
    }

    private async Task<IActionResult?> ValidateEmployeeRequestAsync(string username, string? password, string roleId, byte[]? currentUserId = null)
    {
        if (string.IsNullOrWhiteSpace(username))
            return BadRequest(ApiResponse.FailResult("Tên đăng nhập không được để trống."));

        if (currentUserId is null && string.IsNullOrWhiteSpace(password))
            return BadRequest(ApiResponse.FailResult("Mật khẩu không được để trống."));

        if (string.IsNullOrWhiteSpace(roleId))
            return BadRequest(ApiResponse.FailResult("Vui lòng chọn vai trò."));

        var normalizedUsername = username.Trim();
        var exists = currentUserId is null
            ? await _context.Users.AnyAsync(user => user.Username == normalizedUsername)
            : await _context.Users.AnyAsync(user =>
                user.Username == normalizedUsername &&
                !user.UserId.SequenceEqual(currentUserId));

        if (exists)
            return Conflict(ApiResponse.FailResult("Tên đăng nhập đã tồn tại."));

        return null;
    }

    private async Task<EmployeeDto?> LoadEmployeeAsync(byte[] userId)
    {
        var user = await _context.Users
            .AsNoTracking()
            .Include(user => user.Role)
            .Where(user => user.UserId == userId)
            .FirstOrDefaultAsync();

        return user is null ? null : MapEmployee(user);
    }

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
}

public class UpdateEmployeeStatusDto
{
    public bool IsActive { get; set; }
}