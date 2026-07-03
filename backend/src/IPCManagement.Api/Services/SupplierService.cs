using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Supplier;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

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

    public async Task<SupplierDto> CreateAsync(CreateSupplierDto request, CancellationToken cancellationToken = default)
    {
        var code = request.SupplierCode.Trim();
        var codeExists = await _context.Suppliers.AnyAsync(s => s.SupplierCode == code, cancellationToken);
        if (codeExists)
        {
            throw new ArgumentException($"Mã nhà cung cấp '{code}' đã tồn tại.");
        }

        var supplier = new Supplier
        {
            SupplierId = GuidHelper.NewId(),
            SupplierCode = code,
            SupplierName = request.SupplierName.Trim(),
            ContactName = string.IsNullOrWhiteSpace(request.ContactName) ? null : request.ContactName.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
            IsActive = true
        };

        _context.Suppliers.Add(supplier);
        await _context.SaveChangesAsync(cancellationToken);

        return new SupplierDto
        {
            SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
            SupplierCode = supplier.SupplierCode,
            SupplierName = supplier.SupplierName
        };
    }
}
