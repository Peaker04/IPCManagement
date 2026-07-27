using IPCManagement.Api.Models.DTOs.Supplier;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Services;

public interface ISupplierQuotationService
{
    Task<List<SupplierQuotationDto>> GetByIngredientAsync(string ingredientId, CancellationToken cancellationToken = default);
    Task<PagedResponseDto<SupplierQuotationDto>> GetByIngredientPageAsync(string ingredientId, SupplierQuotationPageQueryDto query, CancellationToken cancellationToken = default);

    Task<List<SupplierQuotationDto>> GetBySupplierAsync(string supplierId, CancellationToken cancellationToken = default);

    Task<SupplierQuotationDto> CreateAsync(CreateSupplierQuotationRequest request, CancellationToken cancellationToken = default);

    Task<SupplierQuotationDto> UpdateAsync(string quotationId, UpdateSupplierQuotationRequest request, CancellationToken cancellationToken = default);

    Task DeactivateAsync(string quotationId, CancellationToken cancellationToken = default);

    /// <summary>Chọn báo giá tốt nhất (giá thấp nhất) còn hiệu lực tại một thời điểm cho một nguyên liệu — dùng bởi luồng sinh đề xuất mua hàng tự động.</summary>
    Task<SupplierQuotation?> GetBestPriceEntityAsync(byte[] ingredientId, DateOnly asOfDate, CancellationToken cancellationToken = default);
}
