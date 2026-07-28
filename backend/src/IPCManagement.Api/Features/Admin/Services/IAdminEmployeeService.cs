
using IPCManagement.Api.Features.Admin.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Admin.Services;

public interface IAdminEmployeeService
{
    Task<List<AdminRoleDto>> GetRolesAsync();
    Task<PagedResponseDto<EmployeeDto>> GetPagedAsync(PagedRequestDto request);
    Task<EmployeeDto?> GetByIdAsync(string id);
    Task<EmployeeDto> CreateAsync(CreateEmployeeRequest request);
    Task<EmployeeDto?> UpdateAsync(string id, UpdateEmployeeRequest request, string? changedByUserId);
    Task<EmployeeDto?> UpdateStatusAsync(string id, UpdateEmployeeStatusRequest request, string? changedByUserId);
    Task<IReadOnlyDictionary<string, string>> SeedSampleUsersAsync();
}
