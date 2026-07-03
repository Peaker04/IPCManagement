using IPCManagement.Api.Models.DTOs.Supplier;

namespace IPCManagement.Api.Services;

public interface ISupplierService
{
    Task<List<SupplierDto>> GetActiveSuppliersAsync(CancellationToken cancellationToken = default);

    Task<SupplierDto> CreateAsync(CreateSupplierDto request, CancellationToken cancellationToken = default);
}
