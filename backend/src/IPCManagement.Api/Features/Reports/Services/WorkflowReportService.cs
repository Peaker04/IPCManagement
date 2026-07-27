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
    private const string PublishedBomStatus = "PUBLISHED";
    private static readonly decimal[] SupportedBomPriceTiers = [25000m, 30000m, 34000m];

    public WorkflowReportService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<CurrentStockSummaryDto>> GetCurrentStockAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");

        var stocks = _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();

        if (warehouseId is not null)
        {
            stocks = stocks.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            stocks = stocks.Where(item => item.IngredientId == ingredientId);
        }

        return await stocks
            .OrderBy(item => item.Warehouse.WarehouseName)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Take(NormalizeAggregateLimit(query.Limit))
            .Select(item => new CurrentStockSummaryDto
            {
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                CurrentQty = item.CurrentQty,
                LastUpdated = item.LastUpdated
            })
            .ToListAsync();
    }

    public async Task<PagedResponseDto<CurrentStockSummaryDto>> GetCurrentStockPageAsync(CurrentStockPageQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");

        var stocks = _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();

        if (warehouseId is not null)
        {
            stocks = stocks.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            stocks = stocks.Where(item => item.IngredientId == ingredientId);
        }

        var projectedStocks = stocks.Select(item => new CurrentStockSummaryDto
        {
            WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
            WarehouseName = item.Warehouse.WarehouseName,
            IngredientId = GuidHelper.ToGuidString(item.IngredientId),
            IngredientName = item.Ingredient.IngredientName,
            UnitId = GuidHelper.ToGuidString(item.UnitId),
            UnitName = item.Unit.UnitName,
            CurrentQty = item.CurrentQty,
            LastUpdated = item.LastUpdated
        });

        var totalCount = await projectedStocks.CountAsync();
        var pageNumber = query.PageNumber;
        var pageSize = query.PageSize;
        var orderedStocks = stocks
            .OrderBy(item => item.Warehouse.WarehouseName)
            .ThenBy(item => item.Ingredient.IngredientName)
            .ThenBy(item => item.Unit.UnitName);
        var items = await orderedStocks
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(item => new CurrentStockSummaryDto
            {
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                CurrentQty = item.CurrentQty,
                LastUpdated = item.LastUpdated
            })
            .ToListAsync();

        return PagedResponseDto<CurrentStockSummaryDto>.Create(items, totalCount, pageNumber, pageSize);
    }

    public async Task<IReadOnlyList<StockMovementViewDto>> GetStockMovementsAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var (dateFrom, dateToExclusive) = ResolveStockMovementWindow(query);
        var ascending = IsAscending(query);
        var cursorSkip = query.CursorOffset ?? 0;
        var cursorDate = ResolveCursorBoundary(ParseCursorDateTime(query.CursorDate), query.CursorOffset, ascending);

        var movements = _context.Stockmovements
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();

        if (warehouseId is not null)
        {
            movements = movements.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            movements = movements.Where(item => item.IngredientId == ingredientId);
        }

        if (!string.IsNullOrWhiteSpace(query.MovementType))
        {
            var movementType = query.MovementType.Trim().ToUpperInvariant();
            movements = movements.Where(item => item.MovementType.ToUpper() == movementType);
        }

        movements = movements.Where(item =>
            item.MovementDate >= dateFrom &&
            item.MovementDate < dateToExclusive);

        if (cursorDate is not null)
        {
            movements = ascending
                ? movements.Where(item => item.MovementDate > cursorDate)
                : movements.Where(item => item.MovementDate < cursorDate);
        }

        var orderedMovements = ascending
            ? movements.OrderBy(item => item.MovementDate).ThenBy(item => item.MovementId)
            : movements.OrderByDescending(item => item.MovementDate).ThenByDescending(item => item.MovementId);

        return await orderedMovements
            .Skip(cursorDate is null ? 0 : cursorSkip)
            .Take(NormalizeLimit(query.Limit))
            .Select(item => new StockMovementViewDto
            {
                MovementId = GuidHelper.ToGuidString(item.MovementId),
                MovementDate = item.MovementDate,
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                MovementType = item.MovementType,
                QuantityIn = item.QuantityIn,
                QuantityOut = item.QuantityOut,
                BeforeQty = item.BeforeQty,
                AfterQty = item.AfterQty,
                RefTable = item.RefTable,
                RefId = item.RefId == null ? null : GuidHelper.ToGuidString(item.RefId),
                Reason = item.Reason,
                Note = item.Note
            })
            .ToListAsync();
    }

    public async Task<CursorPageDto<StockMovementViewDto>> GetStockMovementPageAsync(WorkflowReportQueryDto query)
    {
        var limit = NormalizePageLimit(query.Limit);
        var rows = await GetStockMovementsAsync(CloneQuery(query, limit + 1));
        return BuildCursorPage(rows, limit, row => row.MovementDate, row => row.MovementId, query);
    }

    public async Task<IReadOnlyList<StockLedgerReconciliationDto>> GetStockLedgerReconciliationAsync(WorkflowReportQueryDto query)
    {
        var limit = NormalizeLimit(query.Limit);
        var rows = await LoadStockLedgerRowsAsync(query);
        return rows
            .OrderBy(item => item.IsMatched)
            .ThenBy(item => item.WarehouseName)
            .ThenBy(item => item.IngredientName)
            .Take(limit)
            .Select(item => new StockLedgerReconciliationDto
            {
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.UnitName,
                CurrentQty = item.CurrentQty,
                LedgerQty = item.LedgerQty,
                DifferenceQty = item.DifferenceQty,
                IsMatched = item.IsMatched,
                LastMovementAt = item.LastMovementAt
            })
            .ToList();
    }

    private async Task<IReadOnlyList<StockLedgerSourceRow>> LoadStockLedgerRowsAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var stocksQuery = _context.Currentstocks
            .AsNoTracking()
            .TagWith("WorkflowReport.StockLedger.CurrentStock")
            .AsQueryable();
        var movementsQuery = _context.Stockmovements
            .AsNoTracking()
            .TagWith("WorkflowReport.StockLedger.Movements")
            .AsQueryable();

        if (warehouseId is not null)
        {
            stocksQuery = stocksQuery.Where(item => item.WarehouseId == warehouseId);
            movementsQuery = movementsQuery.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            stocksQuery = stocksQuery.Where(item => item.IngredientId == ingredientId);
            movementsQuery = movementsQuery.Where(item => item.IngredientId == ingredientId);
        }

        var stocks = await stocksQuery
            .Select(item => new StockLedgerCurrentProjection
            {
                WarehouseId = item.WarehouseId,
                WarehouseCode = item.Warehouse.WarehouseCode,
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = item.IngredientId,
                IngredientCode = item.Ingredient.IngredientCode,
                IngredientName = item.Ingredient.IngredientName,
                UnitId = item.UnitId,
                UnitName = item.Unit.UnitName,
                CurrentQty = item.CurrentQty,
                LastUpdated = item.LastUpdated
            })
            .ToListAsync();
        var movementAggregates = await movementsQuery
            .GroupBy(item => new { item.WarehouseId, item.IngredientId })
            .Select(group => new StockLedgerMovementAggregateProjection
            {
                WarehouseId = group.Key.WarehouseId,
                IngredientId = group.Key.IngredientId,
                LedgerQty = group.Sum(item => item.QuantityIn - item.QuantityOut),
                LastMovementAt = group.Max(item => item.MovementDate),
                LegacyBaselineCount = group.Sum(item => item.RefTable == LegacyLedgerBaselineRefTable ? 1 : 0)
            })
            .ToListAsync();
        var latestDatesQuery = movementsQuery
            .GroupBy(item => new { item.WarehouseId, item.IngredientId })
            .Select(group => new
            {
                group.Key.WarehouseId,
                group.Key.IngredientId,
                MovementDate = group.Max(item => item.MovementDate)
            });
        var latestCandidates = await (
                from movement in movementsQuery
                join latestDate in latestDatesQuery
                    on new { movement.WarehouseId, movement.IngredientId, movement.MovementDate }
                    equals new { latestDate.WarehouseId, latestDate.IngredientId, latestDate.MovementDate }
                select new StockLedgerLatestMovementProjection
                {
                    MovementId = movement.MovementId,
                    WarehouseId = movement.WarehouseId,
                    WarehouseCode = movement.Warehouse.WarehouseCode,
                    WarehouseName = movement.Warehouse.WarehouseName,
                    IngredientId = movement.IngredientId,
                    IngredientCode = movement.Ingredient.IngredientCode,
                    IngredientName = movement.Ingredient.IngredientName,
                    UnitId = movement.UnitId,
                    UnitName = movement.Unit.UnitName
                })
            .ToListAsync();
        var latestMovements = latestCandidates
            .GroupBy(item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId), StringComparer.Ordinal)
            .Select(group => group
                .OrderByDescending(item => Convert.ToHexString(item.MovementId), StringComparer.Ordinal)
                .First())
            .ToList();

        var stocksByKey = stocks.ToDictionary(
            item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId),
            StringComparer.Ordinal);
        var aggregatesByKey = movementAggregates.ToDictionary(
            item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId),
            StringComparer.Ordinal);
        var latestByKey = latestMovements.ToDictionary(
            item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId),
            StringComparer.Ordinal);
        var keys = stocksByKey.Keys
            .Concat(aggregatesByKey.Keys)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        return keys.Select(key =>
        {
            stocksByKey.TryGetValue(key, out var stock);
            aggregatesByKey.TryGetValue(key, out var aggregate);
            latestByKey.TryGetValue(key, out var latest);
            var currentQty = DecimalPolicy.RoundQuantity(stock?.CurrentQty ?? 0m);
            var ledgerQty = DecimalPolicy.RoundQuantity(aggregate?.LedgerQty ?? 0m);
            var difference = DecimalPolicy.RoundQuantity(currentQty - ledgerQty);

            return new StockLedgerSourceRow
            {
                WarehouseId = stock?.WarehouseId ?? latest!.WarehouseId,
                WarehouseCode = stock?.WarehouseCode ?? latest?.WarehouseCode,
                WarehouseName = stock?.WarehouseName ?? latest?.WarehouseName,
                IngredientId = stock?.IngredientId ?? latest!.IngredientId,
                IngredientCode = stock?.IngredientCode ?? latest?.IngredientCode,
                IngredientName = stock?.IngredientName ?? latest?.IngredientName,
                UnitId = stock?.UnitId ?? latest!.UnitId,
                UnitName = stock?.UnitName ?? latest?.UnitName,
                CurrentQty = currentQty,
                LedgerQty = ledgerQty,
                DifferenceQty = difference,
                IsMatched = Math.Abs(difference) <= StockLedgerMatchTolerance,
                LastMovementAt = aggregate?.LastMovementAt,
                CurrentLastUpdated = stock?.LastUpdated,
                HasCurrentStock = stock is not null,
                HasLegacyBaseline = aggregate?.LegacyBaselineCount > 0
            };
        }).ToList();
    }

    public async Task<IReadOnlyList<AuditChangeReportDto>> GetAuditChangesAsync(WorkflowReportQueryDto query)
    {
        var dateFrom = ParseDateTimeStart(query.DateFrom);
        var dateToExclusive = ParseDateTimeEndExclusive(query.DateTo);
        var limit = NormalizeLimit(query.Limit);
        var ascending = IsAscending(query);
        var cursorSkip = query.CursorOffset ?? 0;
        var cursorDate = ResolveCursorBoundary(ParseCursorDateTime(query.CursorDate), query.CursorOffset, ascending);
        // Nguồn nào cũng phải lấy dư đúng bằng số dòng sẽ bị bỏ qua: sau khi trộn 8 nguồn, `cursorSkip`
        // dòng đầu tiên là phần đã trả ở trang trước, nên nếu chỉ lấy `limit` thì trang này bị hụt.
        var sourceLimit = limit + cursorSkip;

        var changes = _context.Auditlogs
            .AsNoTracking()
            .Include(item => item.ChangedByNavigation)
            .AsQueryable();

        if (dateFrom is not null)
        {
            changes = changes.Where(item => item.ChangedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            changes = changes.Where(item => item.ChangedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            changes = ascending
                ? changes.Where(item => item.ChangedAt > cursorDate)
                : changes.Where(item => item.ChangedAt < cursorDate);
        }

        if (!string.IsNullOrWhiteSpace(query.Actor))
        {
            changes = changes.Where(item => item.ChangedByNavigation.FullName.Contains(query.Actor) || item.ChangedByNavigation.Username.Contains(query.Actor));
        }

        if (!string.IsNullOrWhiteSpace(query.BusinessArea))
        {
            changes = changes.Where(item => item.BusinessArea != null && item.BusinessArea.Contains(query.BusinessArea));
        }

        if (!string.IsNullOrWhiteSpace(query.EntityName))
        {
            changes = changes.Where(item => item.EntityName != null && item.EntityName.Contains(query.EntityName));
        }

        if (!string.IsNullOrWhiteSpace(query.FieldName))
        {
            changes = changes.Where(item => item.FieldName != null && item.FieldName.Contains(query.FieldName));
        }

        var orderedChanges = ascending
            ? changes.OrderBy(item => item.ChangedAt).ThenBy(item => item.AuditId)
            : changes.OrderByDescending(item => item.ChangedAt).ThenByDescending(item => item.AuditId);

        var auditRows = await orderedChanges
            .Take(sourceLimit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.AuditId),
                ChangedAt = item.ChangedAt,
                ChangedBy = GuidHelper.ToGuidString(item.ChangedBy),
                ChangedByName = item.ChangedByNavigation.FullName ?? item.ChangedByNavigation.Username ?? "System",
                BusinessArea = item.EntityName == nameof(MealQuantityPlan)
                    && item.FieldName == nameof(MealQuantityPlan.Status)
                    && item.NewValue == "COMPLETED"
                        ? "Signoff"
                        : item.BusinessArea,
                EntityName = item.EntityName,
                EntityId = item.EntityId == null ? null : GuidHelper.ToGuidString(item.EntityId),
                FieldName = item.FieldName,
                OldValue = item.OldValue,
                NewValue = item.NewValue,
                Reason = item.Reason
            })
            .ToListAsync();

        var importBatches = _context.Quantityimportbatches
            .AsNoTracking()
            .Include(item => item.ImportedByNavigation)
            .Include(item => item.Mealquantityplans)
            .AsQueryable();

        if (dateFrom is not null)
        {
            importBatches = importBatches.Where(item => item.ImportedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            importBatches = importBatches.Where(item => item.ImportedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            importBatches = ascending
                ? importBatches.Where(item => item.ImportedAt > cursorDate)
                : importBatches.Where(item => item.ImportedAt < cursorDate);
        }

        var orderedImportBatches = ascending
            ? importBatches.OrderBy(item => item.ImportedAt).ThenBy(item => item.ImportBatchId)
            : importBatches.OrderByDescending(item => item.ImportedAt).ThenByDescending(item => item.ImportBatchId);

        var importRows = await orderedImportBatches
            .Take(sourceLimit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.ImportBatchId),
                ChangedAt = item.ImportedAt,
                ChangedBy = item.ImportedBy == null ? string.Empty : GuidHelper.ToGuidString(item.ImportedBy),
                ChangedByName = item.ImportedByNavigation == null
                    ? "Sample Data Importer"
                    : item.ImportedByNavigation.FullName ?? item.ImportedByNavigation.Username ?? "Sample Data Importer",
                BusinessArea = "Import",
                EntityName = nameof(QuantityImportBatch),
                EntityId = GuidHelper.ToGuidString(item.ImportBatchId),
                FieldName = item.SourceType,
                OldValue = null,
                NewValue = $"{item.BatchCode} - {item.Status}; {item.Mealquantityplans.Count} plans",
                Reason = item.SourceCompanyName
            })
            .ToListAsync();

        var menuImports = _context.Menuversions
            .AsNoTracking()
            .AsQueryable();

        if (dateFrom is not null)
        {
            menuImports = menuImports.Where(item => item.CreatedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            menuImports = menuImports.Where(item => item.CreatedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            menuImports = ascending
                ? menuImports.Where(item => item.CreatedAt > cursorDate)
                : menuImports.Where(item => item.CreatedAt < cursorDate);
        }

        var orderedMenuImports = ascending
            ? menuImports.OrderBy(item => item.CreatedAt).ThenBy(item => item.MenuVersionId)
            : menuImports.OrderByDescending(item => item.CreatedAt).ThenByDescending(item => item.MenuVersionId);

        var menuImportVersions = await orderedMenuImports
            .Take(sourceLimit)
            .ToListAsync();
        var menuImportActorIds = menuImportVersions
            .Where(item => item.CreatedBy is not null)
            .Select(item => GuidHelper.ToGuidString(item.CreatedBy!))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var menuImportActors = (await _context.Users
                .AsNoTracking()
                .ToListAsync())
            .Where(user => menuImportActorIds.Contains(GuidHelper.ToGuidString(user.UserId), StringComparer.OrdinalIgnoreCase))
            .ToDictionary(user => GuidHelper.ToGuidString(user.UserId), user => user.FullName, StringComparer.OrdinalIgnoreCase);
        var menuImportRows = menuImportVersions
            .Select(item =>
            {
                var actorId = item.CreatedBy is null ? string.Empty : GuidHelper.ToGuidString(item.CreatedBy);
                return new AuditChangeReportDto
                {
                    AuditId = GuidHelper.ToGuidString(item.MenuVersionId),
                    ChangedAt = item.CreatedAt,
                    ChangedBy = actorId,
                    ChangedByName = !string.IsNullOrWhiteSpace(actorId) && menuImportActors.TryGetValue(actorId, out var actorName)
                        ? actorName
                        : "Sample Data Importer",
                    BusinessArea = "Import",
                    EntityName = nameof(MenuVersion),
                    EntityId = GuidHelper.ToGuidString(item.MenuVersionId),
                    FieldName = "WeeklyMenu",
                    OldValue = item.SourceFileName,
                    NewValue = $"{item.SourceImportBatch ?? $"V{item.VersionNo}"} - {item.Status}",
                    Reason = item.SourceChecksum
                };
            })
            .ToList();

        var approvals = _context.Approvalhistories
            .AsNoTracking()
            .Include(item => item.ActionByNavigation)
            .AsQueryable();

        if (dateFrom is not null)
        {
            approvals = approvals.Where(item => item.ActionAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            approvals = approvals.Where(item => item.ActionAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            approvals = ascending
                ? approvals.Where(item => item.ActionAt > cursorDate)
                : approvals.Where(item => item.ActionAt < cursorDate);
        }

        var orderedApprovals = ascending
            ? approvals.OrderBy(item => item.ActionAt).ThenBy(item => item.ApprovalHistoryId)
            : approvals.OrderByDescending(item => item.ActionAt).ThenByDescending(item => item.ApprovalHistoryId);

        var approvalRows = await orderedApprovals
            .Take(sourceLimit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.ApprovalHistoryId),
                ChangedAt = item.ActionAt,
                ChangedBy = GuidHelper.ToGuidString(item.ActionBy),
                ChangedByName = item.ActionByNavigation.FullName ?? item.ActionByNavigation.Username ?? "System",
                BusinessArea = "Approval",
                EntityName = item.TargetType,
                EntityId = GuidHelper.ToGuidString(item.TargetId),
                FieldName = item.Decision,
                OldValue = item.OldStatus,
                NewValue = item.NewStatus,
                Reason = item.Reason
            })
            .ToListAsync();

        var receipts = _context.Inventoryreceipts
            .AsNoTracking()
            .Include(item => item.CreatedByNavigation)
            .Include(item => item.Inventoryreceiptlines)
            .AsQueryable();

        if (dateFrom is not null)
        {
            receipts = receipts.Where(item => item.CreatedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            receipts = receipts.Where(item => item.CreatedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            receipts = ascending
                ? receipts.Where(item => item.CreatedAt > cursorDate)
                : receipts.Where(item => item.CreatedAt < cursorDate);
        }

        var orderedReceipts = ascending
            ? receipts.OrderBy(item => item.CreatedAt).ThenBy(item => item.ReceiptId)
            : receipts.OrderByDescending(item => item.CreatedAt).ThenByDescending(item => item.ReceiptId);

        var receiptRows = await orderedReceipts
            .Take(sourceLimit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.ReceiptId),
                ChangedAt = item.CreatedAt,
                ChangedBy = GuidHelper.ToGuidString(item.CreatedBy),
                ChangedByName = item.CreatedByNavigation.FullName ?? item.CreatedByNavigation.Username ?? "System",
                BusinessArea = "Receipt",
                EntityName = nameof(InventoryReceipt),
                EntityId = GuidHelper.ToGuidString(item.ReceiptId),
                FieldName = "Receive",
                OldValue = item.PurchaseRequestId == null ? null : GuidHelper.ToGuidString(item.PurchaseRequestId),
                NewValue = $"{item.ReceiptCode} - {item.Inventoryreceiptlines.Count} lines",
                Reason = $"Ngày nhập {item.ReceiptDate:yyyy-MM-dd}"
            })
            .ToListAsync();

        var issues = _context.Inventoryissues
            .AsNoTracking()
            .Include(item => item.IssuedByNavigation)
            .Include(item => item.Inventoryissuelines)
            .AsQueryable();

        if (dateFrom is not null)
        {
            issues = issues.Where(item => item.CreatedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            issues = issues.Where(item => item.CreatedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            issues = ascending
                ? issues.Where(item => item.CreatedAt > cursorDate)
                : issues.Where(item => item.CreatedAt < cursorDate);
        }

        var orderedIssues = ascending
            ? issues.OrderBy(item => item.CreatedAt).ThenBy(item => item.IssueId)
            : issues.OrderByDescending(item => item.CreatedAt).ThenByDescending(item => item.IssueId);

        var issueRows = await orderedIssues
            .Take(sourceLimit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.IssueId),
                ChangedAt = item.CreatedAt,
                ChangedBy = GuidHelper.ToGuidString(item.IssuedBy),
                ChangedByName = item.IssuedByNavigation.FullName ?? item.IssuedByNavigation.Username ?? "System",
                BusinessArea = "Issue",
                EntityName = nameof(InventoryIssue),
                EntityId = GuidHelper.ToGuidString(item.IssueId),
                FieldName = item.ShiftName ?? "FULLDAY",
                OldValue = GuidHelper.ToGuidString(item.MaterialRequestId),
                NewValue = $"{item.IssueCode} - {item.Inventoryissuelines.Count} lines",
                Reason = $"Ngày xuất {item.IssueDate:yyyy-MM-dd}"
            })
            .ToListAsync();

        var quantityAdjustments = _context.Quantityadjustments
            .AsNoTracking()
            .Include(item => item.AdjustedByNavigation)
            .AsQueryable();

        if (dateFrom is not null)
        {
            quantityAdjustments = quantityAdjustments.Where(item => item.AdjustedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            quantityAdjustments = quantityAdjustments.Where(item => item.AdjustedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            quantityAdjustments = ascending
                ? quantityAdjustments.Where(item => item.AdjustedAt > cursorDate)
                : quantityAdjustments.Where(item => item.AdjustedAt < cursorDate);
        }

        var orderedQuantityAdjustments = ascending
            ? quantityAdjustments.OrderBy(item => item.AdjustedAt).ThenBy(item => item.AdjustmentId)
            : quantityAdjustments.OrderByDescending(item => item.AdjustedAt).ThenByDescending(item => item.AdjustmentId);

        var quantityRows = await orderedQuantityAdjustments
            .Take(sourceLimit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.AdjustmentId),
                ChangedAt = item.AdjustedAt,
                ChangedBy = GuidHelper.ToGuidString(item.AdjustedBy),
                ChangedByName = item.AdjustedByNavigation.FullName ?? item.AdjustedByNavigation.Username ?? "System",
                BusinessArea = "Số suất",
                EntityName = "MealQuantityPlanLine",
                EntityId = GuidHelper.ToGuidString(item.QuantityPlanLineId),
                FieldName = "FinalServings",
                OldValue = item.OldServings.ToString(),
                NewValue = item.NewServings.ToString(),
                Reason = item.Reason
            })
            .ToListAsync();

        var bomAdjustments = _context.Bomadjustments
            .AsNoTracking()
            .Include(item => item.AdjustedByNavigation)
            .Include(item => item.Bom)
                .ThenInclude(bom => bom.Dish)
            .Include(item => item.Bom)
                .ThenInclude(bom => bom.Ingredient)
            .AsQueryable();

        if (dateFrom is not null)
        {
            bomAdjustments = bomAdjustments.Where(item => item.AdjustedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            bomAdjustments = bomAdjustments.Where(item => item.AdjustedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            bomAdjustments = ascending
                ? bomAdjustments.Where(item => item.AdjustedAt > cursorDate)
                : bomAdjustments.Where(item => item.AdjustedAt < cursorDate);
        }

        var orderedBomAdjustments = ascending
            ? bomAdjustments.OrderBy(item => item.AdjustedAt).ThenBy(item => item.BomAdjustmentId)
            : bomAdjustments.OrderByDescending(item => item.AdjustedAt).ThenByDescending(item => item.BomAdjustmentId);

        var bomRows = await orderedBomAdjustments
            .Take(sourceLimit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.BomAdjustmentId),
                ChangedAt = item.AdjustedAt,
                ChangedBy = GuidHelper.ToGuidString(item.AdjustedBy),
                ChangedByName = item.AdjustedByNavigation.FullName ?? item.AdjustedByNavigation.Username ?? "System",
                BusinessArea = "BOM",
                EntityName = item.Bom.Dish.DishName,
                EntityId = GuidHelper.ToGuidString(item.BomId),
                FieldName = item.Bom.Ingredient.IngredientName,
                OldValue = $"{item.OldGrossQtyPerServing} / hao hụt {item.OldWasteRatePercent}%",
                NewValue = $"{item.NewGrossQtyPerServing} / hao hụt {item.NewWasteRatePercent}%",
                Reason = item.Reason
            })
            .ToListAsync();

        var rows = auditRows
            .Concat(importRows)
            .Concat(menuImportRows)
            .Concat(approvalRows)
            .Concat(receiptRows)
            .Concat(issueRows)
            .Concat(quantityRows)
            .Concat(bomRows);

        return (ascending
                ? rows.OrderBy(item => item.ChangedAt).ThenBy(item => item.AuditId)
                : rows.OrderByDescending(item => item.ChangedAt).ThenByDescending(item => item.AuditId))
            .Skip(cursorDate is null ? 0 : cursorSkip)
            .Take(limit)
            .ToList();
    }

    public async Task<CursorPageDto<AuditChangeReportDto>> GetAuditChangePageAsync(WorkflowReportQueryDto query)
    {
        var limit = NormalizePageLimit(query.Limit);
        var rows = await GetAuditChangesAsync(CloneQuery(query, limit + 1));
        return BuildCursorPage(rows, limit, row => row.ChangedAt, row => row.AuditId, query);
    }

    public async Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query)
    {
        var requestedLimit = NormalizeLimit(query.Limit);
        var limit = requestedLimit + 1;
        var serviceDate = ParseDateOnly(query.ServiceDate) ?? ParseDateOnly(query.DateFrom) ?? ServiceCalendar.Today();
        var issues = new List<DataQualityIssueDto>();
        var operationalDishKeys = (await _context.Productionplanlines
                .AsNoTracking()
                .Where(line =>
                    line.Plan.PlanDate >= serviceDate &&
                    (line.Plan.Status == "CREATED" || line.Plan.Status == "SENTTOKITCHEN"))
                .Select(line => line.DishId)
                .Distinct()
                .ToListAsync())
            .Select(Convert.ToBase64String)
            .ToHashSet(StringComparer.Ordinal);

        var missingBomDishes = await _context.Dishes
            .AsNoTracking()
            .Where(dish => (dish.IsActive ?? true) && !_context.Dishboms.Any(bom =>
                bom.DishId == dish.DishId &&
                SupportedBomPriceTiers.Contains(bom.PriceTierAmount) &&
                bom.BomStatus == PublishedBomStatus &&
                bom.EffectiveFrom <= serviceDate &&
                (bom.EffectiveTo == null || bom.EffectiveTo >= serviceDate)))
            .OrderBy(dish => dish.DishCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(missingBomDishes.Select(dish =>
        {
            var isOperational = operationalDishKeys.Contains(Convert.ToBase64String(dish.DishId));
            return BuildDataQualityIssue(
            isOperational ? "missing_bom" : "legacy_missing_bom",
            isOperational ? "error" : "warning",
            nameof(Dish),
            GuidHelper.ToGuidString(dish.DishId),
            dish.DishCode,
            dish.DishName,
            isOperational
                ? "Món đang được dùng trong KHSX hiện tại/tương lai nhưng chưa có BOM hiệu lực."
                : "Món catalog cũ chưa có BOM hiệu lực và không được KHSX hiện tại/tương lai tham chiếu.",
            isOperational
                ? "Import BOM đúng tier trước khi tiếp tục KHSX."
                : "Bổ sung BOM trước khi dùng lại món; không chặn luồng hiện tại.",
            BuildMissingBomRemediationRoute(dish.DishId, serviceDate, query));
        }));

        var invalidUnitIngredients = await _context.Ingredients
            .AsNoTracking()
            .Include(item => item.Unit)
            .Where(item => (item.IsActive ?? true) && (
                item.Unit.UnitCode == "" ||
                item.Unit.UnitName == "" ||
                item.Unit.ConvertRateToBase <= 0))
            .OrderBy(item => item.IngredientCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(invalidUnitIngredients.Select(ingredient => BuildDataQualityIssue(
            "invalid_unit",
            "error",
            nameof(Ingredient),
            GuidHelper.ToGuidString(ingredient.IngredientId),
            ingredient.IngredientCode,
            ingredient.IngredientName,
            $"Nguyên liệu dùng đơn vị '{ingredient.Unit.UnitCode}' nhưng mã/tên/hệ số quy đổi không hợp lệ.",
            "Chuẩn hóa đơn vị hoặc cập nhật nguyên liệu trước khi tính BOM/kho.",
            "/admin-data")));

        var activeBomLines = await _context.Dishboms
            .AsNoTracking()
            .Include(item => item.Dish)
            .Include(item => item.Ingredient)
                .ThenInclude(ingredient => ingredient.Unit)
            .Include(item => item.Unit)
            .Where(item =>
                SupportedBomPriceTiers.Contains(item.PriceTierAmount) &&
                item.BomStatus == PublishedBomStatus &&
                item.EffectiveFrom <= serviceDate &&
                (item.EffectiveTo == null || item.EffectiveTo >= serviceDate))
            .OrderBy(item => item.Dish.DishCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(activeBomLines
            .Where(line => !CanConvertUnits(line.Unit, line.Ingredient.Unit))
            .Select(line => BuildDataQualityIssue(
                "missing_conversion",
                "error",
                nameof(DishBom),
                GuidHelper.ToGuidString(line.BomId),
                line.Dish.DishCode,
                line.Ingredient.IngredientName,
                $"BOM dùng đơn vị '{line.Unit.UnitName}' nhưng nguyên liệu đang theo '{line.Ingredient.Unit.UnitName}' và chưa có cấu hình quy đổi hợp lệ.",
                "Cập nhật base unit / hệ số quy đổi của đơn vị trước khi tính demand hoặc sinh mua thêm.",
                "/admin-data")));

        var legacyBomLines = await _context.Dishboms
            .AsNoTracking()
            .Include(item => item.Dish)
            .Include(item => item.Ingredient)
            .Where(item =>
                !SupportedBomPriceTiers.Contains(item.PriceTierAmount) &&
                item.BomStatus == PublishedBomStatus &&
                item.EffectiveFrom <= serviceDate &&
                (item.EffectiveTo == null || item.EffectiveTo >= serviceDate))
            .OrderBy(item => item.Dish.DishCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(legacyBomLines.Select(line => BuildDataQualityIssue(
            "legacy_bom_tier",
            "error",
            nameof(DishBom),
            GuidHelper.ToGuidString(line.BomId),
            line.Dish.DishCode,
            line.Ingredient.IngredientName,
            $"Dòng BOM đang dùng đơn giá cũ/lệch {line.PriceTierAmount:0.##}. Chỉ chấp nhận tier 25000, 30000 hoặc 34000.",
            "Tải mẫu BOM thiếu/theo món rồi import lại bằng Excel để tạo BOM theo tier mới.",
            BuildMissingBomRemediationRoute(line.DishId, serviceDate, query))));

        var stockUnitLines = await _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
                .ThenInclude(ingredient => ingredient.Unit)
            .Include(item => item.Unit)
            .OrderBy(item => item.Warehouse.WarehouseCode)
            .ThenBy(item => item.Ingredient.IngredientCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(stockUnitLines
            .Where(stock => !CanConvertUnits(stock.Unit, stock.Ingredient.Unit))
            .Select(stock => BuildDataQualityIssue(
                "missing_conversion",
                "error",
                nameof(CurrentStock),
                $"{GuidHelper.ToGuidString(stock.WarehouseId)}:{GuidHelper.ToGuidString(stock.IngredientId)}",
                stock.Warehouse.WarehouseCode,
                stock.Ingredient.IngredientName,
                $"Tồn kho đang dùng đơn vị '{stock.Unit.UnitName}' nhưng nguyên liệu đang theo '{stock.Ingredient.Unit.UnitName}' và chưa có cấu hình quy đổi hợp lệ.",
                "Cập nhật quy đổi unit hoặc chuẩn hóa đơn vị tồn kho trước khi generate demand.",
                "/admin-data")));

        var receiptUnitLines = await _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
            .Include(item => item.Ingredient)
                .ThenInclude(ingredient => ingredient.Unit)
            .Include(item => item.Unit)
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(receiptUnitLines
            .Where(line => !CanConvertUnits(line.Unit, line.Ingredient.Unit))
            .Select(line => BuildDataQualityIssue(
                line.Receipt.ReceiptDate < serviceDate ? "legacy_missing_conversion" : "missing_conversion",
                "warning",
                nameof(InventoryReceiptLine),
                GuidHelper.ToGuidString(line.ReceiptLineId),
                line.Receipt.ReceiptCode,
                line.Ingredient.IngredientName,
                $"Lịch sử nhập hàng dùng đơn vị '{line.Unit.UnitName}' nhưng nguyên liệu đang theo '{line.Ingredient.Unit.UnitName}' và chưa có cấu hình quy đổi hợp lệ.",
                "Bổ sung quy đổi unit để giá mua tham chiếu không lệch khi sinh purchase request.",
                "/reports")));

        var inactiveBomIngredients = await _context.Dishboms
            .AsNoTracking()
            .Include(item => item.Dish)
            .Include(item => item.Ingredient)
            .Where(item =>
                SupportedBomPriceTiers.Contains(item.PriceTierAmount) &&
                item.BomStatus == PublishedBomStatus &&
                item.EffectiveFrom <= serviceDate &&
                (item.EffectiveTo == null || item.EffectiveTo >= serviceDate) &&
                item.Ingredient.IsActive == false)
            .OrderBy(item => item.Dish.DishCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(inactiveBomIngredients.Select(line => BuildDataQualityIssue(
            "inactive_bom_ingredient",
            "warning",
            nameof(DishBom),
            GuidHelper.ToGuidString(line.BomId),
            line.Dish.DishCode,
            line.Dish.DishName,
            $"BOM đang dùng nguyên liệu đã khóa: {line.Ingredient.IngredientName}.",
            "Đổi nguyên liệu trong BOM hoặc mở lại nguyên liệu nếu vẫn dùng.",
            "/admin-data")));

        var negativeStocks = await _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .Where(item => item.CurrentQty < 0)
            .OrderBy(item => item.Warehouse.WarehouseCode)
            .ThenBy(item => item.Ingredient.IngredientCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(negativeStocks.Select(stock => BuildDataQualityIssue(
            "negative_stock",
            "error",
            nameof(CurrentStock),
            $"{GuidHelper.ToGuidString(stock.WarehouseId)}:{GuidHelper.ToGuidString(stock.IngredientId)}",
            stock.Warehouse.WarehouseCode,
            stock.Ingredient.IngredientName,
            $"Tồn kho âm {DecimalPolicy.RoundQuantity(stock.CurrentQty)} {stock.Unit.UnitName}.",
            "Kiểm tra phiếu xuất/nhập hoặc tạo điều chỉnh tồn.",
            "/admin-data")));

        var ledgerMismatches = (await GetStockLedgerReconciliationAsync(new WorkflowReportQueryDto
        {
            WarehouseId = query.WarehouseId,
            IngredientId = query.IngredientId,
            Limit = limit
        }))
            .Where(item => !item.IsMatched)
            .ToList();

        issues.AddRange(ledgerMismatches.Select(item => BuildDataQualityIssue(
            "inventory_ledger_mismatch",
            "error",
            nameof(CurrentStock),
            $"{item.WarehouseId}:{item.IngredientId}",
            item.WarehouseName ?? item.WarehouseId,
            item.IngredientName ?? item.IngredientId,
            $"Current stock {item.CurrentQty} {item.UnitName} không khớp ledger {item.LedgerQty} {item.UnitName}. Lệch {item.DifferenceQty} {item.UnitName}.",
            "Đối chiếu stock movements và tạo điều chỉnh tồn qua ledger, không sửa trực tiếp current stock.",
            "/reports")));

        var stockShortageAudits = await _context.Auditlogs
            .AsNoTracking()
            .Where(log => log.BusinessArea == "StockException" && log.FieldName == "StockShortage")
            .OrderByDescending(log => log.ChangedAt)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(stockShortageAudits.Select(log => BuildDataQualityIssue(
            "stock_shortage",
            "error",
            log.EntityName,
            log.EntityId == null ? null : GuidHelper.ToGuidString(log.EntityId),
            log.ChangedAt.ToString("yyyy-MM-dd HH:mm"),
            log.NewValue ?? "Thiếu tồn kho",
            log.Reason ?? "Không đủ tồn kho để xuất nguyên liệu.",
            "Nhập kho bổ sung, giảm số lượng xuất hoặc tạo đề xuất mua thêm trước khi xuất kho.",
            "/warehouse")));

        var missingContractPlans = await _context.Productionplans
            .AsNoTracking()
            .Include(plan => plan.Customer)
            .Where(plan =>
                plan.PlanDate >= serviceDate &&
                (plan.Status == "CREATED" || plan.Status == "SENTTOKITCHEN") &&
                plan.CustomerId != null &&
                !_context.Customercontracts.Any(contract =>
                    contract.CustomerId == plan.CustomerId &&
                    contract.Status == "ACTIVE" &&
                    contract.EffectiveFrom <= plan.PlanDate &&
                    (contract.EffectiveTo == null || contract.EffectiveTo >= plan.PlanDate)))
            .OrderBy(plan => plan.PlanCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(missingContractPlans.Select(plan => BuildDataQualityIssue(
            "missing_contract",
            "error",
            nameof(ProductionPlan),
            GuidHelper.ToGuidString(plan.PlanId),
            plan.PlanCode,
            plan.Customer?.CustomerName ?? GuidHelper.ToGuidString(plan.CustomerId!),
            "KHSX có khách hàng nhưng không có contract hiệu lực cho ngày phục vụ.",
            "Tạo hoặc publish contract khách hàng trước khi chốt giá/BOM.",
            "/admin-data?view=contracts")));

        var inactiveSupplierLines = await _context.Purchaserequestlines
            .AsNoTracking()
            .Include(line => line.PurchaseRequest)
            .Include(line => line.Supplier)
            .Include(line => line.Ingredient)
            .Where(line => line.SupplierId != null && line.Supplier != null && line.Supplier.IsActive == false)
            .OrderBy(line => line.PurchaseRequest.PurchaseRequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(inactiveSupplierLines.Select(line => BuildDataQualityIssue(
            "missing_supplier",
            "error",
            nameof(PurchaseRequestLine),
            GuidHelper.ToGuidString(line.PurchaseRequestLineId),
            line.PurchaseRequest.PurchaseRequestCode,
            $"{line.Ingredient.IngredientName} / {line.Supplier!.SupplierName}",
            "Dòng mua thêm đang gán nhà cung cấp đã khóa hoặc không còn dùng được.",
            "Chọn lại nhà cung cấp active hoặc bổ sung báo giá trước khi gửi mua.",
            "/purchasing")));

        var staleDemands = await _context.Materialrequests
            .AsNoTracking()
            .Where(request => request.Status == "CANCELLED")
            .OrderBy(request => request.RequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(staleDemands.Select(request => BuildDataQualityIssue(
            "stale_demand",
            "warning",
            nameof(MaterialRequest),
            GuidHelper.ToGuidString(request.RequestId),
            request.RequestCode,
            request.RequestDate.ToString("yyyy-MM-dd"),
            "Demand đã bị hủy do menu/KHSX thay đổi và cần sinh lại trước khi mua/xuất kho.",
            "Chạy lại generate demand từ KHSX hiện tại.",
            "/weekly-menu")));

        var stalePurchaseRequests = await _context.Purchaserequests
            .AsNoTracking()
            .Where(request => request.Status == "CANCELLED")
            .OrderBy(request => request.PurchaseRequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(stalePurchaseRequests.Select(request => BuildDataQualityIssue(
            "stale_purchase_request",
            "warning",
            nameof(PurchaseRequest),
            GuidHelper.ToGuidString(request.PurchaseRequestId),
            request.PurchaseRequestCode,
            request.PurchaseForDate.ToString("yyyy-MM-dd"),
            "Đề xuất mua đã bị hủy do demand/menu thay đổi và không còn là nguồn mua hợp lệ.",
            "Sinh lại purchase request từ demand hiện tại.",
            "/purchasing")));

        var kitchenReceiptDiscrepancies = await _context.Auditlogs
            .AsNoTracking()
            .Where(log => log.BusinessArea == "KitchenReceipt" && log.FieldName == "KitchenReceiptDiscrepancy")
            .OrderByDescending(log => log.ChangedAt)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(kitchenReceiptDiscrepancies.Select(log => BuildDataQualityIssue(
            "kitchen_receipt_discrepancy",
            "warning",
            log.EntityName,
            log.EntityId == null ? null : GuidHelper.ToGuidString(log.EntityId),
            log.ChangedAt.ToString("yyyy-MM-dd HH:mm"),
            log.NewValue ?? "Bếp báo chênh lệch khi nhận nguyên liệu",
            log.Reason ?? "Bếp báo nguyên liệu nhận thực tế khác phiếu xuất.",
            "Đối chiếu phiếu xuất với bếp và tạo phiếu điều chỉnh/hoàn kho nếu cần.",
            "/chef")));

        var orphanMaterialRequests = await _context.Materialrequests
            .AsNoTracking()
            .Where(request => !_context.Productionplans.Any(plan => plan.PlanId == request.PlanId))
            .OrderBy(request => request.RequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(orphanMaterialRequests.Select(request => BuildDataQualityIssue(
            "orphan_document",
            "warning",
            nameof(MaterialRequest),
            GuidHelper.ToGuidString(request.RequestId),
            request.RequestCode,
            request.Status,
            "Yêu cầu nguyên liệu không còn KHSX gốc.",
            "Sinh lại demand từ KHSX hoặc kiểm tra dữ liệu import.",
            "/weekly-menu")));

        var orphanPurchaseLines = await _context.Purchaserequestlines
            .AsNoTracking()
            .Include(line => line.PurchaseRequest)
            .Include(line => line.Ingredient)
            .Where(line => !_context.Materialrequestlines.Any(materialLine => materialLine.RequestLineId == line.MaterialRequestLineId))
            .OrderBy(line => line.PurchaseRequest.PurchaseRequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(orphanPurchaseLines.Select(line => BuildDataQualityIssue(
            "orphan_document",
            "warning",
            nameof(PurchaseRequestLine),
            GuidHelper.ToGuidString(line.PurchaseRequestLineId),
            line.PurchaseRequest.PurchaseRequestCode,
            line.Ingredient.IngredientName,
            "Dòng mua thêm không còn dòng demand gốc.",
            "Sinh lại danh sách mua thêm từ demand hiện tại.",
            "/weekly-menu")));

        var orphanIssues = await _context.Inventoryissues
            .AsNoTracking()
            .Where(issue => !_context.Materialrequests.Any(request => request.RequestId == issue.MaterialRequestId))
            .OrderBy(issue => issue.IssueCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(orphanIssues.Select(issue => BuildDataQualityIssue(
            "orphan_document",
            "warning",
            nameof(InventoryIssue),
            GuidHelper.ToGuidString(issue.IssueId),
            issue.IssueCode,
            issue.IssueDate.ToString("yyyy-MM-dd"),
            "Phiếu xuất không còn demand/material request gốc.",
            "Kiểm tra lại workflow kho và demand đã sinh.",
            "/warehouse")));

        var unitNormalizationReviews = await _context.Unitnormalizationreviews
            .AsNoTracking()
            .Include(review => review.Ingredient)
            .Include(review => review.SourceUnit)
            .Include(review => review.CatalogUnit)
            .Include(review => review.RecommendedUnit)
            .Where(review => review.Status == "NEEDS_CONFIRMATION")
            .OrderBy(review => review.Ingredient.IngredientCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(unitNormalizationReviews.Select(review =>
        {
            var factor = review.ProposedSourceToCatalogFactor is null
                ? "chưa đủ bằng chứng để đề xuất hệ số"
                : $"hệ số đề xuất {review.ProposedSourceToCatalogFactor:0.######} " +
                  $"{review.CatalogUnit.UnitCode}/{review.SourceUnit.UnitCode}";
            var recommendedUnit = review.RecommendedUnit?.UnitCode ?? review.CatalogUnit.UnitCode;
            return BuildDataQualityIssue(
                "unit_normalization_review",
                "warning",
                nameof(UnitNormalizationReview),
                GuidHelper.ToGuidString(review.ReviewId),
                review.Ingredient.IngredientCode,
                $"{review.SourceUnit.UnitCode} → {recommendedUnit}",
                $"Cần duyệt quy cách theo từng nguyên liệu: {factor}. " +
                $"Confidence={review.Confidence}. Evidence: {review.EvidenceNote}",
                "Kiểm tra nhãn quy cách/nhà cung cấp và chỉ approve khi hệ số source-to-catalog được xác nhận; review này chưa được engine sử dụng.",
                "/admin-data?view=cleanup");
        }));

        var distinctIssues = issues
            .DistinctBy(issue => issue.IssueId, StringComparer.OrdinalIgnoreCase)
            .OrderBy(issue => issue.PriorityRank)
            .ThenBy(issue => issue.Severity == "error" ? 0 : 1)
            .ThenBy(issue => issue.Category)
            .ThenBy(issue => issue.EntityCode)
            .ToList();
        var isTruncated = distinctIssues.Count > requestedLimit;
        var sortedIssues = distinctIssues.Take(requestedLimit).ToList();

        await ApplyDataQualityRemediationStateAsync(sortedIssues);

        return new DataQualityReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            TotalIssues = sortedIssues.Count,
            IsTruncated = isTruncated,
            ErrorCount = sortedIssues.Count(issue => issue.Severity == "error" && issue.RemediationStatus != "resolved"),
            WarningCount = sortedIssues.Count(issue => issue.Severity == "warning" && issue.RemediationStatus != "resolved"),
            ResolvedIssueCount = sortedIssues.Count(issue => issue.RemediationStatus == "resolved"),
            ReopenedIssueCount = sortedIssues.Count(issue => issue.RemediationStatus == "reopened"),
            UrgentIssueCount = sortedIssues.Count(issue => issue.PriorityRank <= 2 && issue.RemediationStatus != "resolved"),
            MissingBomCount = sortedIssues.Count(issue => issue.Category == "missing_bom"),
            InvalidUnitCount = sortedIssues.Count(issue => issue.Category is "invalid_unit" or "inactive_bom_ingredient"),
            MissingConversionCount = sortedIssues.Count(issue => issue.Category == "missing_conversion"),
            NegativeStockCount = sortedIssues.Count(issue => issue.Category == "negative_stock"),
            OrphanDocumentCount = sortedIssues.Count(issue => issue.Category == "orphan_document"),
            Issues = sortedIssues
        };
    }

    public async Task<DataQualityPageDto> GetDataQualityPageAsync(DataQualityPageQueryDto query)
    {
        var sourceQuery = CloneQuery(query, 500);
        var report = await GetDataQualityAsync(sourceQuery);
        var pageItems = report.Issues
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        return new DataQualityPageDto
        {
            GeneratedAt = report.GeneratedAt,
            TotalIssues = report.TotalIssues,
            IsTruncated = report.IsTruncated,
            ErrorCount = report.ErrorCount,
            WarningCount = report.WarningCount,
            ResolvedIssueCount = report.ResolvedIssueCount,
            ReopenedIssueCount = report.ReopenedIssueCount,
            UrgentIssueCount = report.UrgentIssueCount,
            MissingBomCount = report.MissingBomCount,
            InvalidUnitCount = report.InvalidUnitCount,
            MissingConversionCount = report.MissingConversionCount,
            NegativeStockCount = report.NegativeStockCount,
            OrphanDocumentCount = report.OrphanDocumentCount,
            Issues = pageItems,
            Page = PagedResponseDto<DataQualityIssueDto>.Create(
                pageItems,
                report.TotalIssues,
                query.PageNumber,
                query.PageSize)
        };
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
            var ledgerRows = await LoadStockLedgerRowsAsync(new WorkflowReportQueryDto());
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

    private static DataQualityIssueDto BuildDataQualityIssue(
        string category,
        string severity,
        string entityName,
        string? entityId,
        string entityCode,
        string entityLabel,
        string message,
        string suggestedAction,
        string route)
    {
        var priorityRank = ResolveDataQualityPriorityRank(category, severity);
        var slaHours = ResolveDataQualitySlaHours(category, severity);

        return new DataQualityIssueDto
        {
            IssueId = $"{category}:{entityName}:{entityId ?? entityCode}",
            Category = category,
            Severity = severity,
            Owner = ResolveDataQualityOwner(category, route),
            PriorityRank = priorityRank,
            SlaHours = slaHours,
            SlaDueAt = DateTime.UtcNow.AddHours(slaHours),
            SlaLabel = FormatDataQualitySlaLabel(priorityRank, slaHours),
            EntityName = entityName,
            EntityId = entityId,
            EntityCode = entityCode,
            EntityLabel = entityLabel,
            Message = message,
            SuggestedAction = suggestedAction,
            Route = route
        };
    }

    private async Task ApplyDataQualityRemediationStateAsync(IReadOnlyList<DataQualityIssueDto> issues)
    {
        if (issues.Count == 0)
        {
            return;
        }

        var issueIds = issues.Select(issue => issue.IssueId).ToList();
        var remediationLogs = await _context.Auditlogs
            .AsNoTracking()
            .Include(log => log.ChangedByNavigation)
            .Where(log =>
                log.BusinessArea == DataQualityBusinessArea &&
                log.EntityName == DataQualityIssueEntityName &&
                log.FieldName == DataQualityRemediationFieldName &&
                log.OldValue != null &&
                issueIds.Contains(log.OldValue))
            .OrderByDescending(log => log.ChangedAt)
            .ToListAsync();

        var latestByIssue = remediationLogs
            .GroupBy(log => log.OldValue!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var issue in issues)
        {
            if (!latestByIssue.TryGetValue(issue.IssueId, out var log))
            {
                continue;
            }

            issue.RemediationStatus = NormalizeDataQualityRemediationStatus(log.NewValue);
            issue.RemediationAt = log.ChangedAt;
            issue.RemediationByName = log.ChangedByNavigation.FullName ?? log.ChangedByNavigation.Username;
            issue.RemediationNote = log.Reason;
        }
    }

    private static string NormalizeDataQualityRemediationAction(string action)
        => action.Trim().ToLowerInvariant() switch
        {
            "resolve" or "resolved" => "resolved",
            "reopen" or "reopened" => "reopened",
            _ => throw new ArgumentException("Hành động data-quality issue phải là resolve hoặc reopen.")
        };

    private static string NormalizeDataQualityRemediationStatus(string? status)
        => status?.Trim().ToLowerInvariant() switch
        {
            "resolved" => "resolved",
            "reopened" => "reopened",
            _ => "open"
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

    private static int ResolveDataQualityPriorityRank(string category, string severity)
        => category switch
        {
            "stock_shortage" or "negative_stock" or "inventory_ledger_mismatch" => 1,
            "missing_bom" or "missing_conversion" or "invalid_unit" => 2,
            "missing_contract" or "missing_supplier" => 2,
            "kitchen_receipt_discrepancy" or "inactive_bom_ingredient" => 3,
            "stale_demand" or "stale_purchase_request" => 3,
            "orphan_document" => 4,
            _ when severity == "error" => 2,
            _ => 4
        };

    private static int ResolveDataQualitySlaHours(string category, string severity)
        => category switch
        {
            "stock_shortage" or "negative_stock" or "inventory_ledger_mismatch" => 2,
            "missing_bom" => 4,
            "missing_conversion" or "invalid_unit" => 8,
            "missing_contract" or "missing_supplier" => 8,
            "kitchen_receipt_discrepancy" => 12,
            "stale_demand" or "stale_purchase_request" => 24,
            "inactive_bom_ingredient" => 24,
            "orphan_document" => 48,
            _ when severity == "error" => 8,
            _ => 48
        };

    private static string FormatDataQualitySlaLabel(int priorityRank, int slaHours)
        => priorityRank switch
        {
            1 => $"P1 / {slaHours}h",
            2 => $"P2 / {slaHours}h",
            3 => $"P3 / {slaHours}h",
            _ => $"P4 / {slaHours}h"
        };

    private static string ResolveDataQualityOwner(string category, string route)
        => category switch
        {
            "missing_bom" or "legacy_missing_bom" or "inactive_bom_ingredient" => "Kitchen Admin",
            "invalid_unit" or "missing_conversion" or "legacy_missing_conversion" => "Admin dữ liệu",
            "missing_contract" => "Quản lý vận hành",
            "missing_supplier" or "stale_purchase_request" => "Thu mua",
            "stale_demand" => "Điều phối",
            "negative_stock" or "inventory_ledger_mismatch" or "stock_shortage" => "Thủ kho",
            "kitchen_receipt_discrepancy" => "Bếp trưởng",
            "orphan_document" when route.Contains("weekly-menu", StringComparison.OrdinalIgnoreCase) => "Điều phối",
            "orphan_document" when route.Contains("warehouse", StringComparison.OrdinalIgnoreCase) => "Thủ kho",
            _ => "Quản lý vận hành"
        };

    private static string BuildMissingBomRemediationRoute(byte[] dishId, DateOnly serviceDate, WorkflowReportQueryDto query)
    {
        var scope = NormalizeShiftName(query.ShiftName) ?? "FULLDAY";
        var parts = new List<string>
        {
            "view=adjustments",
            "remediate=missing_bom",
            $"dishId={Uri.EscapeDataString(GuidHelper.ToGuidString(dishId))}",
            $"serviceDate={Uri.EscapeDataString(serviceDate.ToString("yyyy-MM-dd"))}",
            $"scope={Uri.EscapeDataString(scope)}"
        };

        if (!string.IsNullOrWhiteSpace(query.CustomerId))
        {
            parts.Add($"customerId={Uri.EscapeDataString(query.CustomerId.Trim())}");
        }

        return $"/admin-data?{string.Join("&", parts)}";
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

    private static string BuildStockLedgerKey(byte[] warehouseId, byte[] ingredientId)
        => $"{Convert.ToBase64String(warehouseId)}|{Convert.ToBase64String(ingredientId)}";

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

    private sealed class StockLedgerCurrentProjection
    {
        public byte[] WarehouseId { get; init; } = [];
        public string? WarehouseCode { get; init; }
        public string? WarehouseName { get; init; }
        public byte[] IngredientId { get; init; } = [];
        public string? IngredientCode { get; init; }
        public string? IngredientName { get; init; }
        public byte[] UnitId { get; init; } = [];
        public string? UnitName { get; init; }
        public decimal CurrentQty { get; init; }
        public DateTime LastUpdated { get; init; }
    }

    private sealed class StockLedgerMovementAggregateProjection
    {
        public byte[] WarehouseId { get; init; } = [];
        public byte[] IngredientId { get; init; } = [];
        public decimal LedgerQty { get; init; }
        public DateTime LastMovementAt { get; init; }
        public int LegacyBaselineCount { get; init; }
    }

    private sealed class StockLedgerLatestMovementProjection
    {
        public byte[] MovementId { get; init; } = [];
        public byte[] WarehouseId { get; init; } = [];
        public string? WarehouseCode { get; init; }
        public string? WarehouseName { get; init; }
        public byte[] IngredientId { get; init; } = [];
        public string? IngredientCode { get; init; }
        public string? IngredientName { get; init; }
        public byte[] UnitId { get; init; } = [];
        public string? UnitName { get; init; }
    }

    private sealed class StockLedgerSourceRow
    {
        public byte[] WarehouseId { get; init; } = [];
        public string? WarehouseCode { get; init; }
        public string? WarehouseName { get; init; }
        public byte[] IngredientId { get; init; } = [];
        public string? IngredientCode { get; init; }
        public string? IngredientName { get; init; }
        public byte[] UnitId { get; init; } = [];
        public string? UnitName { get; init; }
        public decimal CurrentQty { get; init; }
        public decimal LedgerQty { get; init; }
        public decimal DifferenceQty { get; init; }
        public bool IsMatched { get; init; }
        public DateTime? LastMovementAt { get; init; }
        public DateTime? CurrentLastUpdated { get; init; }
        public bool HasCurrentStock { get; init; }
        public bool HasLegacyBaseline { get; init; }
    }

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

    private static int NormalizeAggregateLimit(int limit)
        => limit < 0 ? int.MaxValue : NormalizeLimit(limit);

    private static int NormalizePageLimit(int limit)
        => Math.Clamp(limit <= 0 ? 20 : limit, 1, 100);

    private static bool IsAscending(WorkflowReportQueryDto query)
        => string.Equals(query.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);

    private static WorkflowReportQueryDto CloneQuery(WorkflowReportQueryDto query, int limit)
        => new()
        {
            ServiceDate = query.ServiceDate,
            DateFrom = query.DateFrom,
            DateTo = query.DateTo,
            CustomerId = query.CustomerId,
            WarehouseId = query.WarehouseId,
            IngredientId = query.IngredientId,
            SupplierId = query.SupplierId,
            ShiftName = query.ShiftName,
            Format = query.Format,
            CursorDate = query.CursorDate,
            CursorId = query.CursorId,
            CursorOffset = query.CursorOffset,
            Limit = limit,
            SortDirection = query.SortDirection,
            Actor = query.Actor,
            BusinessArea = query.BusinessArea,
            EntityName = query.EntityName,
            FieldName = query.FieldName,
            GroupBy = query.GroupBy,
            PriceTier = query.PriceTier
        };

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
