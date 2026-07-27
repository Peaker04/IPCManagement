using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

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
