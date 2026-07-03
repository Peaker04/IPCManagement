using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Workflow;

public class WorkflowReportService : IWorkflowReportService
{
    private const int LateReceiptThresholdDays = 3;

    private readonly IpcManagementContext _context;
    private const string PublishedBomStatus = "PUBLISHED";

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

    public async Task<IReadOnlyList<StockMovementViewDto>> GetStockMovementsAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseGuidString(query.WarehouseId);
        var ingredientId = GuidHelper.ParseGuidString(query.IngredientId);
        var dateFrom = ParseDateTimeStart(query.DateFrom);
        var dateToExclusive = ParseDateTimeEndExclusive(query.DateTo);

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

        if (dateFrom is not null)
        {
            movements = movements.Where(item => item.MovementDate >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            movements = movements.Where(item => item.MovementDate < dateToExclusive);
        }

        return await movements
            .OrderByDescending(item => item.MovementDate)
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
                RefTable = item.RefTable,
                RefId = item.RefId == null ? null : GuidHelper.ToGuidString(item.RefId),
                Reason = item.Reason,
                Note = item.Note
            })
            .ToListAsync();
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
            .Take(NormalizeLimit(query.Limit))
            .ToList();
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

        return result.Take(NormalizeLimit(query.Limit)).ToList();
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
            .Take(NormalizeLimit(query.Limit))
            .ToList();
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

    public async Task<IReadOnlyList<AuditChangeReportDto>> GetAuditChangesAsync(WorkflowReportQueryDto query)
    {
        var dateFrom = ParseDateTimeStart(query.DateFrom);
        var dateToExclusive = ParseDateTimeEndExclusive(query.DateTo);
        var limit = NormalizeLimit(query.Limit);

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

        var auditRows = await changes
            .OrderByDescending(item => item.ChangedAt)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.AuditId),
                ChangedAt = item.ChangedAt,
                ChangedBy = GuidHelper.ToGuidString(item.ChangedBy),
                ChangedByName = item.ChangedByNavigation.FullName,
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

        var importRows = await importBatches
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.ImportBatchId),
                ChangedAt = item.ImportedAt,
                ChangedBy = item.ImportedBy == null ? string.Empty : GuidHelper.ToGuidString(item.ImportedBy),
                ChangedByName = item.ImportedByNavigation == null ? null : item.ImportedByNavigation.FullName,
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

        var menuImportVersions = await menuImports
            .OrderByDescending(item => item.CreatedAt)
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
                    ChangedByName = !string.IsNullOrWhiteSpace(actorId) && menuImportActors.TryGetValue(actorId, out var actorName) ? actorName : null,
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

        var approvalRows = await approvals
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.ApprovalHistoryId),
                ChangedAt = item.ActionAt,
                ChangedBy = GuidHelper.ToGuidString(item.ActionBy),
                ChangedByName = item.ActionByNavigation.FullName,
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

        var receiptRows = await receipts
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.ReceiptId),
                ChangedAt = item.CreatedAt,
                ChangedBy = GuidHelper.ToGuidString(item.CreatedBy),
                ChangedByName = item.CreatedByNavigation.FullName,
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

        var issueRows = await issues
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.IssueId),
                ChangedAt = item.CreatedAt,
                ChangedBy = GuidHelper.ToGuidString(item.IssuedBy),
                ChangedByName = item.IssuedByNavigation.FullName,
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

        var quantityRows = await quantityAdjustments
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.AdjustmentId),
                ChangedAt = item.AdjustedAt,
                ChangedBy = GuidHelper.ToGuidString(item.AdjustedBy),
                ChangedByName = item.AdjustedByNavigation.FullName,
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

        var bomRows = await bomAdjustments
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.BomAdjustmentId),
                ChangedAt = item.AdjustedAt,
                ChangedBy = GuidHelper.ToGuidString(item.AdjustedBy),
                ChangedByName = item.AdjustedByNavigation.FullName,
                BusinessArea = "BOM",
                EntityName = item.Bom.Dish.DishName,
                EntityId = GuidHelper.ToGuidString(item.BomId),
                FieldName = item.Bom.Ingredient.IngredientName,
                OldValue = $"{item.OldGrossQtyPerServing} / hao hụt {item.OldWasteRatePercent}%",
                NewValue = $"{item.NewGrossQtyPerServing} / hao hụt {item.NewWasteRatePercent}%",
                Reason = item.Reason
            })
            .ToListAsync();

        return auditRows
            .Concat(importRows)
            .Concat(menuImportRows)
            .Concat(approvalRows)
            .Concat(receiptRows)
            .Concat(issueRows)
            .Concat(quantityRows)
            .Concat(bomRows)
            .OrderByDescending(item => item.ChangedAt)
            .Take(limit)
            .ToList();
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
            "Mở Quản trị dữ liệu > Điều chỉnh để thêm BOM.",
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
            .OrderBy(issue => issue.Severity == "error" ? 0 : 1)
            .ThenBy(issue => issue.Category)
            .ThenBy(issue => issue.EntityCode)
            .Take(limit)
            .ToList();

        return new DataQualityReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            TotalIssues = sortedIssues.Count,
            ErrorCount = sortedIssues.Count(issue => issue.Severity == "error"),
            WarningCount = sortedIssues.Count(issue => issue.Severity == "warning"),
            MissingBomCount = sortedIssues.Count(issue => issue.Category == "missing_bom"),
            InvalidUnitCount = sortedIssues.Count(issue => issue.Category is "invalid_unit" or "inactive_bom_ingredient"),
            MissingConversionCount = sortedIssues.Count(issue => issue.Category == "missing_conversion"),
            NegativeStockCount = sortedIssues.Count(issue => issue.Category == "negative_stock"),
            OrphanDocumentCount = sortedIssues.Count(issue => issue.Category == "orphan_document"),
            Issues = sortedIssues
        };
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
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var demandWindowStart = today.AddDays(-7);
        var lateReceiptCutoff = today.AddDays(-LateReceiptThresholdDays);

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

        var lowStockCount = await ComputeLowStockCountAsync(demandWindowStart, today);

        return new OperationalKpiSummaryDto
        {
            ShortageCount = shortageCount,
            LowStockCount = lowStockCount,
            OverduePurchaseRequestCount = overduePurchaseRequestCount,
            LateReceiptCount = lateReceiptCount,
            PendingKitchenConfirmationCount = pendingKitchenConfirmationCount,
            GeneratedAt = DateTime.UtcNow
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
        => new()
        {
            IssueId = $"{category}:{entityName}:{entityId ?? entityCode}",
            Category = category,
            Severity = severity,
            EntityName = entityName,
            EntityId = entityId,
            EntityCode = entityCode,
            EntityLabel = entityLabel,
            Message = message,
            SuggestedAction = suggestedAction,
            Route = route
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

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var date) ? date : null;

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

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

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
