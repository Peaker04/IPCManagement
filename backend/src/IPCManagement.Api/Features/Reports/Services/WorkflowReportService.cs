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
    private const string DataQualityBusinessArea = "DataQuality";
    private const string DataQualityIssueEntityName = "DataQualityIssue";
    private const string DataQualityRemediationFieldName = "Remediation";
    private const string DataQualityCleanupFieldName = "Cleanup";
    private const decimal StockLedgerMatchTolerance = 0.000010m;
    private const string LegacyLedgerBaselineRefTable = "LEGACY_CURRENTSTOCK_BASELINE";

    private readonly IpcManagementContext _context;
    private readonly IStockLedgerReportService _stockLedgerReportService;
    private readonly IDataQualityReportService _dataQualityReportService;

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
    {
        _context = context;
        _stockLedgerReportService = stockLedgerReportService;
        _dataQualityReportService = dataQualityReportService;
    }

    public Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query)
        => _dataQualityReportService.GetDataQualityAsync(query);

    public Task<DataQualityPageDto> GetDataQualityPageAsync(DataQualityPageQueryDto query)
        => _dataQualityReportService.GetDataQualityPageAsync(query);

    public async Task<DataQualityIssueRemediationDto> UpdateDataQualityIssueRemediationAsync(
        DataQualityIssueRemediationRequest request,
        string actorUserId)
    {
        var issueId = request.IssueId.Trim();
        if (string.IsNullOrWhiteSpace(issueId))
        {
            throw new ArgumentException("Thiếu mã data-quality issue.");
        }

        var normalizedStatus = NormalizeDataQualityRemediationAction(request.Action);
        var actorId = GuidHelper.ParseGuidString(actorUserId)
            ?? throw new UnauthorizedAccessException("Không xác định được người dùng.");
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        var now = DateTime.UtcNow;

        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = now,
            ChangedBy = actorId,
            BusinessArea = DataQualityBusinessArea,
            EntityName = DataQualityIssueEntityName,
            EntityId = null,
            FieldName = DataQualityRemediationFieldName,
            OldValue = issueId,
            NewValue = normalizedStatus,
            Reason = note
        });
        await _context.SaveChangesAsync();

        return new DataQualityIssueRemediationDto
        {
            IssueId = issueId,
            RemediationStatus = normalizedStatus,
            RemediationAt = now,
            Note = note
        };
    }

    public async Task<DataQualityCleanupResultDto> CleanupDataQualityAsync(
        DataQualityCleanupRequest request,
        string actorUserId)
    {
        var actorId = GuidHelper.ParseGuidString(actorUserId)
            ?? throw new UnauthorizedAccessException("Không xác định được người dùng.");
        var limit = NormalizeLimit(request.Limit);
        var categories = NormalizeDataQualityCleanupCategories(request.Categories);
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        var now = DateTime.UtcNow;
        var staleStatuses = new[] { "CANCELLED", "FAILED", "IMPORT_FAILED" };
        var orphanCleanupStatuses = new[] { "DRAFT", "CANCELLED", "FAILED", "IMPORT_FAILED" };
        var actions = new List<DataQualityCleanupActionDto>();
        var stalePurchaseRequestIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new DataQualityCleanupResultDto
        {
            DryRun = request.DryRun,
            ExecutedAt = now
        };

        await using var transaction = request.DryRun ? null : await _context.Database.BeginTransactionAsync();

        void AddAction(
            string category,
            string entityName,
            byte[] entityId,
            string entityCode,
            string action,
            string reason,
            string? oldValue = null)
        {
            actions.Add(new DataQualityCleanupActionDto
            {
                Category = category,
                EntityName = entityName,
                EntityId = GuidHelper.ToGuidString(entityId),
                EntityCode = entityCode,
                Action = action,
                Reason = reason
            });

            if (!request.DryRun)
            {
                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = now,
                    ChangedBy = actorId,
                    BusinessArea = DataQualityBusinessArea,
                    EntityName = entityName,
                    EntityId = entityId,
                    FieldName = DataQualityCleanupFieldName,
                    OldValue = oldValue ?? entityCode,
                    NewValue = action,
                    Reason = note is null ? reason : $"{reason} Note: {note}"
                });
                result.AuditLogCount++;
            }
        }

        if (categories.Contains("inventory_ledger_baseline"))
        {
            var ledgerRows = await _stockLedgerReportService.LoadSourceRowsAsync(new WorkflowReportQueryDto());
            var baselineActionCount = 0;
            foreach (var stock in ledgerRows
                         .Where(row => row.HasCurrentStock)
                         .OrderBy(row => row.WarehouseName)
                         .ThenBy(row => row.IngredientName))
            {
                if (baselineActionCount >= limit)
                {
                    break;
                }

                if (stock.HasLegacyBaseline)
                {
                    continue;
                }

                if (stock.LastMovementAt > stock.CurrentLastUpdated)
                {
                    continue;
                }

                var ledgerQty = stock.LedgerQty;
                var currentQty = stock.CurrentQty;
                var difference = stock.DifferenceQty;
                if (Math.Abs(difference) <= StockLedgerMatchTolerance)
                {
                    continue;
                }

                var entityCode = $"{stock.WarehouseCode}/{stock.IngredientCode}";
                var reason =
                    $"Bổ sung opening balance ledger cho snapshot tồn cũ: ledger={ledgerQty:0.######}, current={currentQty:0.######}.";
                AddAction(
                    "inventory_ledger_baseline",
                    nameof(CurrentStock),
                    stock.IngredientId,
                    entityCode,
                    "ledger_baseline_added",
                    reason,
                    $"difference={difference:0.######}");
                baselineActionCount++;

                if (!request.DryRun)
                {
                    _context.Stockmovements.Add(new StockMovement
                    {
                        MovementId = GuidHelper.NewId(),
                        MovementDate = stock.CurrentLastUpdated!.Value,
                        WarehouseId = stock.WarehouseId,
                        IngredientId = stock.IngredientId,
                        UnitId = stock.UnitId,
                        MovementType = "ADJUSTMENT",
                        RefTable = LegacyLedgerBaselineRefTable,
                        RefId = stock.IngredientId,
                        QuantityIn = difference > 0 ? difference : 0,
                        QuantityOut = difference < 0 ? Math.Abs(difference) : 0,
                        BeforeQty = ledgerQty,
                        AfterQty = currentQty,
                        Reason = reason,
                        Note = note,
                        PerformedBy = actorId
                    });
                }
            }
        }

        if (categories.Contains("zero_stock_unit"))
        {
            var zeroStocks = await _context.Currentstocks
                .Include(stock => stock.Warehouse)
                .Include(stock => stock.Unit)
                .Include(stock => stock.Ingredient)
                    .ThenInclude(ingredient => ingredient.Unit)
                .Where(stock => stock.CurrentQty == 0)
                .OrderBy(stock => stock.Warehouse.WarehouseCode)
                .ThenBy(stock => stock.Ingredient.IngredientCode)
                .ToListAsync();

            foreach (var stock in zeroStocks.Where(stock =>
                         !stock.UnitId.SequenceEqual(stock.Ingredient.UnitId) &&
                         !CanConvertUnits(stock.Unit, stock.Ingredient.Unit))
                     .Take(limit))
            {
                var oldUnitCode = stock.Unit.UnitCode;
                var targetUnitCode = stock.Ingredient.Unit.UnitCode;
                var reason =
                    $"Chuẩn hóa unit cho tồn bằng 0 từ '{oldUnitCode}' sang unit nguyên liệu '{targetUnitCode}'; không cần hệ số quy đổi.";
                AddAction(
                    "zero_stock_unit",
                    nameof(CurrentStock),
                    stock.IngredientId,
                    $"{stock.Warehouse.WarehouseCode}/{stock.Ingredient.IngredientCode}",
                    "unit_normalized",
                    reason,
                    oldUnitCode);

                if (!request.DryRun)
                {
                    stock.UnitId = stock.Ingredient.UnitId;
                    stock.LastUpdated = now;
                }
            }
        }

        if (categories.Contains("stale_purchase_request"))
        {
            var stalePurchaseRequests = await _context.Purchaserequests
                .Include(purchaseRequest => purchaseRequest.Purchaserequestlines)
                    .ThenInclude(line => line.Inventoryreceiptlines)
                .Include(purchaseRequest => purchaseRequest.Purchaserequestlines)
                    .ThenInclude(line => line.PurchaseOrderLine)
                .Include(purchaseRequest => purchaseRequest.Inventoryreceipts)
                .Include(purchaseRequest => purchaseRequest.Purchaseorders)
                .Where(purchaseRequest => staleStatuses.Contains(purchaseRequest.Status))
                .OrderBy(purchaseRequest => purchaseRequest.PurchaseRequestCode)
                .Take(limit)
                .ToListAsync();

            foreach (var purchaseRequest in stalePurchaseRequests)
            {
                if (purchaseRequest.Inventoryreceipts.Count > 0 ||
                    purchaseRequest.Purchaseorders.Count > 0 ||
                    purchaseRequest.Purchaserequestlines.Any(line =>
                        line.Inventoryreceiptlines.Count > 0 || line.PurchaseOrderLine is not null))
                {
                    continue;
                }

                AddAction(
                    "stale_purchase_request",
                    nameof(PurchaseRequest),
                    purchaseRequest.PurchaseRequestId,
                    purchaseRequest.PurchaseRequestCode,
                    "removed",
                    "Đề xuất mua ở trạng thái nháp/hủy/lỗi không còn được dùng cho workflow vận hành.",
                    purchaseRequest.Status);
                stalePurchaseRequestIds.Add(GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId));

                result.RemovedPurchaseRequestLines += purchaseRequest.Purchaserequestlines.Count;
                result.RemovedPurchaseRequests++;

                if (!request.DryRun)
                {
                    _context.Purchaserequestlines.RemoveRange(purchaseRequest.Purchaserequestlines);
                    _context.Purchaserequests.Remove(purchaseRequest);
                }
            }

            if (!request.DryRun)
            {
                await _context.SaveChangesAsync();
            }
        }

        if (categories.Contains("orphan_document"))
        {
            var orphanPurchaseLines = await _context.Purchaserequestlines
                .Include(line => line.PurchaseRequest)
                .Include(line => line.Inventoryreceiptlines)
                .Include(line => line.PurchaseOrderLine)
                .Include(line => line.Ingredient)
                .Where(line =>
                    orphanCleanupStatuses.Contains(line.PurchaseRequest.Status) &&
                    !_context.Materialrequestlines.Any(materialLine => materialLine.RequestLineId == line.MaterialRequestLineId))
                .OrderBy(line => line.PurchaseRequest.PurchaseRequestCode)
                .Take(limit)
                .ToListAsync();

            foreach (var line in orphanPurchaseLines)
            {
                if (stalePurchaseRequestIds.Contains(GuidHelper.ToGuidString(line.PurchaseRequestId)))
                {
                    continue;
                }

                if (line.Inventoryreceiptlines.Count > 0 || line.PurchaseOrderLine is not null)
                {
                    continue;
                }

                AddAction(
                    "orphan_document",
                    nameof(PurchaseRequestLine),
                    line.PurchaseRequestLineId,
                    $"{line.PurchaseRequest.PurchaseRequestCode}/{line.Ingredient.IngredientName}",
                    "removed",
                    "Dòng mua thêm không còn dòng demand gốc và chưa phát sinh receipt/order.",
                    GuidHelper.ToGuidString(line.MaterialRequestLineId));

                result.RemovedPurchaseRequestLines++;

                if (!request.DryRun)
                {
                    _context.Purchaserequestlines.Remove(line);
                }
            }

            if (!request.DryRun)
            {
                await _context.SaveChangesAsync();
            }
        }

        if (categories.Contains("orphan_document"))
        {
            var stockMovementRefs = await _context.Stockmovements
                .AsNoTracking()
                .Where(movement => movement.RefId != null)
                .Select(movement => movement.RefId!)
                .ToListAsync();
            var stockMovementRefIds = stockMovementRefs
                .Select(GuidHelper.ToGuidString)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var orphanIssues = await _context.Inventoryissues
                .Include(issue => issue.Inventoryissuelines)
                .Include(issue => issue.Inventoryreturns)
                .Where(issue => !_context.Materialrequests.Any(request => request.RequestId == issue.MaterialRequestId))
                .OrderBy(issue => issue.IssueCode)
                .Take(limit)
                .ToListAsync();

            foreach (var issue in orphanIssues)
            {
                if (issue.Inventoryreturns.Count > 0 ||
                    issue.ReceivedAt is not null ||
                    stockMovementRefIds.Contains(GuidHelper.ToGuidString(issue.IssueId)))
                {
                    continue;
                }

                AddAction(
                    "orphan_document",
                    nameof(InventoryIssue),
                    issue.IssueId,
                    issue.IssueCode,
                    "removed",
                    "Phiếu xuất không còn demand gốc và chưa phát sinh nhận bếp/hoàn kho/stock movement.",
                    GuidHelper.ToGuidString(issue.MaterialRequestId));

                result.RemovedInventoryIssueLines += issue.Inventoryissuelines.Count;
                result.RemovedInventoryIssues++;

                if (!request.DryRun)
                {
                    _context.Inventoryissuelines.RemoveRange(issue.Inventoryissuelines);
                    _context.Inventoryissues.Remove(issue);
                }
            }

            if (!request.DryRun)
            {
                await _context.SaveChangesAsync();
            }
        }

        if (categories.Contains("stale_demand") || categories.Contains("orphan_document"))
        {
            var materialRequests = await _context.Materialrequests
                .Include(materialRequest => materialRequest.Materialrequestlines)
                    .ThenInclude(line => line.Purchaserequestlines)
                .Include(materialRequest => materialRequest.Inventoryissues)
                .Where(materialRequest =>
                    orphanCleanupStatuses.Contains(materialRequest.Status) &&
                    ((categories.Contains("stale_demand") && materialRequest.Status == "CANCELLED") ||
                     (categories.Contains("orphan_document") && !_context.Productionplans.Any(plan => plan.PlanId == materialRequest.PlanId))))
                .OrderBy(materialRequest => materialRequest.RequestCode)
                .Take(limit)
                .ToListAsync();

            foreach (var materialRequest in materialRequests)
            {
                if (materialRequest.Inventoryissues.Count > 0 ||
                    materialRequest.Materialrequestlines.Any(line => line.Purchaserequestlines.Count > 0))
                {
                    continue;
                }

                var category = await _context.Productionplans.AnyAsync(plan => plan.PlanId == materialRequest.PlanId)
                    ? "stale_demand"
                    : "orphan_document";

                AddAction(
                    category,
                    nameof(MaterialRequest),
                    materialRequest.RequestId,
                    materialRequest.RequestCode,
                    "removed",
                    category == "stale_demand"
                        ? "Demand đã hủy và chưa phát sinh mua/xuất kho."
                        : "Demand không còn KHSX gốc và chưa phát sinh mua/xuất kho.",
                    materialRequest.Status);

                result.RemovedMaterialRequestLines += materialRequest.Materialrequestlines.Count;
                result.RemovedMaterialRequests++;

                if (!request.DryRun)
                {
                    _context.Materialrequestlines.RemoveRange(materialRequest.Materialrequestlines);
                    _context.Materialrequests.Remove(materialRequest);
                }
            }
        }

        if (!request.DryRun)
        {
            await _context.SaveChangesAsync();
            if (transaction is not null)
            {
                await transaction.CommitAsync();
            }
        }

        result.TotalActions = actions.Count;
        result.Actions = actions;
        return result;
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

    private static string NormalizeDataQualityRemediationAction(string action)
        => action.Trim().ToLowerInvariant() switch
        {
            "resolve" or "resolved" => "resolved",
            "reopen" or "reopened" => "reopened",
            _ => throw new ArgumentException("Hành động data-quality issue phải là resolve hoặc reopen.")
        };

    private static HashSet<string> NormalizeDataQualityCleanupCategories(IReadOnlyList<string>? categories)
    {
        var normalized = (categories ?? ["orphan_document", "stale_demand", "stale_purchase_request"])
            .Where(category => !string.IsNullOrWhiteSpace(category))
            .Select(category => category.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (normalized.Count == 0)
        {
            normalized.Add("orphan_document");
            normalized.Add("stale_demand");
            normalized.Add("stale_purchase_request");
        }

        var unsupported = normalized
            .Where(category => category is not (
                "orphan_document" or
                "stale_demand" or
                "stale_purchase_request" or
                "inventory_ledger_baseline" or
                "zero_stock_unit"))
            .OrderBy(category => category)
            .ToList();
        if (unsupported.Count > 0)
        {
            throw new ArgumentException(
                $"Data-quality cleanup chỉ hỗ trợ orphan_document, stale_demand, stale_purchase_request, inventory_ledger_baseline, zero_stock_unit. Không hỗ trợ: {string.Join(", ", unsupported)}.");
        }

        return normalized;
    }

    private static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
    {
        if (sourceUnit.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return true;
        }

        return sourceUnit.ConvertRateToBase > 0 &&
               targetUnit.ConvertRateToBase > 0 &&
               string.Equals(NormalizedBaseUnitCode(sourceUnit), NormalizedBaseUnitCode(targetUnit), StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();

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
