using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public sealed class DataQualityCommandService : IDataQualityCommandService
{
    private const string DataQualityBusinessArea = "DataQuality";
    private const string DataQualityIssueEntityName = "DataQualityIssue";
    private const string DataQualityRemediationFieldName = "Remediation";
    private const string DataQualityCleanupFieldName = "Cleanup";
    private const decimal StockLedgerMatchTolerance = 0.000010m;
    private const string LegacyLedgerBaselineRefTable = "LEGACY_CURRENTSTOCK_BASELINE";

    private readonly IpcManagementContext _context;
    private readonly IStockLedgerReportService _stockLedgerReportService;
    private readonly IEfTransactionRunner _transactionRunner;

    public DataQualityCommandService(IpcManagementContext context)
        : this(context, new StockLedgerReportService(context), new EfTransactionRunner(context))
    {
    }

    public DataQualityCommandService(
        IpcManagementContext context,
        IStockLedgerReportService stockLedgerReportService,
        IEfTransactionRunner transactionRunner)
    {
        _context = context;
        _stockLedgerReportService = stockLedgerReportService;
        _transactionRunner = transactionRunner;
    }

    public async Task<DataQualityIssueRemediationDto> UpdateDataQualityIssueRemediationAsync(
        DataQualityIssueRemediationRequest request,
        string actorUserId)
    {
        var issueId = request.IssueId.Trim();
        if (string.IsNullOrWhiteSpace(issueId))
        {
            throw new ArgumentException("Thiếu mã data-quality issue.");
        }

        var normalizedStatus = DataQualityPolicy.NormalizeRemediationAction(request.Action);
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
        var limit = DataQualityPolicy.NormalizeLimit(request.Limit);
        var categories = DataQualityPolicy.NormalizeCleanupCategories(request.Categories);
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

        return await _transactionRunner.ExecuteAsync(
            async _ =>
            {
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
                         !DataQualityPolicy.CanConvertUnits(stock.Unit, stock.Ingredient.Unit))
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
                .Where(issue =>
                    issue.MaterialRequestId != null && issue.ReconciliationBatchId == null &&
                    !_context.Materialrequests.Any(request => request.RequestId == issue.MaterialRequestId))
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
                    GuidHelper.ToGuidString(issue.MaterialRequestId!));

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
                }

                result.TotalActions = actions.Count;
                result.Actions = actions;
                return result;
            },
            async cancellationToken =>
            {
                if (request.DryRun || result.TotalActions == 0)
                {
                    return true;
                }

                var persistedAuditCount = await _context.Auditlogs
                    .AsNoTracking()
                    .CountAsync(
                        audit =>
                            audit.BusinessArea == DataQualityBusinessArea &&
                            audit.FieldName == DataQualityCleanupFieldName &&
                            audit.ChangedBy == actorId &&
                            audit.ChangedAt == now,
                        cancellationToken);
                return persistedAuditCount >= result.AuditLogCount;
            });
    }

}
