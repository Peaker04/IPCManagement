using IPCManagement.Api.Features.Coordination.Contracts;

namespace IPCManagement.Api.Features.Coordination.Services;

public interface ICustomerContractService
{
    Task<IReadOnlyList<CustomerContractDto>> GetCustomerContractsAsync();
    Task<CustomerContractDto> CreateCustomerContractAsync(
        CreateCustomerContractRequest request,
        string? userId);
    Task<CustomerContractDto?> UpdateCustomerContractAsync(
        string customerId,
        UpdateCustomerContractRequest request,
        string? userId,
        string? correlationId = null);
}
