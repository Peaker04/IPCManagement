using IPCManagement.Api.Models.DTOs.Admin;
using IPCManagement.Api.Models.DTOs.Common;

namespace IPCManagement.Api.Services.Admin;

public interface IAdminEmployeeService
{
    Task<List<AdminRoleDto>> GetRolesAsync();
    Task<PagedResponseDto<EmployeeDto>> GetPagedAsync(PagedRequestDto request);
    Task<EmployeeDto?> GetByIdAsync(string id);
    Task<EmployeeDto> CreateAsync(CreateEmployeeDto request);
    Task<EmployeeDto?> UpdateAsync(string id, UpdateEmployeeDto request);
    Task<EmployeeDto?> UpdateStatusAsync(string id, UpdateEmployeeStatusDto request);
    Task SeedSampleUsersAsync();
}
