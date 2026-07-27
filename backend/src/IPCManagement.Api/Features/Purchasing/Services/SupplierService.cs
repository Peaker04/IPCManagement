using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public class SupplierService : ISupplierService
{
    private readonly IpcManagementContext _context;

    public SupplierService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<List<SupplierDto>> GetActiveSuppliersAsync(CancellationToken cancellationToken = default)
    {
        var suppliers = await _context.Suppliers
            .Where(s => s.IsActive != false)
            .OrderBy(s => s.SupplierCode)
            .ToListAsync(cancellationToken);

        return suppliers.Select(s => new SupplierDto
        {
            SupplierId = GuidHelper.ToGuidString(s.SupplierId),
            SupplierCode = s.SupplierCode,
            SupplierName = s.SupplierName
        }).ToList();
    }
}
