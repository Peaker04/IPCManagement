using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public class WorkflowReportService : IWorkflowReportService
{
    private const int LateReceiptThresholdDays = 3;
    private const int DefaultStockMovementWindowDays = 31;
    private readonly IpcManagementContext _context;
    private readonly IDataQualityReportService _dataQualityReportService;
    private readonly IDataQualityCommandService _dataQualityCommandService;

    public WorkflowReportService(IpcManagementContext context)
        : this(context, new StockLedgerReportService(context))
    {
    }

    public WorkflowReportService(
        IpcManagementContext context,
        IStockLedgerReportService stockLedgerReportService)
        : this(
            context,
            stockLedgerReportService,
            new DataQualityReportService(context, stockLedgerReportService))
    {
    }

    public WorkflowReportService(
        IpcManagementContext context,
        IStockLedgerReportService stockLedgerReportService,
        IDataQualityReportService dataQualityReportService)
        : this(
            context,
            stockLedgerReportService,
            dataQualityReportService,
            new DataQualityCommandService(context, stockLedgerReportService))
    {
    }

    public WorkflowReportService(
        IpcManagementContext context,
        IStockLedgerReportService stockLedgerReportService,
        IDataQualityReportService dataQualityReportService,
        IDataQualityCommandService dataQualityCommandService)
    {
        _context = context;
        _dataQualityReportService = dataQualityReportService;
        _dataQualityCommandService = dataQualityCommandService;
    }

    public Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query)
        => _dataQualityReportService.GetDataQualityAsync(query);

    public Task<DataQualityPageDto> GetDataQualityPageAsync(DataQualityPageQueryDto query)
        => _dataQualityReportService.GetDataQualityPageAsync(query);

    public Task<DataQualityIssueRemediationDto> UpdateDataQualityIssueRemediationAsync(
        DataQualityIssueRemediationRequest request,
        string actorUserId)
        => _dataQualityCommandService.UpdateDataQualityIssueRemediationAsync(request, actorUserId);

    public Task<DataQualityCleanupResultDto> CleanupDataQualityAsync(
        DataQualityCleanupRequest request,
        string actorUserId)
        => _dataQualityCommandService.CleanupDataQualityAsync(request, actorUserId);

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

        var candidateOverdueRequests = await _context.Purchaserequests
            .AsNoTracking()
            .Include(pr => pr.Purchaserequestlines)
                .ThenInclude(line => line.PurchaseOrderLine)
            .Where(pr => (pr.Status == "DRAFT" || pr.Status == "APPROVED") && pr.PurchaseForDate < today)
            .ToListAsync();

        var overduePurchaseRequestCount = candidateOverdueRequests.Count(pr => pr.Purchaserequestlines.Any(line =>
            line.PurchaseOrderLine is null ||
            DecimalPolicy.LessThanQuantity(line.PurchaseOrderLine.ReceivedQty, line.PurchaseOrderLine.OrderedQty)));

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
            var dataQuality = await GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 500 });
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
        var avgDailyDemandByIngredient = await _context.Materialrequestlines
            .AsNoTracking()
            .Where(line => line.Request.RequestDate >= demandWindowStart && line.Request.RequestDate <= today)
            .GroupBy(line => line.IngredientId)
            .Select(group => new { IngredientId = group.Key, TotalRequiredQty = group.Sum(line => line.TotalRequiredQty) })
            .ToListAsync();

        if (avgDailyDemandByIngredient.Count == 0)
        {
            return 0;
        }

        var currentStockByIngredient = await _context.Currentstocks
            .AsNoTracking()
            .GroupBy(stock => stock.IngredientId)
            .Select(group => new { IngredientId = group.Key, CurrentQty = group.Sum(stock => stock.CurrentQty) })
            .ToDictionaryAsync(item => Convert.ToBase64String(item.IngredientId), item => item.CurrentQty);

        return avgDailyDemandByIngredient.Count(demand =>
        {
            var avgDailyQty = demand.TotalRequiredQty / 7m;
            if (avgDailyQty <= 0)
            {
                return false;
            }

            var currentQty = currentStockByIngredient.GetValueOrDefault(Convert.ToBase64String(demand.IngredientId), 0);
            return DecimalPolicy.LessThanQuantity(currentQty, avgDailyQty);
        });
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

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var date) ? date : null;

    private static byte[]? ParseCustomerId(string? value)
        => GuidHelper.ParseFilterIdOrThrow(value, "khách hàng");

    private static DateTime? ParseDateTimeStart(string? value)
        => DateOnly.TryParse(value, out var date)
            ? date.ToDateTime(TimeOnly.MinValue)
            : null;

    private static DateTime? ParseDateTimeEndExclusive(string? value)
        => DateOnly.TryParse(value, out var date)
            ? date.AddDays(1).ToDateTime(TimeOnly.MinValue)
            : null;

    private static DateTime? ParseCursorDateTime(string? value)
        => DateTime.TryParse(value, out var dateTime)
            ? dateTime
            : ParseDateTimeStart(value);

    /// <summary>
    /// Mở biên con trỏ ra đúng một tick để phép so sánh chặt sẵn có bao luôn các dòng **trùng mốc thời gian**
    /// với dòng cuối trang trước; số dòng đã tiêu thụ ở mốc đó được bỏ qua bằng <c>Skip(CursorOffset)</c>.
    /// </summary>
    /// <remarks>
    /// Cột thời gian là <c>datetime</c> (đơn vị giây) nên một mốc thường chứa hàng chục dòng — nhiều hơn một
    /// trang. So sánh chặt theo ngày làm trang sau nhảy qua toàn bộ phần còn lại của mốc đó.
    /// Khóa phân trang đúng phải là cặp (thời gian, id), nhưng id là <c>binary(16)</c> nên LINQ không so sánh
    /// thứ tự được; cặp (biên mở rộng, số dòng đã tiêu thụ) cho kết quả tương đương và dịch thẳng xuống SQL.
    /// Client cũ không gửi <c>CursorOffset</c> thì giữ nguyên biên cũ.
    /// </remarks>
    private static DateTime? ResolveCursorBoundary(DateTime? cursorDate, int? cursorOffset, bool ascending)
    {
        if (cursorDate is null || cursorOffset is null) return cursorDate;

        return ascending
            ? cursorDate.Value > DateTime.MinValue ? cursorDate.Value.AddTicks(-1) : cursorDate
            : cursorDate.Value < DateTime.MaxValue ? cursorDate.Value.AddTicks(1) : cursorDate;
    }

    private static (DateTime DateFrom, DateTime DateToExclusive) ResolveStockMovementWindow(WorkflowReportQueryDto query)
    {
        var dateToExclusive = ParseDateTimeEndExclusive(query.DateTo)
            ?? ServiceCalendar.Today().AddDays(1).ToDateTime(TimeOnly.MinValue);
        var dateFrom = ParseDateTimeStart(query.DateFrom)
            ?? DateOnly.FromDateTime(dateToExclusive).AddDays(-DefaultStockMovementWindowDays).ToDateTime(TimeOnly.MinValue);

        return (dateFrom, dateToExclusive);
    }

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

    private static int NormalizeAggregateLimit(int limit)
        => limit < 0 ? int.MaxValue : NormalizeLimit(limit);

    private static int NormalizePageLimit(int limit)
        => Math.Clamp(limit <= 0 ? 20 : limit, 1, 100);

    private static bool IsAscending(WorkflowReportQueryDto query)
        => string.Equals(query.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);

    private static CursorPageDto<T> BuildCursorPage<T>(
        IReadOnlyList<T> rows,
        int limit,
        Func<T, DateTime> getCursorDate,
        Func<T, string> getCursorId,
        WorkflowReportQueryDto query)
    {
        var items = rows.Take(limit).ToList();
        var hasNext = rows.Count > limit;
        var cursorItem = hasNext ? items.LastOrDefault() : default;

        // Số dòng đã tiêu thụ tại mốc thời gian của dòng cuối trang: cộng dồn với trang trước
        // nếu trang này vẫn nằm trong cùng một mốc, ngược lại đếm lại từ đầu mốc mới.
        var nextCursorOffset = 0;
        if (cursorItem is not null)
        {
            var boundaryDate = getCursorDate(cursorItem);
            nextCursorOffset = items.Count(item => getCursorDate(item) == boundaryDate);
            if (ParseCursorDateTime(query.CursorDate) == boundaryDate)
            {
                nextCursorOffset += query.CursorOffset ?? 0;
            }
        }

        return new CursorPageDto<T>
        {
            Items = items,
            Limit = limit,
            HasNext = hasNext,
            NextCursorDate = cursorItem is null ? null : getCursorDate(cursorItem).ToString("O"),
            NextCursorId = cursorItem is null ? null : getCursorId(cursorItem),
            NextCursorOffset = nextCursorOffset
        };
    }

    private static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };

    private sealed class ByteArrayComparer : IEqualityComparer<byte[]>
    {
        public static readonly ByteArrayComparer Instance = new();

        public bool Equals(byte[]? x, byte[]? y)
            => ReferenceEquals(x, y) || (x is not null && y is not null && x.SequenceEqual(y));

        public int GetHashCode(byte[] obj)
        {
            var hash = new HashCode();
            foreach (var value in obj)
            {
                hash.Add(value);
            }

            return hash.ToHashCode();
        }
    }
}
