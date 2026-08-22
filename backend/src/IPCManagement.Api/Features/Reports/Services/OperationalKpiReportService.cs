using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public sealed class OperationalKpiReportService : IOperationalKpiReportService
{
    private const int LateReceiptThresholdDays = 3;
    private readonly IpcManagementContext _context;
    private readonly IDataQualityReportService _dataQualityReportService;

    public OperationalKpiReportService(IpcManagementContext context)
        : this(context, new DataQualityReportService(context))
    {
    }

    public OperationalKpiReportService(
        IpcManagementContext context,
        IDataQualityReportService dataQualityReportService)
    {
        _context = context;
        _dataQualityReportService = dataQualityReportService;
    }

    public async Task<OperationalKpiSummaryDto> GetOperationalKpisAsync(int? criticalDataQualityCount = null)
    {
        var now = DateTime.UtcNow;
        var today = ServiceCalendar.Today();
        var demandWindowStart = today.AddDays(-7);
        var lateReceiptCutoff = today.AddDays(-LateReceiptThresholdDays);
        var approvalCutoff = now.AddHours(-24);
        var failedStatuses = new[] { "FAILED", "IMPORT_FAILED" };

        var shortageCount = await _context.Materialrequestlines
            .AsNoTracking()
            .CountAsync(line => line.SuggestedPurchaseQty > 0 && line.Request.Status != "CANCELLED");

        var overduePurchaseRequestCount = await _context.Purchaserequests
            .AsNoTracking()
            .Where(pr => (pr.Status == "DRAFT" || pr.Status == "APPROVED") && pr.PurchaseForDate < today)
            .CountAsync(pr => pr.Purchaserequestlines.Any(line =>
                line.PurchaseOrderLine == null ||
                line.PurchaseOrderLine.ReceivedQty < line.PurchaseOrderLine.OrderedQty));

        var lateReceiptCount = await _context.Purchaseorders
            .AsNoTracking()
            .CountAsync(po => (po.Status == "ORDERED" || po.Status == "PARTIALLY_RECEIVED") && po.OrderDate <= lateReceiptCutoff);

        var pendingKitchenConfirmationCount = await _context.Inventoryissues
            .AsNoTracking()
            .CountAsync(issue => issue.ReceivedBy == null);

        var failedWorkflowCount =
            await _context.Materialrequests.AsNoTracking().CountAsync(request => failedStatuses.Contains(request.Status)) +
            await _context.Purchaserequests.AsNoTracking().CountAsync(request => failedStatuses.Contains(request.Status)) +
            await _context.Menuversions.AsNoTracking().CountAsync(version => failedStatuses.Contains(version.Status));

        if (criticalDataQualityCount is null)
        {
            var dataQuality = await _dataQualityReportService.GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 500 });
            criticalDataQualityCount = dataQuality.ErrorCount;
        }

        var overdueApprovalCount =
            await _context.Purchaserequests
                .AsNoTracking()
                .CountAsync(request =>
                    request.Status == "SENTTOSUPPLIER" &&
                    request.RequestDate < today &&
                    !_context.Approvalhistories.Any(history =>
                        history.TargetType == "purchase-request" &&
                        history.TargetId == request.PurchaseRequestId)) +
            await _context.Inventoryissues
                .AsNoTracking()
                .CountAsync(issue =>
                    issue.CreatedAt <= approvalCutoff &&
                    issue.MaterialRequest.Status == "SENTTOWAREHOUSE" &&
                    !_context.Approvalhistories.Any(history =>
                        history.TargetType == "inventory-issue" &&
                        history.TargetId == issue.IssueId)) +
            await _context.Quantityadjustments
                .AsNoTracking()
                .CountAsync(adjustment =>
                    adjustment.AdjustedAt <= approvalCutoff &&
                    !_context.Approvalhistories.Any(history =>
                        history.TargetType == "order-adjustment" &&
                        history.TargetId == adjustment.AdjustmentId));

        var lowStockCount = await ComputeLowStockCountAsync(demandWindowStart, today);

        var kitchenIssueLines = QueryIssueLines(new WorkflowReportQueryDto());
        var totalKitchenIssuedQty = await kitchenIssueLines.SumAsync(item => item.IssuedQty);
        var kitchenIssueIds = await kitchenIssueLines
            .Select(item => item.IssueId)
            .Distinct()
            .ToListAsync();
        var kitchenReturnTotals = await _context.Inventoryreturnlines
            .AsNoTracking()
            .Where(item => kitchenIssueIds.Contains(item.Return.IssueId))
            .GroupBy(item => item.Return.ReturnType)
            .Select(group => new { ReturnType = group.Key, Quantity = group.Sum(item => item.Quantity) })
            .ToListAsync();
        var totalKitchenReturnedQty = kitchenReturnTotals
            .Where(item => item.ReturnType == "RETURN")
            .Select(item => item.Quantity)
            .FirstOrDefault();
        var totalKitchenWastedQty = kitchenReturnTotals
            .Where(item => item.ReturnType == "WASTE")
            .Select(item => item.Quantity)
            .FirstOrDefault();
        var totalKitchenUsedQty = WorkflowReportCalculator.CalculateUsedQuantity(
            totalKitchenIssuedQty,
            totalKitchenReturnedQty + totalKitchenWastedQty);

        return new OperationalKpiSummaryDto
        {
            ShortageCount = shortageCount,
            LowStockCount = lowStockCount,
            OverduePurchaseRequestCount = overduePurchaseRequestCount,
            LateReceiptCount = lateReceiptCount,
            PendingKitchenConfirmationCount = pendingKitchenConfirmationCount,
            FailedWorkflowCount = failedWorkflowCount,
            CriticalDataQualityCount = criticalDataQualityCount.Value,
            OverdueApprovalCount = overdueApprovalCount,
            TotalKitchenIssuedQty = DecimalPolicy.RoundQuantity(totalKitchenIssuedQty),
            TotalKitchenUsedQty = totalKitchenUsedQty,
            TotalKitchenReturnedQty = DecimalPolicy.RoundQuantity(totalKitchenReturnedQty),
            GeneratedAt = now
        };
    }

    /// <summary>Tồn thấp = tồn hiện tại không đủ dùng cho 1 ngày nữa nếu nhu cầu giữ nguyên như trung bình 7 ngày gần nhất
    /// (chưa có ngưỡng tối thiểu cấu hình theo từng nguyên liệu, nên suy ra từ lịch sử nhu cầu thay vì hardcode).</summary>
    private async Task<int> ComputeLowStockCountAsync(DateOnly demandWindowStart, DateOnly today)
    {
        var demandRows = await _context.Materialrequestlines
            .AsNoTracking()
            .Where(line => line.Request.RequestDate >= demandWindowStart && line.Request.RequestDate <= today)
            .Select(line => new KpiUnitQuantityProjection
            {
                IngredientId = line.IngredientId,
                SourceUnitId = line.UnitId,
                TargetUnitId = line.Ingredient.UnitId,
                SourceUnitCode = line.Unit.UnitCode,
                SourceBaseUnitCode = line.Unit.BaseUnitCode,
                SourceRateToBase = line.Unit.ConvertRateToBase,
                TargetUnitCode = line.Ingredient.Unit.UnitCode,
                TargetBaseUnitCode = line.Ingredient.Unit.BaseUnitCode,
                TargetRateToBase = line.Ingredient.Unit.ConvertRateToBase,
                Quantity = line.TotalRequiredQty
            })
            .ToListAsync();

        if (demandRows.Count == 0)
        {
            return 0;
        }

        var stockRows = await _context.Currentstocks
            .AsNoTracking()
            .Select(stock => new KpiUnitQuantityProjection
            {
                IngredientId = stock.IngredientId,
                SourceUnitId = stock.UnitId,
                TargetUnitId = stock.Ingredient.UnitId,
                SourceUnitCode = stock.Unit.UnitCode,
                SourceBaseUnitCode = stock.Unit.BaseUnitCode,
                SourceRateToBase = stock.Unit.ConvertRateToBase,
                TargetUnitCode = stock.Ingredient.Unit.UnitCode,
                TargetBaseUnitCode = stock.Ingredient.Unit.BaseUnitCode,
                TargetRateToBase = stock.Ingredient.Unit.ConvertRateToBase,
                Quantity = stock.CurrentQty
            })
            .ToListAsync();

        var totalDemandByIngredient = demandRows
            .GroupBy(item => Convert.ToBase64String(item.IngredientId), StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => DecimalPolicy.RoundQuantity(group.Sum(ConvertKpiQuantity)),
                StringComparer.Ordinal);
        var currentStockByIngredient = stockRows
            .GroupBy(item => Convert.ToBase64String(item.IngredientId), StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => DecimalPolicy.RoundQuantity(group.Sum(ConvertKpiQuantity)),
                StringComparer.Ordinal);

        return totalDemandByIngredient.Count(demand =>
        {
            var currentQty = currentStockByIngredient.GetValueOrDefault(demand.Key, 0);
            return OperationalKpiPolicy.IsLowStock(demand.Value, currentQty);
        });
    }

    private static decimal ConvertKpiQuantity(KpiUnitQuantityProjection item)
    {
        if (item.SourceUnitId.SequenceEqual(item.TargetUnitId))
        {
            return item.Quantity;
        }

        var sourceBase = string.IsNullOrWhiteSpace(item.SourceBaseUnitCode)
            ? item.SourceUnitCode
            : item.SourceBaseUnitCode;
        var targetBase = string.IsNullOrWhiteSpace(item.TargetBaseUnitCode)
            ? item.TargetUnitCode
            : item.TargetBaseUnitCode;
        if (item.SourceRateToBase <= 0 || item.TargetRateToBase <= 0 ||
            !string.Equals(sourceBase.Trim(), targetBase.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            // Giữ hành vi legacy và để data-quality phát hiện unit không hợp lệ; không được bỏ dòng.
            return item.Quantity;
        }

        return DecimalPolicy.RoundQuantity(item.Quantity * item.SourceRateToBase / item.TargetRateToBase);
    }

    private IQueryable<InventoryIssueLine> QueryIssueLines(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Inventoryissuelines
            .AsNoTracking()
            .Include(item => item.Issue)
                .ThenInclude(item => item.Warehouse)
            .Include(item => item.Issue)
                .ThenInclude(item => item.ReceivedByNavigation)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();

        if (warehouseId is not null)
        {
            lines = lines.Where(item => item.Issue.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            lines = lines.Where(item => item.IngredientId == ingredientId);
        }

        if (dateFrom is not null)
        {
            lines = lines.Where(item => item.Issue.IssueDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            lines = lines.Where(item => item.Issue.IssueDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            lines = lines.Where(item => item.Issue.ShiftName == shiftName);
        }

        return lines;
    }

    private sealed class KpiUnitQuantityProjection
    {
        public byte[] IngredientId { get; init; } = [];
        public byte[] SourceUnitId { get; init; } = [];
        public byte[] TargetUnitId { get; init; } = [];
        public string SourceUnitCode { get; init; } = string.Empty;
        public string? SourceBaseUnitCode { get; init; }
        public decimal SourceRateToBase { get; init; }
        public string TargetUnitCode { get; init; } = string.Empty;
        public string? TargetBaseUnitCode { get; init; }
        public decimal TargetRateToBase { get; init; }
        public decimal Quantity { get; init; }
    }

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var date) ? date : null;

    private static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };
}
