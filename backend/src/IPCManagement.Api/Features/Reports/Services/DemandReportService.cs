using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public class DemandReportService : IDemandReportService
{
    private readonly IpcManagementContext _context;

    public DemandReportService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<IngredientDemandReportDto>> GetIngredientDemandAsync(WorkflowReportQueryDto query)
    {
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Materialrequestlines
            .AsNoTracking()
            .AsQueryable();

        if (ingredientId is not null)
        {
            lines = lines.Where(item => item.IngredientId == ingredientId);
        }

        if (dateFrom is not null)
        {
            lines = lines.Where(item => item.Request.RequestDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            lines = lines.Where(item => item.Request.RequestDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            lines = lines.Where(item => item.PlanLine.ShiftName == shiftName);
        }

        if (customerId is not null)
        {
            lines = lines.Where(item => item.PlanLine.CustomerId.SequenceEqual(customerId));
        }

        return await lines
            .OrderByDescending(item => item.Request.RequestDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Take(NormalizeLimit(query.Limit))
            .Select(item => new IngredientDemandReportDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(item.RequestId),
                RequestLineId = GuidHelper.ToGuidString(item.RequestLineId),
                MaterialRequestCode = item.Request.RequestCode,
                RequestDate = item.Request.RequestDate,
                Status = item.Request.Status,
                ShiftName = item.PlanLine.ShiftName,
                CustomerName = item.PlanLine.Customer.CustomerName,
                DishName = item.PlanLine.Dish.DishName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                BomId = item.BomId == null ? null : GuidHelper.ToGuidString(item.BomId),
                PriceTierAmount = item.PriceTierAmount,
                BomScope = item.BomScope,
                TotalServings = item.TotalServings,
                BomRatePercent = item.BomRatePercent,
                AppliedPortionRuleId = item.AppliedPortionRuleId == null ? null : GuidHelper.ToGuidString(item.AppliedPortionRuleId),
                AppliedPortionRuleSource = item.AppliedPortionRuleSource,
                AppliedPortionRatePercent = item.AppliedPortionRatePercent,
                YieldLossPercent = item.YieldLossPercent,
                TotalRequiredQty = item.TotalRequiredQty,
                CurrentStockQty = item.CurrentStockQty,
                SuggestedPurchaseQty = item.SuggestedPurchaseQty
            })
            .ToListAsync();
    }

    public async Task<IngredientDemandPageDto> GetIngredientDemandPageAsync(IngredientDemandPageQueryDto query)
    {
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Materialrequestlines
            .AsNoTracking()
            .AsQueryable();

        if (ingredientId is not null)
        {
            lines = lines.Where(item => item.IngredientId == ingredientId);
        }

        if (dateFrom is not null)
        {
            lines = lines.Where(item => item.Request.RequestDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            lines = lines.Where(item => item.Request.RequestDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            lines = lines.Where(item => item.PlanLine.ShiftName == shiftName);
        }

        if (customerId is not null)
        {
            lines = lines.Where(item => item.PlanLine.CustomerId.SequenceEqual(customerId));
        }

        var totalCount = await lines.CountAsync();
        var shortageCount = await lines.CountAsync(item =>
            item.Request.Status != "CANCELLED" &&
            item.SuggestedPurchaseQty > 0 &&
            (item.Purchaserequestlines
                 .Where(purchaseLine =>
                     purchaseLine.PurchaseRequest.Status != "CANCELLED" &&
                     purchaseLine.PurchaseRequest.Status != "REJECTED")
                 .Sum(purchaseLine => (decimal?)purchaseLine.PurchaseQty) ?? 0m) < item.SuggestedPurchaseQty);
        var items = await lines
            .OrderByDescending(item => item.Request.RequestDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(item => new IngredientDemandReportDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(item.RequestId),
                RequestLineId = GuidHelper.ToGuidString(item.RequestLineId),
                MaterialRequestCode = item.Request.RequestCode,
                RequestDate = item.Request.RequestDate,
                Status = item.Request.Status,
                ShiftName = item.PlanLine.ShiftName,
                CustomerName = item.PlanLine.Customer.CustomerName,
                DishName = item.PlanLine.Dish.DishName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                BomId = item.BomId == null ? null : GuidHelper.ToGuidString(item.BomId),
                PriceTierAmount = item.PriceTierAmount,
                BomScope = item.BomScope,
                TotalServings = item.TotalServings,
                BomRatePercent = item.BomRatePercent,
                AppliedPortionRuleId = item.AppliedPortionRuleId == null ? null : GuidHelper.ToGuidString(item.AppliedPortionRuleId),
                AppliedPortionRuleSource = item.AppliedPortionRuleSource,
                AppliedPortionRatePercent = item.AppliedPortionRatePercent,
                YieldLossPercent = item.YieldLossPercent,
                TotalRequiredQty = item.TotalRequiredQty,
                CurrentStockQty = item.CurrentStockQty,
                SuggestedPurchaseQty = item.SuggestedPurchaseQty
            })
            .ToListAsync();

        return new IngredientDemandPageDto
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize,
            ShortageCount = shortageCount,
        };
    }

    public async Task<IngredientDemandAggregatePageDto> GetIngredientDemandAggregatePageAsync(IngredientDemandAggregatePageQueryDto query)
    {
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var searchKeyword = query.SearchKeyword?.Trim();

        var lines = _context.Materialrequestlines
            .AsNoTracking()
            .Where(item => item.Request.Status != "CANCELLED")
            .AsQueryable();

        if (ingredientId is not null)
        {
            lines = lines.Where(item => item.IngredientId == ingredientId);
        }

        if (!string.IsNullOrWhiteSpace(searchKeyword))
        {
            lines = lines.Where(item =>
                item.Ingredient.IngredientName.Contains(searchKeyword) ||
                item.Ingredient.IngredientCode.Contains(searchKeyword));
        }

        if (dateFrom is not null)
        {
            lines = lines.Where(item => item.Request.RequestDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            lines = lines.Where(item => item.Request.RequestDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            lines = lines.Where(item => item.PlanLine.ShiftName == shiftName);
        }

        if (customerId is not null)
        {
            lines = lines.Where(item => item.PlanLine.CustomerId.SequenceEqual(customerId));
        }

        var grouped = lines.GroupBy(item => new
        {
            item.Request.RequestDate,
            item.PlanLine.CustomerId,
            CustomerCode = item.PlanLine.Customer.CustomerCode,
            CustomerName = item.PlanLine.Customer.CustomerName,
            item.PriceTierAmount,
            item.IngredientId,
            IngredientName = item.Ingredient.IngredientName,
            item.UnitId,
            UnitName = item.Unit.UnitName,
        });

        var totalCount = await grouped.CountAsync();
        var shortageCount = await grouped.CountAsync(group => group.Sum(item =>
            item.Request.Status == "EXPORTED"
                ? item.TotalRequiredQty - (item.Inventoryissuelines
                    .Sum(issueLine => (decimal?)issueLine.IssuedQty) ?? 0m) > 0m
                    ? item.TotalRequiredQty - (item.Inventoryissuelines
                        .Sum(issueLine => (decimal?)issueLine.IssuedQty) ?? 0m)
                    : 0m
                : item.SuggestedPurchaseQty) > 0m);
        var items = await grouped
            .OrderByDescending(group => group.Key.RequestDate)
            .ThenBy(group => group.Key.IngredientName)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(group => new IngredientDemandAggregateDto
            {
                RequestDate = group.Key.RequestDate,
                CustomerId = GuidHelper.ToGuidString(group.Key.CustomerId),
                CustomerCode = group.Key.CustomerCode,
                CustomerName = group.Key.CustomerName,
                PriceTierAmount = group.Key.PriceTierAmount,
                IngredientId = GuidHelper.ToGuidString(group.Key.IngredientId),
                IngredientName = group.Key.IngredientName,
                UnitId = GuidHelper.ToGuidString(group.Key.UnitId),
                UnitName = group.Key.UnitName,
                TotalRequiredQty = group.Sum(item => item.Request.Status != "CANCELLED" ? item.TotalRequiredQty : 0m),
                // CurrentStockQty is the quantity allocated to each BOM source line after
                // MaterialDemandService consumes the shared stock pool. It is additive at
                // the daily ingredient/unit grain, not a repeated snapshot value.
                CurrentStockQty = group.Sum(item =>
                    item.Request.Status != "CANCELLED" ? item.CurrentStockQty : 0m),
                SuggestedPurchaseQty = group.Sum(item => item.Request.Status != "CANCELLED" ? item.SuggestedPurchaseQty : 0m),
                FulfilledQty = group.Sum(item => item.Request.Status == "EXPORTED"
                    ? item.Inventoryissuelines
                        .Where(issueLine => issueLine.Issue.ReceivedAt != null)
                        .Sum(issueLine => (decimal?)issueLine.IssuedQty) ?? 0m
                    : item.Request.Status != "CANCELLED" ? item.CurrentStockQty : 0m),
                PendingKitchenReceiptQty = group.Sum(item => item.Request.Status == "EXPORTED"
                    ? item.Inventoryissuelines
                        .Where(issueLine => issueLine.Issue.ReceivedAt == null)
                        .Sum(issueLine => (decimal?)issueLine.IssuedQty) ?? 0m
                    : 0m),
                UnissuedQty = group.Sum(item => item.Request.Status == "EXPORTED"
                    ? item.TotalRequiredQty - (item.Inventoryissuelines
                        .Sum(issueLine => (decimal?)issueLine.IssuedQty) ?? 0m) > 0m
                        ? item.TotalRequiredQty - (item.Inventoryissuelines
                            .Sum(issueLine => (decimal?)issueLine.IssuedQty) ?? 0m)
                        : 0m
                    : item.Request.Status != "CANCELLED" ? item.SuggestedPurchaseQty : 0m),
                OutstandingQty = group.Sum(item => item.Request.Status == "EXPORTED"
                    ? item.TotalRequiredQty - (item.Inventoryissuelines
                        .Where(issueLine => issueLine.Issue.ReceivedAt != null)
                        .Sum(issueLine => (decimal?)issueLine.IssuedQty) ?? 0m) > 0m
                        ? item.TotalRequiredQty - (item.Inventoryissuelines
                            .Where(issueLine => issueLine.Issue.ReceivedAt != null)
                            .Sum(issueLine => (decimal?)issueLine.IssuedQty) ?? 0m)
                        : 0m
                    : item.Request.Status != "CANCELLED" ? item.SuggestedPurchaseQty : 0m),
                LineCount = group.Count(item => item.Request.Status != "CANCELLED"),
                // Cancelled history must not mark a successfully regenerated active group as stale.
                HasCancelledLine = false,
            })
            .ToListAsync();

        foreach (var item in items)
        {
            item.FulfillmentStatus = DemandFulfillmentStatus.Resolve(item.FulfilledQty, item.OutstandingQty);
        }

        return new IngredientDemandAggregatePageDto
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize,
            ShortageCount = shortageCount,
        };
    }

    public async Task<MaterialRequestCandidatePageDto> GetMaterialRequestCandidatePageAsync(MaterialRequestCandidatePageQueryDto query)
    {
        var purpose = query.Purpose.Trim().ToLowerInvariant();
        if (purpose is not ("purchase" or "issue"))
        {
            throw new ArgumentException("Mục đích danh sách nhu cầu phải là purchase hoặc issue.");
        }

        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var requests = _context.Materialrequests.AsNoTracking().AsQueryable();

        if (dateFrom is not null)
        {
            requests = requests.Where(item => item.RequestDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            requests = requests.Where(item => item.RequestDate <= dateTo);
        }

        if (purpose == "purchase")
        {
            requests = requests.Where(item =>
                item.Status != "CANCELLED" &&
                item.Status != "EXPORTED" &&
                item.Materialrequestlines.Any(line => line.SuggestedPurchaseQty > 0));
        }
        else
        {
            requests = requests.Where(item =>
                (item.Status == "MANAGERAPPROVED" || item.Status == "APPROVED" || item.Status == "SENTTOWAREHOUSE") &&
                item.Materialrequestlines.Sum(line => line.TotalRequiredQty) >
                item.Inventoryissues.SelectMany(issue => issue.Inventoryissuelines).Sum(line => line.IssuedQty));
        }

        var totalCount = await requests.CountAsync();
        var items = await requests
            .OrderByDescending(item => item.RequestDate)
            .ThenBy(item => item.RequestCode)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(item => new MaterialRequestCandidateDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(item.RequestId),
                MaterialRequestCode = item.RequestCode,
                CustomerCode = item.Materialrequestlines.Select(line => line.PlanLine.Customer.CustomerCode).FirstOrDefault() ?? string.Empty,
                CustomerName = item.Materialrequestlines.Select(line => line.PlanLine.Customer.CustomerName).FirstOrDefault() ?? string.Empty,
                RequestDate = item.RequestDate,
                RequestScope = item.RequestScope,
                Status = item.Status,
                ActionableLineCount = purpose == "purchase"
                    ? item.Materialrequestlines.Count(line => line.SuggestedPurchaseQty > 0)
                    : item.Materialrequestlines.Count,
                ActionableQuantity = purpose == "purchase"
                    ? item.Materialrequestlines.Sum(line => line.SuggestedPurchaseQty)
                    : item.Materialrequestlines.Sum(line => line.TotalRequiredQty) -
                      item.Inventoryissues.SelectMany(issue => issue.Inventoryissuelines).Sum(line => line.IssuedQty),
                HasExistingPurchaseRequest = item.Materialrequestlines.Any(line =>
                    line.Purchaserequestlines.Any(purchaseLine => purchaseLine.PurchaseRequest.Status != "CANCELLED")),
                ConcurrencyVersion = item.Inventoryissues.LongCount(),
            })
            .ToListAsync();

        return new MaterialRequestCandidatePageDto
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize,
        };
    }

    private static byte[]? ParseCustomerId(string? value)
        => GuidHelper.ParseFilterIdOrThrow(value, "khách hàng");

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var parsed) ? parsed : null;

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

    private static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };
}
