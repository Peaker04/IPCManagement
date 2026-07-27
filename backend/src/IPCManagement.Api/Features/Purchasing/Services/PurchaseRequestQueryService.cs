using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Purchasing.Services;

public sealed class PurchaseRequestQueryService : IPurchaseRequestQueryService
{
    private readonly IpcManagementContext _context;

    public PurchaseRequestQueryService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PurchaseRequestWorkflowResultDto>> GetPurchaseRequestsAsync(
        PurchaseRequestQueryDto query)
    {
        var (requestQuery, pageNumber, pageSize) = BuildQuery(query);
        var requests = await requestQuery
            .OrderByDescending(request => request.PurchaseForDate)
            .ThenByDescending(request => request.PurchaseRequestCode)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return requests.Select(Map).ToList();
    }

    public async Task<PagedResponseDto<PurchaseRequestWorkflowResultDto>> GetPurchaseRequestsPageAsync(
        PurchaseRequestQueryDto query)
    {
        var (requestQuery, pageNumber, pageSize) = BuildQuery(query);
        var totalCount = await requestQuery.CountAsync();
        var requests = await requestQuery
            .OrderByDescending(request => request.PurchaseForDate)
            .ThenByDescending(request => request.PurchaseRequestCode)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = requests.Select(Map).ToList();
        return PagedResponseDto<PurchaseRequestWorkflowResultDto>.Create(
            result,
            totalCount,
            pageNumber,
            pageSize);
    }

    public async Task<PurchaseRequestWorkflowResultDto?> GetPurchaseRequestByIdAsync(byte[] purchaseRequestId)
    {
        var request = await IncludeWorkflowLines(_context.Purchaserequests)
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.PurchaseRequestId == purchaseRequestId);

        return request is null ? null : Map(request);
    }

    private (IQueryable<PurchaseRequest> Query, int PageNumber, int PageSize) BuildQuery(
        PurchaseRequestQueryDto query)
    {
        var status = query.Status?.Trim();
        DateOnly? dateFrom = null;
        DateOnly? dateTo = null;

        if (!string.IsNullOrWhiteSpace(query.DateFrom) && DateOnly.TryParse(query.DateFrom, out var parsedDateFrom))
        {
            dateFrom = parsedDateFrom;
        }

        if (!string.IsNullOrWhiteSpace(query.DateTo) && DateOnly.TryParse(query.DateTo, out var parsedDateTo))
        {
            dateTo = parsedDateTo;
        }

        var requestQuery = IncludeWorkflowLines(_context.Purchaserequests)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statuses = status.Split(',')
                .Select(item => item.Trim().ToUpperInvariant())
                .ToList();
            requestQuery = requestQuery.Where(request => statuses.Contains(request.Status));
        }

        if (dateFrom.HasValue)
        {
            requestQuery = requestQuery.Where(request => request.PurchaseForDate >= dateFrom.Value);
        }

        if (dateTo.HasValue)
        {
            requestQuery = requestQuery.Where(request => request.PurchaseForDate <= dateTo.Value);
        }

        return (
            requestQuery,
            Math.Max(1, query.PageNumber),
            Math.Clamp(query.PageSize, 1, 100));
    }

    private static IQueryable<PurchaseRequest> IncludeWorkflowLines(IQueryable<PurchaseRequest> query)
        => query
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.Supplier)
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.Unit);

    private static PurchaseRequestWorkflowResultDto Map(PurchaseRequest request)
        => new()
        {
            PurchaseRequestId = GuidHelper.ToGuidString(request.PurchaseRequestId),
            PurchaseRequestCode = request.PurchaseRequestCode,
            MaterialRequestId = string.Empty,
            PurchaseForDate = request.PurchaseForDate.ToString("yyyy-MM-dd"),
            ShiftName = request.ShiftName,
            Status = request.Status,
            Lines = request.Purchaserequestlines.Select(line => new PurchaseRequestWorkflowLineDto
            {
                PurchaseRequestLineId = GuidHelper.ToGuidString(line.PurchaseRequestLineId),
                MaterialRequestLineId = GuidHelper.ToGuidString(line.MaterialRequestLineId),
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                IngredientName = line.Ingredient.IngredientName,
                SupplierId = line.SupplierId is null ? null : GuidHelper.ToGuidString(line.SupplierId),
                SupplierName = line.Supplier?.SupplierName,
                UnitId = GuidHelper.ToGuidString(line.UnitId),
                UnitName = line.Unit.UnitName,
                RequiredQty = line.RequiredQty,
                CurrentStockQty = line.CurrentStockQty,
                PurchaseQty = line.PurchaseQty,
                EstimatedUnitPrice = line.EstimatedUnitPrice,
                ExpectedDeliveryDate = line.ExpectedDeliveryDate?.ToString("yyyy-MM-dd"),
                Note = line.Note
            }).ToList()
        };
}
