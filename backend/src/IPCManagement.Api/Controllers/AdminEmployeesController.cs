using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Admin;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

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
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _employeeService.GetRolesAsync();
        return Ok(ApiResponse<List<AdminRoleDto>>.SuccessResult(roles));
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<EmployeeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
    {
        var result = await _employeeService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<EmployeeDto>>.SuccessResult(result));
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _employeeService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nhân viên với ID: {id}"));

        return Ok(ApiResponse<EmployeeDto>.SuccessResult(result));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeDto request)
    {
        var created = await _employeeService.CreateAsync(request);
        return CreatedAtAction(
            nameof(GetById),
            new { id = created.UserId },
            ApiResponse<EmployeeDto>.SuccessResult(created, "Tạo tài khoản nhân viên thành công."));
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateEmployeeDto request)
    {
        var updated = await _employeeService.UpdateAsync(id, request);
        if (updated is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nhân viên với ID: {id}"));

        return Ok(ApiResponse<EmployeeDto>.SuccessResult(updated, "Cập nhật nhân viên thành công."));
    }

    [HttpPatch("{id}/status")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateEmployeeStatusDto request)
    {
        var updated = await _employeeService.UpdateStatusAsync(id, request);
        if (updated is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nhân viên với ID: {id}"));

        var message = request.IsActive ? "Đã kích hoạt tài khoản." : "Đã khóa tài khoản.";
        return Ok(ApiResponse<EmployeeDto>.SuccessResult(updated, message));
    }
}
