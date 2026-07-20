using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Workflow;

public class WorkflowReportService : IWorkflowReportService
{
    private const int LateReceiptThresholdDays = 3;
    private const int DefaultStockMovementWindowDays = 31;
    private const string DataQualityBusinessArea = "DataQuality";
    private const string DataQualityIssueEntityName = "DataQualityIssue";
    private const string DataQualityRemediationFieldName = "Remediation";
    private const string DataQualityCleanupFieldName = "Cleanup";

    private readonly IpcManagementContext _context;
    private const string PublishedBomStatus = "PUBLISHED";
    private static readonly decimal[] SupportedBomPriceTiers = [25000m, 30000m, 34000m];

    public WorkflowReportService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<CurrentStockSummaryDto>> GetCurrentStockAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseGuidString(query.WarehouseId);
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);

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
            .Take(NormalizeLimit(query.Limit))
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
        var warehouseId = GuidHelper.ParseGuidString(query.WarehouseId);
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);

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
        var warehouseId = GuidHelper.ParseGuidString(query.WarehouseId);
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var (dateFrom, dateToExclusive) = ResolveStockMovementWindow(query);
        var cursorDate = ParseCursorDateTime(query.CursorDate);
        var ascending = IsAscending(query);

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
        return BuildCursorPage(rows, limit, row => row.MovementDate, row => row.MovementId);
    }

    public async Task<IReadOnlyList<StockLedgerReconciliationDto>> GetStockLedgerReconciliationAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseGuidString(query.WarehouseId);
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var limit = NormalizeLimit(query.Limit);

        var stocksQuery = _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();
        var movementsQuery = _context.Stockmovements
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
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

        var stocks = await stocksQuery.ToListAsync();
        var movements = await movementsQuery.ToListAsync();
        var stockByKey = stocks.ToDictionary(item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId));
        var movementByKey = movements
            .GroupBy(item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId))
            .ToDictionary(group => group.Key, group => group.ToList());
        var keys = stockByKey.Keys
            .Concat(movementByKey.Keys)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var rows = new List<StockLedgerReconciliationDto>();
        foreach (var key in keys)
        {
            stockByKey.TryGetValue(key, out var stock);
            movementByKey.TryGetValue(key, out var keyMovements);
            var latestMovement = keyMovements?
                .OrderByDescending(item => item.MovementDate)
                .FirstOrDefault();
            var ledgerQty = DecimalPolicy.RoundQuantity(keyMovements?.Sum(item => item.QuantityIn - item.QuantityOut) ?? 0m);
            var currentQty = DecimalPolicy.RoundQuantity(stock?.CurrentQty ?? 0m);
            var difference = DecimalPolicy.RoundQuantity(currentQty - ledgerQty);

            rows.Add(new StockLedgerReconciliationDto
            {
                WarehouseId = GuidHelper.ToGuidString(stock?.WarehouseId ?? latestMovement!.WarehouseId),
                WarehouseName = stock?.Warehouse.WarehouseName ?? latestMovement?.Warehouse.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(stock?.IngredientId ?? latestMovement!.IngredientId),
                IngredientName = stock?.Ingredient.IngredientName ?? latestMovement?.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(stock?.UnitId ?? latestMovement!.UnitId),
                UnitName = stock?.Unit.UnitName ?? latestMovement?.Unit.UnitName,
                CurrentQty = currentQty,
                LedgerQty = ledgerQty,
                DifferenceQty = difference,
                IsMatched = DecimalPolicy.RoundQuantity(difference) == 0,
                LastMovementAt = latestMovement?.MovementDate
            });
        }

        return rows
            .OrderBy(item => item.IsMatched)
            .ThenBy(item => item.WarehouseName)
            .ThenBy(item => item.IngredientName)
            .Take(limit)
            .ToList();
    }

    public async Task<IReadOnlyList<StockSnapshotDto>> GetStockSnapshotsAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseGuidString(query.WarehouseId);
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var periodMonth = ResolveSnapshotPeriodMonth(query);

        var snapshots = _context.Stocksnapshots
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .Where(item => item.PeriodMonth == periodMonth)
            .AsQueryable();

        if (warehouseId is not null)
        {
            snapshots = snapshots.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            snapshots = snapshots.Where(item => item.IngredientId == ingredientId);
        }

        return await snapshots
            .OrderBy(item => item.Warehouse.WarehouseName)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Take(NormalizeLimit(query.Limit))
            .Select(item => new StockSnapshotDto
            {
                SnapshotId = GuidHelper.ToGuidString(item.SnapshotId),
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                PeriodMonth = item.PeriodMonth,
                OpeningQty = item.OpeningQty,
                QuantityIn = item.QuantityIn,
                QuantityOut = item.QuantityOut,
                ClosingQty = item.ClosingQty,
                GeneratedAt = item.GeneratedAt
            })
            .ToListAsync();
    }

    public async Task<IReadOnlyList<StockSnapshotDto>> GenerateMonthlyStockSnapshotAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseGuidString(query.WarehouseId);
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var periodMonth = ResolveSnapshotPeriodMonth(query);
        var periodStart = periodMonth.ToDateTime(TimeOnly.MinValue);
        var periodEnd = periodMonth.AddMonths(1).ToDateTime(TimeOnly.MinValue);
        var generatedAt = DateTime.UtcNow;

        var movementsQuery = _context.Stockmovements
            .AsNoTracking()
            .Where(item => item.MovementDate < periodEnd)
            .AsQueryable();

        if (warehouseId is not null)
        {
            movementsQuery = movementsQuery.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            movementsQuery = movementsQuery.Where(item => item.IngredientId == ingredientId);
        }

        var movements = await movementsQuery
            .OrderBy(item => item.MovementDate)
            .ToListAsync();
        var snapshotRows = movements
            .GroupBy(item => BuildStockSnapshotKey(item.WarehouseId, item.IngredientId, item.UnitId))
            .Select(group => BuildSnapshotRow(group, periodMonth, periodStart, periodEnd, generatedAt))
            .ToList();
        var existingRows = await _context.Stocksnapshots
            .Where(item => item.PeriodMonth == periodMonth)
            .ToListAsync();
        var existingByKey = existingRows.ToDictionary(
            item => BuildStockSnapshotKey(item.WarehouseId, item.IngredientId, item.UnitId),
            StringComparer.Ordinal);

        foreach (var row in snapshotRows)
        {
            var key = BuildStockSnapshotKey(row.WarehouseId, row.IngredientId, row.UnitId);
            if (!existingByKey.TryGetValue(key, out var existing))
            {
                _context.Stocksnapshots.Add(row);
                continue;
            }

            existing.OpeningQty = row.OpeningQty;
            existing.QuantityIn = row.QuantityIn;
            existing.QuantityOut = row.QuantityOut;
            existing.ClosingQty = row.ClosingQty;
            existing.GeneratedAt = row.GeneratedAt;
        }

        await _context.SaveChangesAsync();

        return await GetStockSnapshotsAsync(new WorkflowReportQueryDto
        {
            DateFrom = periodMonth.ToString("yyyy-MM-dd"),
            WarehouseId = query.WarehouseId,
            IngredientId = query.IngredientId,
            Limit = query.Limit
        });
    }

    public async Task<IReadOnlyList<WorkflowDocumentDto>> GetWorkflowDocumentsAsync(WorkflowReportQueryDto query)
    {
        var limit = NormalizeLimit(query.Limit);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var customerId = ParseCustomerId(query.CustomerId);
        var documents = new List<WorkflowDocumentDto>();

        var materialRequests = _context.Materialrequests
            .AsNoTracking()
            .Include(item => item.Plan)
                .ThenInclude(item => item.Productionplanlines)
            .AsQueryable();
        if (dateFrom is not null)
        {
            materialRequests = materialRequests.Where(item => item.RequestDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            materialRequests = materialRequests.Where(item => item.RequestDate <= dateTo);
        }

        if (customerId is not null)
        {
            materialRequests = materialRequests.Where(item => item.Plan.Productionplanlines.Any(line => line.CustomerId.SequenceEqual(customerId)));
        }

        documents.AddRange(await materialRequests
            .OrderByDescending(item => item.RequestDate)
            .Take(limit)
            .Select(item => new WorkflowDocumentDto
            {
                DocumentId = GuidHelper.ToGuidString(item.RequestId),
                DocumentCode = item.RequestCode,
                DocumentType = "Yêu cầu nguyên liệu",
                DocumentDate = item.RequestDate,
                ShiftName = item.RequestScope == "FULLDAY" ? null : item.RequestScope,
                Status = item.Status,
                OwnerLane = "Bếp trưởng",
                Route = "/chef",
                Summary = "Danh sách nhu cầu nguyên liệu đã tính từ suất ăn đã chốt"
            })
            .ToListAsync());

        var purchaseRequests = _context.Purchaserequests
            .AsNoTracking()
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(item => item.MaterialRequestLine)
                    .ThenInclude(item => item.PlanLine)
            .AsQueryable();
        if (dateFrom is not null)
        {
            purchaseRequests = purchaseRequests.Where(item => item.PurchaseForDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            purchaseRequests = purchaseRequests.Where(item => item.PurchaseForDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            purchaseRequests = purchaseRequests.Where(item => item.ShiftName == shiftName);
        }

        if (customerId is not null)
        {
            purchaseRequests = purchaseRequests.Where(item =>
                item.Purchaserequestlines.Any(line => line.MaterialRequestLine.PlanLine.CustomerId.SequenceEqual(customerId)));
        }

        documents.AddRange(await purchaseRequests
            .OrderByDescending(item => item.PurchaseForDate)
            .Take(limit)
            .Select(item => new WorkflowDocumentDto
            {
                DocumentId = GuidHelper.ToGuidString(item.PurchaseRequestId),
                DocumentCode = item.PurchaseRequestCode,
                DocumentType = "Đề nghị mua hàng",
                DocumentDate = item.PurchaseForDate,
                ShiftName = item.ShiftName,
                Status = item.Status,
                OwnerLane = "Mua hàng",
                Route = "/purchasing",
                Summary = "Danh sách thiếu hụt cần mua từ yêu cầu nguyên liệu"
            })
            .ToListAsync());

        documents.AddRange(await BuildReceiptDocumentsAsync(query, limit));
        documents.AddRange(await BuildIssueDocumentsAsync(query, limit));
        documents.AddRange(await BuildReturnDocumentsAsync(query, limit));

        return documents
            .OrderByDescending(item => item.DocumentDate)
            .ThenBy(item => item.DocumentCode)
            .Take(limit)
            .ToList();
    }

    public async Task<IReadOnlyList<IngredientDemandReportDto>> GetIngredientDemandAsync(WorkflowReportQueryDto query)
    {
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Materialrequestlines
            .AsNoTracking()
            .Include(item => item.Request)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .Include(item => item.PlanLine)
                .ThenInclude(item => item.Customer)
            .Include(item => item.PlanLine)
                .ThenInclude(item => item.Dish)
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
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Materialrequestlines
            .AsNoTracking()
            .Include(item => item.Request)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .Include(item => item.PlanLine)
                .ThenInclude(item => item.Customer)
            .Include(item => item.PlanLine)
                .ThenInclude(item => item.Dish)
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
        var shortageCount = await lines.CountAsync(item => item.SuggestedPurchaseQty > 0);
        var items = await lines
            .OrderByDescending(item => item.Request.RequestDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(item => new IngredientDemandReportDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(item.RequestId),
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
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Materialrequestlines.AsNoTracking().AsQueryable();

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

        var grouped = lines.GroupBy(item => new
        {
            item.Request.RequestDate,
            item.IngredientId,
            IngredientName = item.Ingredient.IngredientName,
            item.UnitId,
            UnitName = item.Unit.UnitName,
        });

        var activeGrouped = grouped.Where(group => group.Any(item => item.Request.Status != "CANCELLED"));
        var totalCount = await activeGrouped.CountAsync();
        var shortageCount = await activeGrouped.CountAsync(group =>
            group.Sum(item => item.Request.Status != "CANCELLED" ? item.SuggestedPurchaseQty : 0m) > 0);
        var items = await activeGrouped
            .OrderByDescending(group => group.Key.RequestDate)
            .ThenBy(group => group.Key.IngredientName)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(group => new IngredientDemandAggregateDto
            {
                RequestDate = group.Key.RequestDate,
                IngredientId = GuidHelper.ToGuidString(group.Key.IngredientId),
                IngredientName = group.Key.IngredientName,
                UnitId = GuidHelper.ToGuidString(group.Key.UnitId),
                UnitName = group.Key.UnitName,
                TotalRequiredQty = group.Sum(item => item.Request.Status != "CANCELLED" ? item.TotalRequiredQty : 0m),
                CurrentStockQty = (decimal)group
                    .Where(item => item.Request.Status != "CANCELLED")
                    .Max(item => (double)item.CurrentStockQty),
                SuggestedPurchaseQty = group.Sum(item => item.Request.Status != "CANCELLED" ? item.SuggestedPurchaseQty : 0m),
                LineCount = group.Count(item => item.Request.Status != "CANCELLED"),
                // Cancelled history must not mark a successfully regenerated active group as stale.
                HasCancelledLine = false,
            })
            .ToListAsync();

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

    public async Task<IReadOnlyList<PurchasePlanReportDto>> GetPurchasePlanAsync(WorkflowReportQueryDto query)
    {
        var rows = await BuildPurchasePlanRowsAsync(query, NormalizeLimit(query.Limit <= 0 ? 500 : query.Limit));
        return rows
            .Take(NormalizeLimit(query.Limit <= 0 ? 500 : query.Limit))
            .ToList();
    }

    private async Task<IReadOnlyList<PurchasePlanReportDto>> BuildPurchasePlanRowsAsync(WorkflowReportQueryDto query, int? sourceLimit)
    {
        var groupBy = string.Equals(query.GroupBy, "week", StringComparison.OrdinalIgnoreCase) ? "week" : "day";
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom) ?? ParseDateOnly(query.ServiceDate);
        var dateTo = ParseDateOnly(query.DateTo) ?? dateFrom;
        decimal? priceTier = query.PriceTier is null ? null : NormalizePriceTier(query.PriceTier.Value);

        var linesQuery = _context.Materialrequestlines
            .AsNoTracking()
            .Include(line => line.Request)
            .Include(line => line.Ingredient)
            .Include(line => line.Unit)
            .Include(line => line.PlanLine)
                .ThenInclude(line => line.Customer)
            .Include(line => line.Purchaserequestlines)
                .ThenInclude(line => line.PurchaseRequest)
            .Include(line => line.Purchaserequestlines)
                .ThenInclude(line => line.Inventoryreceiptlines)
            .AsSplitQuery()
            .Where(line => line.Request.Status != "CANCELLED")
            .AsQueryable();

        if (dateFrom is not null)
        {
            linesQuery = linesQuery.Where(line => line.Request.RequestDate >= dateFrom);
        }
        if (dateTo is not null)
        {
            linesQuery = linesQuery.Where(line => line.Request.RequestDate <= dateTo);
        }
        if (ingredientId is not null)
        {
            linesQuery = linesQuery.Where(line => line.IngredientId == ingredientId);
        }
        if (customerId is not null)
        {
            linesQuery = linesQuery.Where(line => line.PlanLine.CustomerId.SequenceEqual(customerId));
        }
        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            linesQuery = linesQuery.Where(line => line.PlanLine.ShiftName == shiftName);
        }
        if (priceTier is not null)
        {
            linesQuery = linesQuery.Where(line => line.PriceTierAmount == priceTier.Value);
        }

        IQueryable<Materialrequestline> orderedLines = linesQuery
            .OrderBy(line => line.Request.RequestDate)
            .ThenBy(line => line.Ingredient.IngredientName);
        if (sourceLimit is not null)
        {
            orderedLines = orderedLines.Take(sourceLimit.Value);
        }
        var lines = await orderedLines.ToListAsync();
        if (lines.Count == 0)
        {
            return [];
        }

        var ingredientIds = lines.Select(line => line.IngredientId).Distinct(ByteArrayComparer.Instance).ToList();
        var quotations = await _context.Supplierquotations
            .AsNoTracking()
            .Include(item => item.Supplier)
            .Where(item => item.IsActive ?? true)
            .Where(item => ingredientIds.Contains(item.IngredientId))
            .Where(item => item.EffectiveFrom <= DateOnly.FromDateTime(DateTime.Today) && (item.EffectiveTo == null || item.EffectiveTo >= DateOnly.FromDateTime(DateTime.Today)))
            .OrderByDescending(item => item.EffectiveFrom)
            .ToListAsync();
        var quotationByIngredient = quotations
            .GroupBy(item => Convert.ToBase64String(item.IngredientId))
            .ToDictionary(group => group.Key, group => group.First());

        return lines
            .GroupBy(line =>
            {
                var period = ResolvePurchasePlanPeriod(line.Request.RequestDate, groupBy);
                return new
                {
                    PeriodStart = period.Start,
                    PeriodEnd = period.End,
                    IngredientKey = Convert.ToBase64String(line.IngredientId),
                    UnitKey = Convert.ToBase64String(line.UnitId)
                };
            })
            .Select(group =>
            {
                var first = group.First();
                var quotationByKey = quotationByIngredient.GetValueOrDefault(Convert.ToBase64String(first.IngredientId));
                var pendingReceiptQty = group
                    .SelectMany(line => line.Purchaserequestlines)
                    .Where(line => line.PurchaseRequest is not null && line.PurchaseRequest.Status != "CANCELLED")
                    .Sum(line => Math.Max(0m, line.PurchaseQty - line.Inventoryreceiptlines.Sum(receipt => receipt.Quantity)));
                var requiredQty = DecimalPolicy.RoundQuantity(group.Sum(line => line.TotalRequiredQty));
                var currentStockQty = DecimalPolicy.RoundQuantity(group.Sum(line => line.CurrentStockQty));
                var suggestedPurchaseQty = DecimalPolicy.RoundQuantity(group.Sum(line => line.SuggestedPurchaseQty));
                var shortageQty = DecimalPolicy.RoundQuantity(Math.Max(0m, suggestedPurchaseQty - pendingReceiptQty));
                var unitPrice = quotationByKey?.UnitPrice ?? first.Ingredient.ReferencePrice;
                var warnings = new List<string>();
                if (suggestedPurchaseQty > 0 && quotationByKey is null)
                {
                    warnings.Add("Chưa có báo giá NCC đang hiệu lực.");
                }
                if (pendingReceiptQty > 0)
                {
                    warnings.Add("Có lượng đang chờ nhập kho, cần đối chiếu trước khi đặt mua thêm.");
                }
                if (shortageQty > 0)
                {
                    warnings.Add("Còn thiếu so với demand sau khi trừ pending receipt.");
                }

                return new PurchasePlanReportDto
                {
                    PeriodKey = groupBy == "week"
                        ? $"{group.Key.PeriodStart:yyyy-MM-dd}/{group.Key.PeriodEnd:yyyy-MM-dd}"
                        : $"{group.Key.PeriodStart:yyyy-MM-dd}",
                    GroupBy = groupBy,
                    PeriodStart = group.Key.PeriodStart,
                    PeriodEnd = group.Key.PeriodEnd,
                    IngredientId = GuidHelper.ToGuidString(first.IngredientId),
                    IngredientName = first.Ingredient.IngredientName,
                    UnitId = GuidHelper.ToGuidString(first.UnitId),
                    UnitName = first.Unit.UnitName,
                    RequiredQty = requiredQty,
                    CurrentStockQty = currentStockQty,
                    PendingReceiptQty = DecimalPolicy.RoundQuantity(pendingReceiptQty),
                    ShortageQty = shortageQty,
                    SuggestedPurchaseQty = suggestedPurchaseQty,
                    EstimatedUnitPrice = DecimalPolicy.RoundMoney(unitPrice),
                    EstimatedAmount = DecimalPolicy.CalculateLineAmount(shortageQty, unitPrice),
                    SupplierId = quotationByKey is null ? null : GuidHelper.ToGuidString(quotationByKey.SupplierId),
                    SupplierName = quotationByKey?.Supplier.SupplierName,
                    ExpectedDeliveryDate = group.Key.PeriodStart,
                    Warnings = warnings
                };
            })
            .OrderBy(item => item.PeriodStart)
            .ThenBy(item => item.IngredientName)
            .ToList();
    }

    public async Task<PurchasePlanPageDto> GetPurchasePlanPageAsync(PurchasePlanPageQueryDto query)
    {
        var rows = await BuildPurchasePlanRowsAsync(query, null);
        var totalCount = rows.Count;
        var items = rows
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        return new PurchasePlanPageDto
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize,
            TotalShortageQty = rows.Sum(row => row.ShortageQty),
            TotalEstimatedAmount = rows.Sum(row => row.EstimatedAmount),
        };
    }

    public async Task<IReadOnlyList<PurchaseDemandReportDto>> GetPurchaseDemandAsync(WorkflowReportQueryDto query)
    {
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var supplierId = GuidHelper.ParseGuidString(query.SupplierId);
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Purchaserequestlines
            .AsNoTracking()
            .Include(item => item.PurchaseRequest)
            .Include(item => item.Ingredient)
            .Include(item => item.Supplier)
            .Include(item => item.Unit)
            .Include(item => item.MaterialRequestLine)
                .ThenInclude(item => item.PlanLine)
            .AsQueryable();

        if (ingredientId is not null)
        {
            lines = lines.Where(item => item.IngredientId == ingredientId);
        }

        if (supplierId is not null)
        {
            lines = lines.Where(item => item.SupplierId == supplierId);
        }

        if (dateFrom is not null)
        {
            lines = lines.Where(item => item.PurchaseRequest.PurchaseForDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            lines = lines.Where(item => item.PurchaseRequest.PurchaseForDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            lines = lines.Where(item => item.PurchaseRequest.ShiftName == shiftName);
        }

        if (customerId is not null)
        {
            lines = lines.Where(item => item.MaterialRequestLine.PlanLine.CustomerId.SequenceEqual(customerId));
        }

        var purchaseLines = await lines
            .OrderByDescending(item => item.PurchaseRequest.PurchaseForDate)
            .ThenBy(item => item.Supplier.SupplierName)
            .Take(NormalizeLimit(query.Limit))
            .ToListAsync();

        var latestReceiptPrices = await LoadLatestReceiptPriceLookupAsync(purchaseLines);

        return purchaseLines
            .Select(item => new PurchaseDemandReportDto
            {
                PurchaseRequestId = GuidHelper.ToGuidString(item.PurchaseRequestId),
                PurchaseRequestLineId = GuidHelper.ToGuidString(item.PurchaseRequestLineId),
                PurchaseRequestCode = item.PurchaseRequest.PurchaseRequestCode,
                PurchaseForDate = item.PurchaseRequest.PurchaseForDate,
                ShiftName = item.PurchaseRequest.ShiftName,
                Status = item.PurchaseRequest.Status,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                SupplierId = GuidHelper.ToGuidString(item.SupplierId),
                SupplierName = item.Supplier.SupplierName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                RequiredQty = DecimalPolicy.RoundQuantity(item.RequiredQty),
                CurrentStockQty = DecimalPolicy.RoundQuantity(item.CurrentStockQty),
                PurchaseQty = DecimalPolicy.RoundQuantity(item.PurchaseQty),
                EstimatedUnitPrice = DecimalPolicy.RoundMoney(item.EstimatedUnitPrice),
                EstimatedAmount = DecimalPolicy.CalculateLineAmount(item.PurchaseQty, item.EstimatedUnitPrice),
                ReferenceUnitPrice = ResolvePurchaseReferencePrice(item, latestReceiptPrices),
                PriceVariancePercent = WorkflowReportCalculator.CalculateVariancePercent(
                    ResolvePurchaseReferencePrice(item, latestReceiptPrices),
                    item.EstimatedUnitPrice),
                IsPriceWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(
                    WorkflowReportCalculator.CalculateVariancePercent(
                        ResolvePurchaseReferencePrice(item, latestReceiptPrices),
                        item.EstimatedUnitPrice)),
                ExpectedDeliveryDate = item.ExpectedDeliveryDate,
                Note = item.Note
            })
            .ToList();
    }

    private async Task<Dictionary<string, decimal>> LoadLatestReceiptPriceLookupAsync(IReadOnlyCollection<Purchaserequestline> purchaseLines)
    {
        if (purchaseLines.Count == 0)
        {
            return [];
        }

        var ingredientIds = purchaseLines.Select(item => item.IngredientId).Distinct(ByteArrayComparer.Instance).ToList();
        var supplierIds = purchaseLines.Select(item => item.SupplierId).Distinct(ByteArrayComparer.Instance).ToList();
        var unitIds = purchaseLines.Select(item => item.UnitId).Distinct(ByteArrayComparer.Instance).ToList();

        var receiptLines = await _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
            .Where(item =>
                ingredientIds.Contains(item.IngredientId) &&
                supplierIds.Contains(item.Receipt.SupplierId) &&
                unitIds.Contains(item.UnitId) &&
                item.UnitPrice > 0)
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .ToListAsync();

        return receiptLines
            .GroupBy(item => BuildPurchasePriceKey(item.IngredientId, item.Receipt.SupplierId, item.UnitId))
            .ToDictionary(group => group.Key, group => DecimalPolicy.RoundMoney(group.First().UnitPrice));
    }

    private static decimal ResolvePurchaseReferencePrice(
        Purchaserequestline line,
        IReadOnlyDictionary<string, decimal> latestReceiptPrices)
    {
        var key = BuildPurchasePriceKey(line.IngredientId, line.SupplierId, line.UnitId);
        return latestReceiptPrices.TryGetValue(key, out var latestPrice) && latestPrice > 0
            ? latestPrice
            : DecimalPolicy.RoundMoney(line.Ingredient.ReferencePrice);
    }

    private static string BuildPurchasePriceKey(byte[] ingredientId, byte[] supplierId, byte[] unitId)
        => $"{Convert.ToBase64String(ingredientId)}:{Convert.ToBase64String(supplierId)}:{Convert.ToBase64String(unitId)}";

    public async Task<IReadOnlyList<ReceiptPriceVarianceReportDto>> GetReceiptPriceVarianceAsync(WorkflowReportQueryDto query)
    {
        var receiptLines = await BuildFilteredReceiptLinesQuery(query)
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Take(NormalizeLimit(query.Limit))
            .ToListAsync();

        return receiptLines
            .Select(item =>
            {
                var variance = WorkflowReportCalculator.CalculateVariancePercent(
                    item.Ingredient.ReferencePrice,
                    item.UnitPrice);

                return new ReceiptPriceVarianceReportDto
                {
                    ReceiptId = GuidHelper.ToGuidString(item.ReceiptId),
                    ReceiptCode = item.Receipt.ReceiptCode,
                    ReceiptDate = item.Receipt.ReceiptDate,
                    SupplierId = GuidHelper.ToGuidString(item.Receipt.SupplierId),
                    SupplierName = item.Receipt.Supplier.SupplierName,
                    IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                    IngredientName = item.Ingredient.IngredientName,
                    UnitId = GuidHelper.ToGuidString(item.UnitId),
                    UnitName = item.Unit.UnitName,
                    Quantity = DecimalPolicy.RoundQuantity(item.Quantity),
                    UnitPrice = DecimalPolicy.RoundMoney(item.UnitPrice),
                    ReferencePrice = DecimalPolicy.RoundMoney(item.Ingredient.ReferencePrice),
                    VariancePercent = variance,
                    IsWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(variance)
                };
            })
            .ToList();
    }

    public async Task<PagedResponseDto<ReceiptPriceVarianceReportDto>> GetReceiptPriceVariancePageAsync(ReceiptPriceVariancePageQueryDto query)
    {
        var filteredLines = BuildFilteredReceiptLinesQuery(query);
        var totalCount = await filteredLines.CountAsync();
        var receiptLines = await filteredLines
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        var items = receiptLines
            .Select(item =>
            {
                var variance = WorkflowReportCalculator.CalculateVariancePercent(
                    item.Ingredient.ReferencePrice,
                    item.UnitPrice);

                return new ReceiptPriceVarianceReportDto
                {
                    ReceiptId = GuidHelper.ToGuidString(item.ReceiptId),
                    ReceiptCode = item.Receipt.ReceiptCode,
                    ReceiptDate = item.Receipt.ReceiptDate,
                    SupplierId = GuidHelper.ToGuidString(item.Receipt.SupplierId),
                    SupplierName = item.Receipt.Supplier.SupplierName,
                    IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                    IngredientName = item.Ingredient.IngredientName,
                    UnitId = GuidHelper.ToGuidString(item.UnitId),
                    UnitName = item.Unit.UnitName,
                    Quantity = DecimalPolicy.RoundQuantity(item.Quantity),
                    UnitPrice = DecimalPolicy.RoundMoney(item.UnitPrice),
                    ReferencePrice = DecimalPolicy.RoundMoney(item.Ingredient.ReferencePrice),
                    VariancePercent = variance,
                    IsWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(variance)
                };
            })
            .ToList();

        return PagedResponseDto<ReceiptPriceVarianceReportDto>.Create(
            items,
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IReadOnlyList<PriceVarianceBySupplierDto>> GetPriceVarianceBySupplierAsync(WorkflowReportQueryDto query)
    {
        var lines = await BuildFilteredReceiptLinesQuery(query).ToListAsync();

        return lines
            .GroupBy(item => new
            {
                IngredientKey = Convert.ToBase64String(item.IngredientId),
                SupplierKey = Convert.ToBase64String(item.Receipt.SupplierId)
            })
            .Select(group =>
            {
                var first = group.First();
                var avgPrice = DecimalPolicy.RoundMoney(group.Average(x => x.UnitPrice));
                var variance = WorkflowReportCalculator.CalculateVariancePercent(first.Ingredient.ReferencePrice, avgPrice);

                return new PriceVarianceBySupplierDto
                {
                    IngredientId = GuidHelper.ToGuidString(first.IngredientId),
                    IngredientName = first.Ingredient.IngredientName,
                    SupplierId = GuidHelper.ToGuidString(first.Receipt.SupplierId),
                    SupplierName = first.Receipt.Supplier.SupplierName,
                    ReceiptCount = group.Count(),
                    AvgUnitPrice = avgPrice,
                    MinUnitPrice = DecimalPolicy.RoundMoney(group.Min(x => x.UnitPrice)),
                    MaxUnitPrice = DecimalPolicy.RoundMoney(group.Max(x => x.UnitPrice)),
                    ReferencePrice = DecimalPolicy.RoundMoney(first.Ingredient.ReferencePrice),
                    VariancePercent = variance,
                    IsWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(variance)
                };
            })
            .OrderByDescending(dto => dto.VariancePercent)
            .ThenBy(dto => dto.IngredientName)
            .Take(NormalizeAggregateLimit(query.Limit))
            .ToList();
    }

    public async Task<PagedResponseDto<PriceVarianceBySupplierDto>> GetPriceVarianceBySupplierPageAsync(PriceVarianceAggregatePageQueryDto query)
    {
        var rows = await GetPriceVarianceBySupplierAsync(CloneQuery(query, -1));
        return PagedResponseDto<PriceVarianceBySupplierDto>.Create(
            rows.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize),
            rows.Count,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IReadOnlyList<PriceVarianceByPeriodDto>> GetPriceVarianceByPeriodAsync(WorkflowReportQueryDto query)
    {
        var lines = await BuildFilteredReceiptLinesQuery(query).ToListAsync();

        var byIngredientAndPeriod = lines
            .GroupBy(item => new
            {
                IngredientKey = Convert.ToBase64String(item.IngredientId),
                PeriodStart = new DateOnly(item.Receipt.ReceiptDate.Year, item.Receipt.ReceiptDate.Month, 1)
            })
            .Select(group =>
            {
                var first = group.First();
                return new
                {
                    first.IngredientId,
                    first.Ingredient.IngredientName,
                    first.Ingredient.ReferencePrice,
                    group.Key.PeriodStart,
                    AvgUnitPrice = DecimalPolicy.RoundMoney(group.Average(x => x.UnitPrice))
                };
            })
            .ToList();

        var result = new List<PriceVarianceByPeriodDto>();
        foreach (var ingredientGroup in byIngredientAndPeriod
            .GroupBy(x => Convert.ToBase64String(x.IngredientId))
            .OrderBy(g => g.First().IngredientName))
        {
            var periods = ingredientGroup.OrderBy(x => x.PeriodStart).ToList();
            for (var i = 0; i < periods.Count; i++)
            {
                var current = periods[i];
                var varianceVsReference = WorkflowReportCalculator.CalculateVariancePercent(current.ReferencePrice, current.AvgUnitPrice);
                decimal? varianceVsPrevious = i > 0
                    ? WorkflowReportCalculator.CalculateVariancePercent(periods[i - 1].AvgUnitPrice, current.AvgUnitPrice)
                    : null;

                result.Add(new PriceVarianceByPeriodDto
                {
                    IngredientId = GuidHelper.ToGuidString(current.IngredientId),
                    IngredientName = current.IngredientName,
                    PeriodLabel = current.PeriodStart.ToString("yyyy-MM"),
                    PeriodStart = current.PeriodStart,
                    AvgUnitPrice = current.AvgUnitPrice,
                    ReferencePrice = DecimalPolicy.RoundMoney(current.ReferencePrice),
                    VariancePercentVsReference = varianceVsReference,
                    VariancePercentVsPreviousPeriod = varianceVsPrevious,
                    IsWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(varianceVsReference)
                });
            }
        }

        return result.Take(NormalizeAggregateLimit(query.Limit)).ToList();
    }

    public async Task<PagedResponseDto<PriceVarianceByPeriodDto>> GetPriceVarianceByPeriodPageAsync(PriceVarianceAggregatePageQueryDto query)
    {
        var rows = await GetPriceVarianceByPeriodAsync(CloneQuery(query, -1));
        return PagedResponseDto<PriceVarianceByPeriodDto>.Create(
            rows.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize),
            rows.Count,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IReadOnlyList<PriceVarianceByDishGroupDto>> GetPriceVarianceByDishGroupAsync(WorkflowReportQueryDto query)
    {
        var lines = await BuildFilteredReceiptLinesQuery(query).ToListAsync();

        var ingredientVariance = lines
            .GroupBy(item => Convert.ToBase64String(item.IngredientId))
            .Select(group =>
            {
                var first = group.First();
                var avgPrice = DecimalPolicy.RoundMoney(group.Average(x => x.UnitPrice));
                var variance = WorkflowReportCalculator.CalculateVariancePercent(first.Ingredient.ReferencePrice, avgPrice);

                return new
                {
                    IngredientKey = Convert.ToBase64String(first.IngredientId),
                    first.Ingredient.IngredientName,
                    VariancePercent = variance,
                    IsWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(variance)
                };
            })
            .ToDictionary(x => x.IngredientKey);

        if (ingredientVariance.Count == 0)
        {
            return [];
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        var activeBomLines = await _context.Dishboms
            .AsNoTracking()
            .Include(bom => bom.Dish)
            .Where(bom =>
                SupportedBomPriceTiers.Contains(bom.PriceTierAmount) &&
                bom.EffectiveFrom <= today &&
                (bom.EffectiveTo == null || bom.EffectiveTo >= today))
            .ToListAsync();

        var groupIngredientWeights = activeBomLines
            .Where(bom => ingredientVariance.ContainsKey(Convert.ToBase64String(bom.IngredientId)))
            .GroupBy(bom => new
            {
                GroupName = string.IsNullOrWhiteSpace(bom.Dish.DishGroup) ? "Chưa phân nhóm" : bom.Dish.DishGroup!,
                IngredientKey = Convert.ToBase64String(bom.IngredientId)
            })
            .Select(g => new
            {
                g.Key.GroupName,
                g.Key.IngredientKey,
                Weight = g.Sum(x => x.GrossQtyPerServing)
            })
            .ToList();

        return groupIngredientWeights
            .GroupBy(x => x.GroupName)
            .Select(group =>
            {
                var items = group
                    .Select(x => new
                    {
                        x.Weight,
                        Info = ingredientVariance[x.IngredientKey]
                    })
                    .ToList();

                var totalWeight = items.Sum(x => x.Weight);
                var weightedAvg = totalWeight > 0
                    ? DecimalPolicy.RoundPercent(items.Sum(x => x.Weight * x.Info.VariancePercent) / totalWeight)
                    : 0;

                return new PriceVarianceByDishGroupDto
                {
                    DishGroup = group.Key,
                    IngredientCount = items.Count,
                    WarningIngredientCount = items.Count(x => x.Info.IsWarning),
                    WeightedAvgVariancePercent = weightedAvg,
                    TopIngredients = items
                        .OrderByDescending(x => x.Info.VariancePercent)
                        .Take(3)
                        .Select(x => new PriceVarianceDishGroupIngredientDto
                        {
                            IngredientName = x.Info.IngredientName,
                            VariancePercent = x.Info.VariancePercent,
                            Weight = DecimalPolicy.RoundQuantity(x.Weight)
                        })
                        .ToList()
                };
            })
            .OrderByDescending(dto => dto.WeightedAvgVariancePercent)
            .Take(NormalizeAggregateLimit(query.Limit))
            .ToList();
    }

    public async Task<PagedResponseDto<PriceVarianceByDishGroupDto>> GetPriceVarianceByDishGroupPageAsync(PriceVarianceAggregatePageQueryDto query)
    {
        var rows = await GetPriceVarianceByDishGroupAsync(CloneQuery(query, -1));
        return PagedResponseDto<PriceVarianceByDishGroupDto>.Create(
            rows.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize),
            rows.Count,
            query.PageNumber,
            query.PageSize);
    }

    private IQueryable<Inventoryreceiptline> BuildFilteredReceiptLinesQuery(WorkflowReportQueryDto query)
    {
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var supplierId = GuidHelper.ParseGuidString(query.SupplierId);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
                .ThenInclude(item => item.Supplier)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();

        if (ingredientId is not null)
        {
            lines = lines.Where(item => item.IngredientId == ingredientId);
        }

        if (supplierId is not null)
        {
            lines = lines.Where(item => item.Receipt.SupplierId == supplierId);
        }

        if (dateFrom is not null)
        {
            lines = lines.Where(item => item.Receipt.ReceiptDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            lines = lines.Where(item => item.Receipt.ReceiptDate <= dateTo);
        }

        if (query.WarningOnly)
        {
            lines = lines.Where(item => item.Ingredient.ReferencePrice > 0 && item.UnitPrice >= item.Ingredient.ReferencePrice * 1.15m);
        }

        return lines;
    }

    public async Task<IReadOnlyList<KitchenIssueReportDto>> GetKitchenIssuesAsync(WorkflowReportQueryDto query)
    {
        var lines = await QueryIssueLines(query)
            .OrderByDescending(item => item.Issue.IssueDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Take(NormalizeLimit(query.Limit))
            .ToListAsync();

        return lines.Select(MapKitchenIssue).ToList();
    }

    public async Task<PagedResponseDto<KitchenIssueReportDto>> GetKitchenIssuesPageAsync(KitchenIssuePageQueryDto query)
    {
        var filteredLines = QueryIssueLines(query);
        var totalCount = await filteredLines.CountAsync();
        var lines = await filteredLines
            .OrderByDescending(item => item.Issue.IssueDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResponseDto<KitchenIssueReportDto>.Create(
            lines.Select(MapKitchenIssue).ToList(),
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IReadOnlyList<IssueVsReturnUsageReportDto>> GetIssueVsReturnAsync(WorkflowReportQueryDto query)
    {
        var lines = await QueryIssueLines(query)
            .OrderByDescending(item => item.Issue.IssueDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Take(NormalizeLimit(query.Limit))
            .ToListAsync();

        var issueIds = lines
            .Select(item => item.IssueId)
            .Distinct(ByteArrayComparer.Instance)
            .ToList();

        var returnLines = await _context.Inventoryreturnlines
            .AsNoTracking()
            .Include(item => item.Return)
            .Where(item => issueIds.Contains(item.Return.IssueId))
            .ToListAsync();

        var returnTotals = returnLines
            .Where(item => item.Return.ReturnType == "RETURN")
            .GroupBy(item => BuildUsageKey(item.Return.IssueId, item.IngredientId, item.UnitId))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));
        var wasteTotals = returnLines
            .Where(item => item.Return.ReturnType == "WASTE")
            .GroupBy(item => BuildUsageKey(item.Return.IssueId, item.IngredientId, item.UnitId))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));

        return lines
            .Select(item =>
            {
                var returnedQty = returnTotals.GetValueOrDefault(
                    BuildUsageKey(item.IssueId, item.IngredientId, item.UnitId),
                    0);
                var wastedQty = wasteTotals.GetValueOrDefault(
                    BuildUsageKey(item.IssueId, item.IngredientId, item.UnitId),
                    0);
                var varianceQty = DecimalPolicy.RoundQuantity(returnedQty + wastedQty);

                return new IssueVsReturnUsageReportDto
                {
                    IssueId = GuidHelper.ToGuidString(item.IssueId),
                    IssueCode = item.Issue.IssueCode,
                    IssueDate = item.Issue.IssueDate,
                    ShiftName = item.Issue.ShiftName,
                    IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                    IngredientName = item.Ingredient.IngredientName,
                    UnitId = GuidHelper.ToGuidString(item.UnitId),
                    UnitName = item.Unit.UnitName,
                    IssuedQty = DecimalPolicy.RoundQuantity(item.IssuedQty),
                    ReturnedQty = DecimalPolicy.RoundQuantity(returnedQty),
                    WastedQty = DecimalPolicy.RoundQuantity(wastedQty),
                    VarianceQty = varianceQty,
                    UsedQty = WorkflowReportCalculator.CalculateUsedQuantity(item.IssuedQty, varianceQty)
                };
            })
            .ToList();
    }

    public async Task<PagedResponseDto<IssueVsReturnUsageReportDto>> GetIssueVsReturnPageAsync(IssueVsReturnPageQueryDto query)
    {
        var filteredLines = QueryIssueLines(query);
        var totalCount = await filteredLines.CountAsync();
        var lines = await filteredLines
            .OrderByDescending(item => item.Issue.IssueDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        var issueIds = lines
            .Select(item => item.IssueId)
            .Distinct(ByteArrayComparer.Instance)
            .ToList();
        var returnLines = await _context.Inventoryreturnlines
            .AsNoTracking()
            .Include(item => item.Return)
            .Where(item => issueIds.Contains(item.Return.IssueId))
            .ToListAsync();
        var returnTotals = returnLines
            .Where(item => item.Return.ReturnType == "RETURN")
            .GroupBy(item => BuildUsageKey(item.Return.IssueId, item.IngredientId, item.UnitId))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));
        var wasteTotals = returnLines
            .Where(item => item.Return.ReturnType == "WASTE")
            .GroupBy(item => BuildUsageKey(item.Return.IssueId, item.IngredientId, item.UnitId))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));

        var items = lines.Select(item =>
        {
            var returnedQty = returnTotals.GetValueOrDefault(BuildUsageKey(item.IssueId, item.IngredientId, item.UnitId), 0);
            var wastedQty = wasteTotals.GetValueOrDefault(BuildUsageKey(item.IssueId, item.IngredientId, item.UnitId), 0);
            var varianceQty = DecimalPolicy.RoundQuantity(returnedQty + wastedQty);
            return new IssueVsReturnUsageReportDto
            {
                IssueId = GuidHelper.ToGuidString(item.IssueId),
                IssueCode = item.Issue.IssueCode,
                IssueDate = item.Issue.IssueDate,
                ShiftName = item.Issue.ShiftName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                IssuedQty = DecimalPolicy.RoundQuantity(item.IssuedQty),
                ReturnedQty = DecimalPolicy.RoundQuantity(returnedQty),
                WastedQty = DecimalPolicy.RoundQuantity(wastedQty),
                VarianceQty = varianceQty,
                UsedQty = WorkflowReportCalculator.CalculateUsedQuantity(item.IssuedQty, varianceQty)
            };
        }).ToList();

        return PagedResponseDto<IssueVsReturnUsageReportDto>.Create(items, totalCount, query.PageNumber, query.PageSize);
    }

    public async Task<IReadOnlyList<AuditChangeReportDto>> GetAuditChangesAsync(WorkflowReportQueryDto query)
    {
        var dateFrom = ParseDateTimeStart(query.DateFrom);
        var dateToExclusive = ParseDateTimeEndExclusive(query.DateTo);
        var limit = NormalizeLimit(query.Limit);
        var cursorDate = ParseCursorDateTime(query.CursorDate);
        var ascending = IsAscending(query);

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
            .Take(limit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.AuditId),
                ChangedAt = item.ChangedAt,
                ChangedBy = GuidHelper.ToGuidString(item.ChangedBy),
                ChangedByName = item.ChangedByNavigation.FullName ?? item.ChangedByNavigation.Username ?? "System",
                BusinessArea = item.EntityName == nameof(Mealquantityplan)
                    && item.FieldName == nameof(Mealquantityplan.Status)
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
            .Take(limit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.ImportBatchId),
                ChangedAt = item.ImportedAt,
                ChangedBy = item.ImportedBy == null ? string.Empty : GuidHelper.ToGuidString(item.ImportedBy),
                ChangedByName = item.ImportedByNavigation == null
                    ? "Sample Data Importer"
                    : item.ImportedByNavigation.FullName ?? item.ImportedByNavigation.Username ?? "Sample Data Importer",
                BusinessArea = "Import",
                EntityName = nameof(Quantityimportbatch),
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
            .Take(limit)
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
                    EntityName = nameof(Menuversion),
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
            .Take(limit)
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
            .Take(limit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.ReceiptId),
                ChangedAt = item.CreatedAt,
                ChangedBy = GuidHelper.ToGuidString(item.CreatedBy),
                ChangedByName = item.CreatedByNavigation.FullName ?? item.CreatedByNavigation.Username ?? "System",
                BusinessArea = "Receipt",
                EntityName = nameof(Inventoryreceipt),
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
            .Take(limit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.IssueId),
                ChangedAt = item.CreatedAt,
                ChangedBy = GuidHelper.ToGuidString(item.IssuedBy),
                ChangedByName = item.IssuedByNavigation.FullName ?? item.IssuedByNavigation.Username ?? "System",
                BusinessArea = "Issue",
                EntityName = nameof(Inventoryissue),
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
            .Take(limit)
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
            .Take(limit)
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
            .Take(limit)
            .ToList();
    }

    public async Task<CursorPageDto<AuditChangeReportDto>> GetAuditChangePageAsync(WorkflowReportQueryDto query)
    {
        var limit = NormalizePageLimit(query.Limit);
        var rows = await GetAuditChangesAsync(CloneQuery(query, limit + 1));
        return BuildCursorPage(rows, limit, row => row.ChangedAt, row => row.AuditId);
    }

    public async Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query)
    {
        var limit = NormalizeLimit(query.Limit);
        var serviceDate = ParseDateOnly(query.ServiceDate) ?? ParseDateOnly(query.DateFrom) ?? DateOnly.FromDateTime(DateTime.Today);
        var issues = new List<DataQualityIssueDto>();

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

        issues.AddRange(missingBomDishes.Select(dish => BuildDataQualityIssue(
            "missing_bom",
            "error",
            nameof(Dish),
            GuidHelper.ToGuidString(dish.DishId),
            dish.DishCode,
            dish.DishName,
            "Món đang hoạt động nhưng chưa có dòng BOM/định lượng hiệu lực.",
            "Mở Quản trị dữ liệu > BOM theo đơn giá để tải mẫu Excel và import BOM đúng tier.",
            BuildMissingBomRemediationRoute(dish.DishId, serviceDate, query))));

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
                nameof(Dishbom),
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
            nameof(Dishbom),
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
                nameof(Currentstock),
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
                "missing_conversion",
                "warning",
                nameof(Inventoryreceiptline),
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
            nameof(Dishbom),
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
            nameof(Currentstock),
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
            nameof(Currentstock),
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
            nameof(Productionplan),
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
            .Where(line => line.Supplier.IsActive == false)
            .OrderBy(line => line.PurchaseRequest.PurchaseRequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(inactiveSupplierLines.Select(line => BuildDataQualityIssue(
            "missing_supplier",
            "error",
            nameof(Purchaserequestline),
            GuidHelper.ToGuidString(line.PurchaseRequestLineId),
            line.PurchaseRequest.PurchaseRequestCode,
            $"{line.Ingredient.IngredientName} / {line.Supplier.SupplierName}",
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
            nameof(Materialrequest),
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
            nameof(Purchaserequest),
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
            nameof(Materialrequest),
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
            nameof(Purchaserequestline),
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
            nameof(Inventoryissue),
            GuidHelper.ToGuidString(issue.IssueId),
            issue.IssueCode,
            issue.IssueDate.ToString("yyyy-MM-dd"),
            "Phiếu xuất không còn demand/material request gốc.",
            "Kiểm tra lại workflow kho và demand đã sinh.",
            "/warehouse")));

        var sortedIssues = issues
            .OrderBy(issue => issue.PriorityRank)
            .ThenBy(issue => issue.Severity == "error" ? 0 : 1)
            .ThenBy(issue => issue.Category)
            .ThenBy(issue => issue.EntityCode)
            .Take(limit)
            .ToList();

        await ApplyDataQualityRemediationStateAsync(sortedIssues);

        return new DataQualityReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            TotalIssues = sortedIssues.Count,
            ErrorCount = sortedIssues.Count(issue => issue.Severity == "error"),
            WarningCount = sortedIssues.Count(issue => issue.Severity == "warning"),
            ResolvedIssueCount = sortedIssues.Count(issue => issue.RemediationStatus == "resolved"),
            ReopenedIssueCount = sortedIssues.Count(issue => issue.RemediationStatus == "reopened"),
            UrgentIssueCount = sortedIssues.Count(issue => issue.PriorityRank <= 2),
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
        var sourceQuery = CloneQuery(query, 1000);
        var report = await GetDataQualityAsync(sourceQuery);
        var pageItems = report.Issues
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        return new DataQualityPageDto
        {
            GeneratedAt = report.GeneratedAt,
            TotalIssues = report.TotalIssues,
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
        DataQualityIssueRemediationRequestDto request,
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

        _context.Auditlogs.Add(new Auditlog
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
        DataQualityCleanupRequestDto request,
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
                _context.Auditlogs.Add(new Auditlog
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

        if (categories.Contains("stale_purchase_request"))
        {
            var stalePurchaseRequests = await _context.Purchaserequests
                .Include(purchaseRequest => purchaseRequest.Purchaserequestlines)
                    .ThenInclude(line => line.Inventoryreceiptlines)
                .Include(purchaseRequest => purchaseRequest.Purchaserequestlines)
                    .ThenInclude(line => line.Purchaseorderline)
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
                        line.Inventoryreceiptlines.Count > 0 || line.Purchaseorderline is not null))
                {
                    continue;
                }

                AddAction(
                    "stale_purchase_request",
                    nameof(Purchaserequest),
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
                .Include(line => line.Purchaseorderline)
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

                if (line.Inventoryreceiptlines.Count > 0 || line.Purchaseorderline is not null)
                {
                    continue;
                }

                AddAction(
                    "orphan_document",
                    nameof(Purchaserequestline),
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
                    nameof(Inventoryissue),
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
                    nameof(Materialrequest),
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

    public async Task<IReadOnlyList<OrderExportReportRowDto>> GetOrderExportAsync(WorkflowReportQueryDto query)
    {
        var serviceDate = ParseDateOnly(query.ServiceDate) ?? ParseDateOnly(query.DateFrom);
        var shiftName = NormalizeShiftName(query.ShiftName);

        var lines = _context.Mealquantityplanlines
            .AsNoTracking()
            .Include(item => item.QuantityPlan)
            .Include(item => item.Customer)
            .Include(item => item.Menu)
            .Include(item => item.MenuSchedule)
            .AsQueryable();

        if (serviceDate is not null)
        {
            lines = lines.Where(item => item.QuantityPlan.ServiceDate == serviceDate);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            lines = lines.Where(item => item.ShiftName == shiftName);
        }

        return await lines
            .OrderBy(item => item.Customer.CustomerCode)
            .ThenBy(item => item.ShiftName)
            .Take(NormalizeLimit(query.Limit))
            .Select(item => new OrderExportReportRowDto
            {
                QuantityPlanLineId = GuidHelper.ToGuidString(item.QuantityPlanLineId),
                ServiceDate = item.QuantityPlan.ServiceDate,
                ShiftName = item.ShiftName,
                CustomerName = item.Customer.CustomerName,
                MenuName = item.Menu.MenuName,
                ForecastServings = item.ForecastServings,
                ConfirmedServings = item.ConfirmedServings,
                FinalServings = item.FinalServings,
                MenuPrice = item.MenuSchedule.MenuPrice,
                BomRatePercent = item.MenuSchedule.BomRatePercent
            })
            .ToListAsync();
    }

    public async Task<OperationalKpiSummaryDto> GetOperationalKpisAsync()
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
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
                .ThenInclude(line => line.Purchaseorderline)
            .Where(pr => (pr.Status == "DRAFT" || pr.Status == "APPROVED") && pr.PurchaseForDate < today)
            .ToListAsync();

        var overduePurchaseRequestCount = candidateOverdueRequests.Count(pr => pr.Purchaserequestlines.Any(line =>
            line.Purchaseorderline is null ||
            DecimalPolicy.LessThanQuantity(line.Purchaseorderline.ReceivedQty, line.Purchaseorderline.OrderedQty)));

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

        var dataQuality = await GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 200 });

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
            CriticalDataQualityCount = dataQuality.ErrorCount,
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

    private IQueryable<Inventoryissueline> QueryIssueLines(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseGuidString(query.WarehouseId);
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
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

    private async Task<IReadOnlyList<WorkflowDocumentDto>> BuildReceiptDocumentsAsync(
        WorkflowReportQueryDto query,
        int limit)
    {
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var receipts = _context.Inventoryreceipts.AsNoTracking().AsQueryable();

        if (dateFrom is not null)
        {
            receipts = receipts.Where(item => item.ReceiptDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            receipts = receipts.Where(item => item.ReceiptDate <= dateTo);
        }

        return await receipts
            .OrderByDescending(item => item.ReceiptDate)
            .Take(limit)
            .Select(item => new WorkflowDocumentDto
            {
                DocumentId = GuidHelper.ToGuidString(item.ReceiptId),
                DocumentCode = item.ReceiptCode,
                DocumentType = "Phiếu nhập kho",
                DocumentDate = item.ReceiptDate,
                Status = "Đã ghi nhận",
                OwnerLane = "Thủ kho",
                Route = "/warehouse",
                Summary = "Phiếu nhập kho làm tăng tồn kho hiện tại"
            })
            .ToListAsync();
    }

    private async Task<IReadOnlyList<WorkflowDocumentDto>> BuildIssueDocumentsAsync(
        WorkflowReportQueryDto query,
        int limit)
    {
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var issues = _context.Inventoryissues.AsNoTracking().AsQueryable();

        if (dateFrom is not null)
        {
            issues = issues.Where(item => item.IssueDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            issues = issues.Where(item => item.IssueDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            issues = issues.Where(item => item.ShiftName == shiftName);
        }

        return await issues
            .OrderByDescending(item => item.IssueDate)
            .Take(limit)
            .Select(item => new WorkflowDocumentDto
            {
                DocumentId = GuidHelper.ToGuidString(item.IssueId),
                DocumentCode = item.IssueCode,
                DocumentType = "Phiếu xuất kho",
                DocumentDate = item.IssueDate,
                ShiftName = item.ShiftName,
                Status = item.ReceivedAt == null ? "Chờ bếp nhận" : "Bếp đã nhận",
                OwnerLane = item.ReceivedAt == null ? "Bếp trưởng" : "Bếp",
                Route = "/chef",
                Summary = item.ReceivedAt == null
                    ? "Kho đã xuất, chờ bếp xác nhận nhận nguyên liệu"
                    : "Bếp đã xác nhận nhận nguyên liệu từ phiếu xuất"
            })
            .ToListAsync();
    }

    private async Task<IReadOnlyList<WorkflowDocumentDto>> BuildReturnDocumentsAsync(
        WorkflowReportQueryDto query,
        int limit)
    {
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var returns = _context.Inventoryreturns.AsNoTracking().AsQueryable();

        if (dateFrom is not null)
        {
            returns = returns.Where(item => item.ReturnDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            returns = returns.Where(item => item.ReturnDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            returns = returns.Where(item => item.ShiftName == shiftName);
        }

        return await returns
            .OrderByDescending(item => item.ReturnDate)
            .Take(limit)
            .Select(item => new WorkflowDocumentDto
            {
                DocumentId = GuidHelper.ToGuidString(item.ReturnId),
                DocumentCode = item.ReturnCode,
                DocumentType = item.ReturnType == "WASTE" ? "Phiếu hao hụt" : "Phiếu hoàn kho",
                DocumentDate = item.ReturnDate,
                ShiftName = item.ShiftName,
                Status = "Đã ghi nhận",
                OwnerLane = "Bếp trưởng",
                Route = "/chef",
                Summary = item.ReturnType == "WASTE"
                    ? "Hao hụt thực tế sau sản xuất được ghi nhận"
                    : "Nguyên liệu dư được hoàn lại kho"
            })
            .ToListAsync();
    }

    private static KitchenIssueReportDto MapKitchenIssue(Inventoryissueline item)
        => new()
        {
            IssueId = GuidHelper.ToGuidString(item.IssueId),
            IssueCode = item.Issue.IssueCode,
            IssueDate = item.Issue.IssueDate,
            ShiftName = item.Issue.ShiftName,
            WarehouseId = GuidHelper.ToGuidString(item.Issue.WarehouseId),
            WarehouseName = item.Issue.Warehouse.WarehouseName,
            IngredientId = GuidHelper.ToGuidString(item.IngredientId),
            IngredientName = item.Ingredient.IngredientName,
            UnitId = GuidHelper.ToGuidString(item.UnitId),
            UnitName = item.Unit.UnitName,
            RequestedQty = DecimalPolicy.RoundQuantity(item.RequestedQty),
            IssuedQty = DecimalPolicy.RoundQuantity(item.IssuedQty),
            ReceivedBy = item.Issue.ReceivedBy is null ? null : GuidHelper.ToGuidString(item.Issue.ReceivedBy),
            ReceivedByName = item.Issue.ReceivedByNavigation?.FullName,
            ReceivedAt = item.Issue.ReceivedAt,
            IsReceivedByKitchen = item.Issue.ReceivedAt is not null,
            ReceiptStatus = item.Issue.ReceivedAt is null ? "Chờ bếp nhận" : "Bếp đã nhận"
        };

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
            .Where(category => category is not ("orphan_document" or "stale_demand" or "stale_purchase_request"))
            .OrderBy(category => category)
            .ToList();
        if (unsupported.Count > 0)
        {
            throw new ArgumentException($"Data-quality cleanup chỉ hỗ trợ orphan_document, stale_demand, stale_purchase_request. Không hỗ trợ: {string.Join(", ", unsupported)}.");
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
            "missing_bom" or "inactive_bom_ingredient" => "Kitchen Admin",
            "invalid_unit" or "missing_conversion" => "Admin dữ liệu",
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

    private static string BuildUsageKey(byte[] issueId, byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToBase64String(issueId)}|{Convert.ToBase64String(ingredientId)}|{Convert.ToBase64String(unitId)}";

    private static string BuildStockLedgerKey(byte[] warehouseId, byte[] ingredientId)
        => $"{Convert.ToBase64String(warehouseId)}|{Convert.ToBase64String(ingredientId)}";

    private static string BuildStockSnapshotKey(byte[] warehouseId, byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToBase64String(warehouseId)}|{Convert.ToBase64String(ingredientId)}|{Convert.ToBase64String(unitId)}";

    private static Stocksnapshot BuildSnapshotRow(
        IGrouping<string, Stockmovement> movementGroup,
        DateOnly periodMonth,
        DateTime periodStart,
        DateTime periodEnd,
        DateTime generatedAt)
    {
        var orderedMovements = movementGroup
            .OrderBy(item => item.MovementDate)
            .ThenBy(item => Convert.ToBase64String(item.MovementId))
            .ToList();
        var firstMovement = orderedMovements[0];
        var priorMovement = orderedMovements.LastOrDefault(item => item.MovementDate < periodStart);
        var periodMovements = orderedMovements
            .Where(item => item.MovementDate >= periodStart && item.MovementDate < periodEnd)
            .ToList();
        var openingQty = priorMovement?.AfterQty
            ?? periodMovements.FirstOrDefault()?.BeforeQty
            ?? 0m;
        var quantityIn = DecimalPolicy.RoundQuantity(periodMovements.Sum(item => item.QuantityIn));
        var quantityOut = DecimalPolicy.RoundQuantity(periodMovements.Sum(item => item.QuantityOut));
        var closingQty = periodMovements.LastOrDefault()?.AfterQty ?? openingQty;

        return new Stocksnapshot
        {
            SnapshotId = GuidHelper.NewId(),
            WarehouseId = firstMovement.WarehouseId,
            IngredientId = firstMovement.IngredientId,
            UnitId = firstMovement.UnitId,
            PeriodMonth = periodMonth,
            OpeningQty = DecimalPolicy.RoundQuantity(openingQty),
            QuantityIn = quantityIn,
            QuantityOut = quantityOut,
            ClosingQty = DecimalPolicy.RoundQuantity(closingQty),
            GeneratedAt = generatedAt
        };
    }

    private static DateOnly ResolveSnapshotPeriodMonth(WorkflowReportQueryDto query)
    {
        var date = ParseDateOnly(query.ServiceDate)
            ?? ParseDateOnly(query.DateFrom)
            ?? ParseDateOnly(query.DateTo)
            ?? DateOnly.FromDateTime(DateTime.Today);
        return new DateOnly(date.Year, date.Month, 1);
    }

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var date) ? date : null;

    private static decimal NormalizePriceTier(decimal tier)
    {
        var normalized = decimal.Round(tier, 0);
        return normalized switch
        {
            25000m or 30000m or 34000m => normalized,
            _ => throw new ArgumentException("Đơn giá BOM chỉ được là 25000, 30000 hoặc 34000.")
        };
    }

    private static (DateOnly Start, DateOnly End) ResolvePurchasePlanPeriod(DateOnly date, string groupBy)
    {
        if (!string.Equals(groupBy, "week", StringComparison.OrdinalIgnoreCase))
        {
            return (date, date);
        }

        var offset = ((int)date.DayOfWeek + 6) % 7;
        var start = date.AddDays(-offset);
        return (start, start.AddDays(6));
    }

    private static byte[]? ParseCustomerId(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : GuidHelper.ParseGuidString(value);

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

    private static (DateTime DateFrom, DateTime DateToExclusive) ResolveStockMovementWindow(WorkflowReportQueryDto query)
    {
        var dateToExclusive = ParseDateTimeEndExclusive(query.DateTo)
            ?? DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1).ToDateTime(TimeOnly.MinValue);
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
        Func<T, string> getCursorId)
    {
        var items = rows.Take(limit).ToList();
        var hasNext = rows.Count > limit;
        var cursorItem = hasNext ? items.LastOrDefault() : default;

        return new CursorPageDto<T>
        {
            Items = items,
            Limit = limit,
            HasNext = hasNext,
            NextCursorDate = cursorItem is null ? null : getCursorDate(cursorItem).ToString("O"),
            NextCursorId = cursorItem is null ? null : getCursorId(cursorItem)
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
