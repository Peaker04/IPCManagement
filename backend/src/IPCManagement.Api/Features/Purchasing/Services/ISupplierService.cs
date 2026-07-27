
using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public interface ISupplierService
{
    Task<List<SupplierDto>> GetActiveSuppliersAsync(CancellationToken cancellationToken = default);
}
