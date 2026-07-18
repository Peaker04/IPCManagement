using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Supplier;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class SupplierQuotationService : ISupplierQuotationService
{
    private readonly IpcManagementContext _context;

    public SupplierQuotationService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<List<SupplierQuotationDto>> GetByIngredientAsync(string ingredientId, CancellationToken cancellationToken = default)
    {
        var ingredientIdBytes = GuidHelper.ParseGuidString(ingredientId)
            ?? throw new ArgumentException("Nguyên liệu không hợp lệ.");

        var quotations = await _context.Supplierquotations
            .Include(q => q.Supplier)
            .Include(q => q.Ingredient)
            .Where(q => q.IngredientId == ingredientIdBytes)
            .ToListAsync(cancellationToken);

        return MapWithBestPrice(quotations);
    }

    public async Task<PagedResponseDto<SupplierQuotationDto>> GetByIngredientPageAsync(
        string ingredientId,
        SupplierQuotationPageQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var rows = await GetByIngredientAsync(ingredientId, cancellationToken);
        var items = rows
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        return PagedResponseDto<SupplierQuotationDto>.Create(items, rows.Count, query.PageNumber, query.PageSize);
    }

    public async Task<List<SupplierQuotationDto>> GetBySupplierAsync(string supplierId, CancellationToken cancellationToken = default)
    {
        var supplierIdBytes = GuidHelper.ParseGuidString(supplierId)
            ?? throw new ArgumentException("Nhà cung cấp không hợp lệ.");

        var quotations = await _context.Supplierquotations
            .Include(q => q.Supplier)
            .Include(q => q.Ingredient)
            .Where(q => q.SupplierId == supplierIdBytes)
            .ToListAsync(cancellationToken);

        return MapWithBestPrice(quotations);
    }

    public async Task<SupplierQuotationDto> CreateAsync(CreateSupplierQuotationDto request, CancellationToken cancellationToken = default)
    {
        var supplierIdBytes = GuidHelper.ParseGuidString(request.SupplierId)
            ?? throw new ArgumentException("Nhà cung cấp không hợp lệ.");
        var ingredientIdBytes = GuidHelper.ParseGuidString(request.IngredientId)
            ?? throw new ArgumentException("Nguyên liệu không hợp lệ.");

        var supplier = await _context.Suppliers.FirstOrDefaultAsync(s => s.SupplierId == supplierIdBytes, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy nhà cung cấp.");
        var ingredient = await _context.Ingredients.FirstOrDefaultAsync(i => i.IngredientId == ingredientIdBytes, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy nguyên liệu.");

        var effectiveFrom = ParseDateOnly(request.EffectiveFrom, "Ngày bắt đầu hiệu lực")!.Value;
        var effectiveTo = ParseDateOnly(request.EffectiveTo, "Ngày kết thúc hiệu lực");
        if (effectiveTo is not null && effectiveTo.Value < effectiveFrom)
        {
            throw new ArgumentException("Ngày kết thúc hiệu lực không được trước ngày bắt đầu.");
        }

        var existingQuotations = await _context.Supplierquotations
            .Where(q => q.SupplierId == supplierIdBytes && q.IngredientId == ingredientIdBytes && q.IsActive != false)
            .ToListAsync(cancellationToken);
        ValidateNoOverlappingQuotation(existingQuotations, quotationId: null, effectiveFrom, effectiveTo);

        var quotation = new Supplierquotation
        {
            QuotationId = GuidHelper.NewId(),
            SupplierId = supplierIdBytes,
            IngredientId = ingredientIdBytes,
            UnitPrice = DecimalPolicy.RoundMoney(request.UnitPrice),
            EffectiveFrom = effectiveFrom,
            EffectiveTo = effectiveTo,
            Note = request.Note,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Supplier = supplier,
            Ingredient = ingredient
        };

        _context.Supplierquotations.Add(quotation);
        await _context.SaveChangesAsync(cancellationToken);

        return await MapSingleWithBestPriceAsync(quotation, cancellationToken);
    }

    public async Task<SupplierQuotationDto> UpdateAsync(string quotationId, UpdateSupplierQuotationDto request, CancellationToken cancellationToken = default)
    {
        var quotationIdBytes = GuidHelper.ParseGuidString(quotationId)
            ?? throw new ArgumentException("Báo giá không hợp lệ.");

        var quotation = await _context.Supplierquotations
            .Include(q => q.Supplier)
            .Include(q => q.Ingredient)
            .FirstOrDefaultAsync(q => q.QuotationId == quotationIdBytes, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy báo giá.");

        var effectiveFrom = ParseDateOnly(request.EffectiveFrom, "Ngày bắt đầu hiệu lực")!.Value;
        var effectiveTo = ParseDateOnly(request.EffectiveTo, "Ngày kết thúc hiệu lực");
        if (effectiveTo is not null && effectiveTo.Value < effectiveFrom)
        {
            throw new ArgumentException("Ngày kết thúc hiệu lực không được trước ngày bắt đầu.");
        }

        if (request.IsActive)
        {
            var existingQuotations = await _context.Supplierquotations
                .Where(q => q.SupplierId == quotation.SupplierId && q.IngredientId == quotation.IngredientId && q.IsActive != false)
                .ToListAsync(cancellationToken);
            ValidateNoOverlappingQuotation(existingQuotations, quotation.QuotationId, effectiveFrom, effectiveTo);
        }

        quotation.UnitPrice = DecimalPolicy.RoundMoney(request.UnitPrice);
        quotation.EffectiveFrom = effectiveFrom;
        quotation.EffectiveTo = effectiveTo;
        quotation.Note = request.Note;
        quotation.IsActive = request.IsActive;
        quotation.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return await MapSingleWithBestPriceAsync(quotation, cancellationToken);
    }

    public async Task DeactivateAsync(string quotationId, CancellationToken cancellationToken = default)
    {
        var quotationIdBytes = GuidHelper.ParseGuidString(quotationId)
            ?? throw new ArgumentException("Báo giá không hợp lệ.");

        var quotation = await _context.Supplierquotations.FirstOrDefaultAsync(q => q.QuotationId == quotationIdBytes, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy báo giá.");

        quotation.IsActive = false;
        quotation.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Chọn báo giá tốt nhất (giá thấp nhất) còn hiệu lực tại một thời điểm cho một nguyên liệu.
    /// Hòa giá: ưu tiên báo giá có ngày bắt đầu hiệu lực gần nhất, sau đó theo tên NCC A-Z để đảm bảo kết quả ổn định.</summary>
    public async Task<Supplierquotation?> GetBestPriceEntityAsync(byte[] ingredientId, DateOnly asOfDate, CancellationToken cancellationToken = default)
    {
        var candidates = await _context.Supplierquotations
            .Include(q => q.Supplier)
            .Where(q => q.IngredientId == ingredientId
                && q.IsActive != false
                && q.Supplier.IsActive != false
                && q.EffectiveFrom <= asOfDate
                && (q.EffectiveTo == null || q.EffectiveTo >= asOfDate))
            .ToListAsync(cancellationToken);

        return candidates
            .OrderBy(q => q.UnitPrice)
            .ThenByDescending(q => q.EffectiveFrom)
            .ThenBy(q => q.Supplier.SupplierName, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault();
    }

    private static void ValidateNoOverlappingQuotation(
        IEnumerable<Supplierquotation> existingQuotations,
        byte[]? quotationId,
        DateOnly effectiveFrom,
        DateOnly? effectiveTo)
    {
        var hasOverlap = existingQuotations.Any(existing =>
            (quotationId is null || !existing.QuotationId.SequenceEqual(quotationId)) &&
            DatesOverlap(existing.EffectiveFrom, existing.EffectiveTo, effectiveFrom, effectiveTo));

        if (hasOverlap)
        {
            throw new ArgumentException("Báo giá của nhà cung cấp này cho nguyên liệu này đã trùng khoảng thời gian hiệu lực với một báo giá khác đang hoạt động.");
        }
    }

    private static bool DatesOverlap(DateOnly leftFrom, DateOnly? leftTo, DateOnly rightFrom, DateOnly? rightTo)
    {
        var leftEnd = leftTo ?? DateOnly.MaxValue;
        var rightEnd = rightTo ?? DateOnly.MaxValue;
        return leftFrom <= rightEnd && rightFrom <= leftEnd;
    }

    private static DateOnly? ParseDateOnly(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateOnly.TryParse(value, out var parsed))
        {
            return parsed;
        }

        throw new ArgumentException($"{fieldName} không hợp lệ.");
    }

    private async Task<SupplierQuotationDto> MapSingleWithBestPriceAsync(Supplierquotation quotation, CancellationToken cancellationToken)
    {
        var siblings = await _context.Supplierquotations
            .Include(q => q.Supplier)
            .Include(q => q.Ingredient)
            .Where(q => q.IngredientId == quotation.IngredientId)
            .ToListAsync(cancellationToken);

        return MapWithBestPrice(siblings).First(dto => dto.QuotationId == GuidHelper.ToGuidString(quotation.QuotationId));
    }

    private static List<SupplierQuotationDto> MapWithBestPrice(List<Supplierquotation> quotations)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var bestQuotationId = quotations
            .Where(q => q.IsActive != false
                && q.Supplier.IsActive != false
                && q.EffectiveFrom <= today
                && (q.EffectiveTo == null || q.EffectiveTo >= today))
            .OrderBy(q => q.UnitPrice)
            .ThenByDescending(q => q.EffectiveFrom)
            .ThenBy(q => q.Supplier.SupplierName, StringComparer.OrdinalIgnoreCase)
            .Select(q => (Guid?)new Guid(q.QuotationId))
            .FirstOrDefault();

        return quotations
            .OrderBy(q => q.UnitPrice)
            .ThenBy(q => q.Supplier.SupplierName, StringComparer.OrdinalIgnoreCase)
            .Select(q => new SupplierQuotationDto
            {
                QuotationId = GuidHelper.ToGuidString(q.QuotationId),
                SupplierId = GuidHelper.ToGuidString(q.SupplierId),
                SupplierName = q.Supplier.SupplierName,
                IngredientId = GuidHelper.ToGuidString(q.IngredientId),
                IngredientName = q.Ingredient.IngredientName,
                UnitPrice = q.UnitPrice,
                EffectiveFrom = q.EffectiveFrom.ToString("yyyy-MM-dd"),
                EffectiveTo = q.EffectiveTo?.ToString("yyyy-MM-dd"),
                Note = q.Note,
                IsActive = q.IsActive != false,
                IsBestPrice = bestQuotationId is not null && new Guid(q.QuotationId) == bestQuotationId
            })
            .ToList();
    }
}
