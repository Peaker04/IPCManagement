using IPCManagement.Api.Models.DTOs.Supplier;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Services;

public interface ISupplierQuotationService
{
    Task<List<SupplierQuotationDto>> GetByIngredientAsync(string ingredientId, CancellationToken cancellationToken = default);

    Task<List<SupplierQuotationDto>> GetBySupplierAsync(string supplierId, CancellationToken cancellationToken = default);

    Task<SupplierQuotationDto> CreateAsync(CreateSupplierQuotationDto request, CancellationToken cancellationToken = default);

    Task<SupplierQuotationDto> UpdateAsync(string quotationId, UpdateSupplierQuotationDto request, CancellationToken cancellationToken = default);

    Task DeactivateAsync(string quotationId, CancellationToken cancellationToken = default);

    /// <summary>Chọn báo giá tốt nhất (giá thấp nhất) còn hiệu lực tại một thời điểm cho một nguyên liệu — dùng bởi luồng sinh đề xuất mua hàng tự động.</summary>
    Task<Supplierquotation?> GetBestPriceEntityAsync(byte[] ingredientId, DateOnly asOfDate, CancellationToken cancellationToken = default);
}
