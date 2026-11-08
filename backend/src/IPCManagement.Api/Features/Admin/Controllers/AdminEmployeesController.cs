using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using IPCManagement.Api.Features.Admin.Contracts;
using IPCManagement.Api.Features.Admin.Services;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Admin.Controllers;

[ApiController]
[Route("api/admin/employees")]
[Authorize(Policy = AuthorizationPolicies.AdminAccess)]
[EnableRateLimiting("api-general")]
public class AdminEmployeesController : ControllerBase
{
    private readonly IAdminEmployeeService _employeeService;

    public AdminEmployeesController(IAdminEmployeeService employeeService)
    {
        _employeeService = employeeService;
    }

    [HttpGet("roles")]
    [ProducesResponseType(typeof(ApiResponse<List<AdminRoleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRolesAsync()
    {
        var roles = await _employeeService.GetRolesAsync();
        return Ok(ApiResponse<List<AdminRoleDto>>.SuccessResult(roles));
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<EmployeeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAsync([FromQuery] PagedRequestDto request)
    {
        var result = await _employeeService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<EmployeeDto>>.SuccessResult(result));
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByIdAsync(string id)
    {
        var result = await _employeeService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nhân viên với ID: {id}"));

        return Ok(ApiResponse<EmployeeDto>.SuccessResult(result));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateAsync([FromBody] CreateEmployeeRequest request)
    {
        var created = await _employeeService.CreateAsync(request);
        return CreatedAtAction(
            "GetById",
            new { id = created.UserId },
            ApiResponse<EmployeeDto>.SuccessResult(created, "Tạo tài khoản nhân viên thành công."));
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAsync(string id, [FromBody] UpdateEmployeeRequest request, [FromServices] ICurrentUserService currentUserService)
    {
        var adminId = currentUserService.GetUserId(User);
        var updated = await _employeeService.UpdateAsync(id, request, adminId);
        if (updated is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nhân viên với ID: {id}"));

        return Ok(ApiResponse<EmployeeDto>.SuccessResult(updated, "Cập nhật nhân viên thành công."));
    }

    [HttpPatch("{id}/status")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatusAsync(string id, [FromBody] UpdateEmployeeStatusRequest request, [FromServices] ICurrentUserService currentUserService)
    {
        var adminId = currentUserService.GetUserId(User);
        var updated = await _employeeService.UpdateStatusAsync(id, request, adminId);
        if (updated is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nhân viên với ID: {id}"));

        var message = request.IsActive ? "Đã kích hoạt tài khoản." : "Đã khóa tài khoản.";
        return Ok(ApiResponse<EmployeeDto>.SuccessResult(updated, message));
    }

    [HttpPost("seed")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyDictionary<string, string>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SeedSampleUsersAsync([FromServices] IHostEnvironment environment)
    {
        if (!environment.IsDevelopment())
            return NotFound(ApiResponse.FailResult("Endpoint tạo tài khoản mẫu chỉ khả dụng ở môi trường Development."));

        var credentials = await _employeeService.SeedSampleUsersAsync();
        return Ok(ApiResponse<IReadOnlyDictionary<string, string>>.SuccessResult(
            credentials,
            "Tạo tài khoản mẫu thành công. Mật khẩu ngẫu nhiên chỉ hiển thị một lần trong response này."));
    }
}
