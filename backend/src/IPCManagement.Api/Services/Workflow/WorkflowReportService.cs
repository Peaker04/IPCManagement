using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Workflow;

public class WorkflowReportService : IWorkflowReportService
{
    private readonly IpcManagementContext _context;

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

    public async Task<IReadOnlyList<WorkflowDocumentDto>> GetWorkflowDocumentsAsync(WorkflowReportQueryDto query)
    {
        var limit = NormalizeLimit(query.Limit);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var documents = new List<WorkflowDocumentDto>();

        var materialRequests = _context.Materialrequests.AsNoTracking().AsQueryable();
        if (dateFrom is not null)
        {
            materialRequests = materialRequests.Where(item => item.RequestDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            materialRequests = materialRequests.Where(item => item.RequestDate <= dateTo);
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

        var purchaseRequests = _context.Purchaserequests.AsNoTracking().AsQueryable();
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
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Purchaserequestlines
            .AsNoTracking()
            .Include(item => item.PurchaseRequest)
            .Include(item => item.Ingredient)
            .Include(item => item.Supplier)
            .Include(item => item.Unit)
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

        var purchaseLines = await lines
            .OrderByDescending(item => item.PurchaseRequest.PurchaseForDate)
            .ThenBy(item => item.Supplier.SupplierName)
            .Take(NormalizeLimit(query.Limit))
            .ToListAsync();

        return purchaseLines
            .Select(item => new PurchaseDemandReportDto
            {
                PurchaseRequestId = GuidHelper.ToGuidString(item.PurchaseRequestId),
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
                EstimatedAmount = DecimalPolicy.CalculateLineAmount(item.PurchaseQty, item.EstimatedUnitPrice)
            })
            .ToList();
    }

    public async Task<IReadOnlyList<ReceiptPriceVarianceReportDto>> GetReceiptPriceVarianceAsync(WorkflowReportQueryDto query)
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

        var receiptLines = await lines
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
            .GroupBy(item => BuildUsageKey(item.Return.IssueId, item.IngredientId, item.UnitId))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));

        return lines
            .Select(item =>
            {
                var returnedQty = returnTotals.GetValueOrDefault(
                    BuildUsageKey(item.IssueId, item.IngredientId, item.UnitId),
                    0);

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
                    UsedQty = WorkflowReportCalculator.CalculateUsedQuantity(item.IssuedQty, returnedQty)
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
                BusinessArea = item.BusinessArea,
                EntityName = item.EntityName,
                EntityId = item.EntityId == null ? null : GuidHelper.ToGuidString(item.EntityId),
                FieldName = item.FieldName,
                OldValue = item.OldValue,
                NewValue = item.NewValue,
                Reason = item.Reason
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
            .Concat(quantityRows)
            .Concat(bomRows)
            .OrderByDescending(item => item.ChangedAt)
            .Take(limit)
            .ToList();
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
                Status = "Đã ghi nhận",
                OwnerLane = "Thủ kho",
                Route = "/warehouse",
                Summary = "Phiếu xuất kho theo danh sách nguyên liệu đã duyệt"
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
                DocumentType = "Phiếu hoàn kho",
                DocumentDate = item.ReturnDate,
                ShiftName = item.ShiftName,
                Status = "Đã ghi nhận",
                OwnerLane = "Bếp trưởng",
                Route = "/chef",
                Summary = "Nguyên liệu dư được hoàn lại kho"
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
            IssuedQty = DecimalPolicy.RoundQuantity(item.IssuedQty)
        };

    private static string BuildUsageKey(byte[] issueId, byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToBase64String(issueId)}|{Convert.ToBase64String(ingredientId)}|{Convert.ToBase64String(unitId)}";

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var date) ? date : null;

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
