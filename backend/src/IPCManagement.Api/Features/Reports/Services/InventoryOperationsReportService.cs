using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public class InventoryOperationsReportService : IInventoryOperationsReportService
{
    private readonly IpcManagementContext _context;

    public InventoryOperationsReportService(IpcManagementContext context)
    {
        _context = context;
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

        documents.AddRange(await InventoryOperationsDocumentQueries.BuildReceiptDocumentsAsync(_context, query, limit));
        documents.AddRange(await InventoryOperationsDocumentQueries.BuildIssueDocumentsAsync(_context, query, limit));
        documents.AddRange(await InventoryOperationsDocumentQueries.BuildReturnDocumentsAsync(_context, query, limit));

        return documents
            .OrderByDescending(item => item.DocumentDate)
            .ThenBy(item => item.DocumentCode)
            .Take(limit)
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
            .Where(item => item.Return.ReturnType == "RETURN" && item.SourceIssueLineId is not null)
            .GroupBy(item => BuildUsageKey(item.SourceIssueLineId!))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));
        var wasteTotals = returnLines
            .Where(item => item.Return.ReturnType == "WASTE" && item.SourceIssueLineId is not null)
            .GroupBy(item => BuildUsageKey(item.SourceIssueLineId!))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));
        var legacyReturnCounts = returnLines
            .Where(item => item.SourceIssueLineId is null)
            .GroupBy(item => Convert.ToBase64String(item.Return.IssueId))
            .ToDictionary(group => group.Key, group => group.Count());

        return lines
            .Select(item =>
            {
                var returnedQty = returnTotals.GetValueOrDefault(
                    BuildUsageKey(item.IssueLineId),
                    0);
                var wastedQty = wasteTotals.GetValueOrDefault(
                    BuildUsageKey(item.IssueLineId),
                    0);
                var varianceQty = DecimalPolicy.RoundQuantity(returnedQty + wastedQty);

                return new IssueVsReturnUsageReportDto
                {
                    IssueId = GuidHelper.ToGuidString(item.IssueId),
                    IssueLineId = GuidHelper.ToGuidString(item.IssueLineId),
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
                    UsedQty = WorkflowReportCalculator.CalculateUsedQuantity(item.IssuedQty, varianceQty),
                    LegacyUnattributedReturnLineCount = legacyReturnCounts.GetValueOrDefault(Convert.ToBase64String(item.IssueId), 0)
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
            .Where(item => item.Return.ReturnType == "RETURN" && item.SourceIssueLineId is not null)
            .GroupBy(item => BuildUsageKey(item.SourceIssueLineId!))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));
        var wasteTotals = returnLines
            .Where(item => item.Return.ReturnType == "WASTE" && item.SourceIssueLineId is not null)
            .GroupBy(item => BuildUsageKey(item.SourceIssueLineId!))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Quantity));
        var legacyReturnCounts = returnLines
            .Where(item => item.SourceIssueLineId is null)
            .GroupBy(item => Convert.ToBase64String(item.Return.IssueId))
            .ToDictionary(group => group.Key, group => group.Count());

        var items = lines.Select(item =>
        {
            var returnedQty = returnTotals.GetValueOrDefault(BuildUsageKey(item.IssueLineId), 0);
            var wastedQty = wasteTotals.GetValueOrDefault(BuildUsageKey(item.IssueLineId), 0);
            var varianceQty = DecimalPolicy.RoundQuantity(returnedQty + wastedQty);
            return new IssueVsReturnUsageReportDto
            {
                IssueId = GuidHelper.ToGuidString(item.IssueId),
                IssueLineId = GuidHelper.ToGuidString(item.IssueLineId),
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
                UsedQty = WorkflowReportCalculator.CalculateUsedQuantity(item.IssuedQty, varianceQty),
                LegacyUnattributedReturnLineCount = legacyReturnCounts.GetValueOrDefault(Convert.ToBase64String(item.IssueId), 0)
            };
        }).ToList();

        return PagedResponseDto<IssueVsReturnUsageReportDto>.Create(items, totalCount, query.PageNumber, query.PageSize);
    }

    public async Task<IReadOnlyList<SupplyLineReconciliationDto>> GetSupplyLineReconciliationAsync(WorkflowReportQueryDto query)
    {
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var limit = NormalizeLimit(query.Limit);
        var demandLines = _context.Materialrequestlines
            .AsNoTracking()
            .Include(line => line.Request)
            .Include(line => line.Ingredient)
            .Include(line => line.Unit)
            .AsQueryable();
        if (dateFrom is not null) demandLines = demandLines.Where(line => line.Request.RequestDate >= dateFrom);
        if (dateTo is not null) demandLines = demandLines.Where(line => line.Request.RequestDate <= dateTo);
        var lines = await demandLines
            .OrderByDescending(line =>
                _context.Inventoryissuelines.Any(issueLine =>
                    issueLine.MaterialRequestLineId == null &&
                    issueLine.Issue.MaterialRequestId.SequenceEqual(line.RequestId) &&
                    issueLine.IngredientId.SequenceEqual(line.IngredientId) &&
                    issueLine.UnitId.SequenceEqual(line.UnitId)) ||
                _context.Inventoryreturnlines.Any(returnLine =>
                    returnLine.SourceIssueLineId == null &&
                    returnLine.Return.Issue.MaterialRequestId.SequenceEqual(line.RequestId) &&
                    returnLine.IngredientId.SequenceEqual(line.IngredientId) &&
                    returnLine.UnitId.SequenceEqual(line.UnitId)))
            .ThenByDescending(line => line.Request.RequestDate)
            .ThenBy(line => line.RequestLineId)
            .Take(limit)
            .ToListAsync();
        if (lines.Count == 0) return [];

        // Load once, then join by immutable IDs in memory. EF byte[] equality is
        // provider-sensitive; converting to a stable key prevents the report
        // layer from accidentally falling back to an ingredient/header join.
        var purchaseLines = await _context.Purchaserequestlines.AsNoTracking().ToListAsync();
        var orderLines = await _context.Purchaseorderlines
            .AsNoTracking().Include(line => line.PurchaseOrder).ToListAsync();
        var receiptLines = await _context.Inventoryreceiptlines
            .AsNoTracking().Include(line => line.Receipt).ToListAsync();
        var issueLines = await _context.Inventoryissuelines
            .AsNoTracking().Include(line => line.Issue).ToListAsync();
        var returnLines = await _context.Inventoryreturnlines
            .AsNoTracking().Include(line => line.Return).ThenInclude(@return => @return.Issue).ToListAsync();
        var lineageDispositions = await _context.Legacylinedispositions
            .AsNoTracking()
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();
        var supplements = await _context.Supplementalmaterialrequests.AsNoTracking().ToListAsync();
        var supplementalPurchaseAudits = await _context.Auditlogs
            .AsNoTracking()
            .Where(audit => audit.EntityName == nameof(SupplementalMaterialRequest) && audit.FieldName == "PurchaseRequestId")
            .ToListAsync();
        var supplementalMovements = await _context.Stockmovements
            .AsNoTracking()
            .Where(movement => movement.RefTable == "supplementalmaterialrequests")
            .ToListAsync();

        return lines.Select(line =>
        {
            var lineKey = BuildUsageKey(line.RequestLineId);
            var sourcePurchaseLines = purchaseLines
                .Where(item => BuildUsageKey(item.MaterialRequestLineId) == lineKey)
                .ToList();
            var purchaseLineKeys = sourcePurchaseLines.Select(item => BuildUsageKey(item.PurchaseRequestLineId)).ToHashSet();
            var sourceOrderLines = orderLines.Where(item => purchaseLineKeys.Contains(BuildUsageKey(item.PurchaseRequestLineId))).ToList();
            var sourceIssueLines = issueLines
                .Where(item => item.MaterialRequestLineId is not null && BuildUsageKey(item.MaterialRequestLineId) == lineKey)
                .ToList();
            var sourceIssueLineKeys = sourceIssueLines.Select(item => BuildUsageKey(item.IssueLineId)).ToHashSet();
            var sourceSupplements = supplements.Where(item => sourceIssueLineKeys.Contains(BuildUsageKey(item.IssueLineId))).ToList();
            var supplementKeys = sourceSupplements.Select(item => BuildUsageKey(item.RequestId)).ToHashSet();
            var supplementalPurchaseRequestKeys = supplementalPurchaseAudits
                .Where(audit => audit.EntityId is not null && supplementKeys.Contains(BuildUsageKey(audit.EntityId)))
                .Select(audit => GuidHelper.ParseGuidString(audit.NewValue))
                .Where(id => id is not null)
                .Select(id => BuildUsageKey(id!))
                .ToHashSet();
            var sourceReturns = returnLines
                .Where(item => item.SourceIssueLineId is not null && sourceIssueLineKeys.Contains(BuildUsageKey(item.SourceIssueLineId)))
                .ToList();
            var legacyIssueCount = issueLines.Count(item => item.MaterialRequestLineId is null &&
                item.Issue.MaterialRequestId.SequenceEqual(line.RequestId) &&
                item.IngredientId.SequenceEqual(line.IngredientId) && item.UnitId.SequenceEqual(line.UnitId));
            var legacyReturnCount = returnLines.Count(item => item.SourceIssueLineId is null &&
                item.Return.Issue.MaterialRequestId.SequenceEqual(line.RequestId) &&
                item.IngredientId.SequenceEqual(line.IngredientId) && item.UnitId.SequenceEqual(line.UnitId));
            var legacyDispositionRows = issueLines
                .Where(item => item.MaterialRequestLineId is null &&
                    item.Issue.MaterialRequestId.SequenceEqual(line.RequestId) &&
                    item.IngredientId.SequenceEqual(line.IngredientId) && item.UnitId.SequenceEqual(line.UnitId))
                .Select(item => MapLegacyDispositionReport("ISSUE_LINE", item.IssueLineId, lineageDispositions))
                .Concat(returnLines
                    .Where(item => item.SourceIssueLineId is null &&
                        item.Return.Issue.MaterialRequestId.SequenceEqual(line.RequestId) &&
                        item.IngredientId.SequenceEqual(line.IngredientId) && item.UnitId.SequenceEqual(line.UnitId))
                    .Select(item => MapLegacyDispositionReport("RETURN_LINE", item.ReturnLineId, lineageDispositions)))
                .OrderBy(item => item.LegacyLineType)
                .ThenBy(item => item.LegacyLineId)
                .ToList();
            var receiptQty = receiptLines
                .Where(item => item.PurchaseRequestLineId is not null && purchaseLineKeys.Contains(BuildUsageKey(item.PurchaseRequestLineId)) && item.Receipt.Status == "POSTED")
                .Sum(item => item.AcceptedQuantity ?? item.Quantity);
            var issuedQty = sourceIssueLines.Sum(item => item.IssuedQty);
            var acknowledgedQty = sourceIssueLines.Where(item => item.Issue.ReceivedAt is not null).Sum(item => item.IssuedQty);
            var returnedQty = sourceReturns.Where(item => item.Return.ReturnType == "RETURN").Sum(item => item.Quantity);
            var wastedQty = sourceReturns.Where(item => item.Return.ReturnType == "WASTE").Sum(item => item.Quantity);
            var supplementalFulfilledQty = supplementalMovements
                .Where(item => item.RefId is not null && supplementKeys.Contains(BuildUsageKey(item.RefId)))
                .Sum(item => item.QuantityOut);
            var delta = DecimalPolicy.RoundQuantity(line.TotalRequiredQty - acknowledgedQty + returnedQty);
            var legacyCount = legacyIssueCount + legacyReturnCount;
            return new SupplyLineReconciliationDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(line.RequestId),
                MaterialRequestLineId = GuidHelper.ToGuidString(line.RequestLineId),
                MaterialRequestCode = line.Request.RequestCode,
                RequestDate = line.Request.RequestDate,
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                IngredientName = line.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(line.UnitId),
                UnitName = line.Unit.UnitName,
                DemandQty = DecimalPolicy.RoundQuantity(line.TotalRequiredQty),
                PurchaseRequestAllocatedQty = DecimalPolicy.RoundQuantity(sourcePurchaseLines.Sum(item => item.PurchaseQty)),
                PurchaseOrderAllocatedQty = DecimalPolicy.RoundQuantity(sourceOrderLines.Where(item => item.PurchaseOrder.Status != "CANCELLED").Sum(item => item.OrderedQty)),
                PostedAcceptedReceiptQty = DecimalPolicy.RoundQuantity(receiptQty),
                IssuedQty = DecimalPolicy.RoundQuantity(issuedQty),
                KitchenAcknowledgedQty = DecimalPolicy.RoundQuantity(acknowledgedQty),
                ReturnedQty = DecimalPolicy.RoundQuantity(returnedQty),
                WastedQty = DecimalPolicy.RoundQuantity(wastedQty),
                SupplementalRequestedQty = DecimalPolicy.RoundQuantity(sourceSupplements.Sum(item => item.RequestedQty)),
                SupplementalFulfilledQty = DecimalPolicy.RoundQuantity(supplementalFulfilledQty),
                SupplementalPurchaseAllocatedQty = DecimalPolicy.RoundQuantity(sourcePurchaseLines
                    .Where(item => supplementalPurchaseRequestKeys.Contains(BuildUsageKey(item.PurchaseRequestId)))
                    .Sum(item => item.PurchaseQty)),
                DeltaQty = delta,
                LegacyLineageExceptionCount = legacyCount,
                LegacyLineageDispositions = legacyDispositionRows,
                Disposition = ResolveReconciliationDisposition(legacyCount, delta, acknowledgedQty, issuedQty, sourceSupplements, legacyDispositionRows)
            };
        }).ToList();
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
            .Include(item => item.MaterialRequestLine!)
                .ThenInclude(item => item.PlanLine)
                    .ThenInclude(item => item.Customer)
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
            lines = lines.Where(item =>
                item.MaterialRequestLine != null
                    ? item.MaterialRequestLine.PlanLine.ShiftName == shiftName
                    : item.Issue.ShiftName == shiftName);
        }

        return lines;
    }

    private static KitchenIssueReportDto MapKitchenIssue(InventoryIssueLine item)
        => new()
        {
            IssueId = GuidHelper.ToGuidString(item.IssueId),
            IssueLineId = GuidHelper.ToGuidString(item.IssueLineId),
            IssueCode = item.Issue.IssueCode,
            IssueDate = item.Issue.IssueDate,
            ShiftName = item.Issue.ShiftName,
            SourceCustomerName = item.MaterialRequestLine?.PlanLine.Customer.CustomerName,
            SourceShiftName = item.MaterialRequestLine?.PlanLine.ShiftName,
            SourcePriceTierAmount = item.MaterialRequestLine?.PriceTierAmount,
            WarehouseId = GuidHelper.ToGuidString(item.Issue.WarehouseId),
            WarehouseName = item.Issue.Warehouse.WarehouseName,
            MaterialRequestId = GuidHelper.ToGuidString(item.Issue.MaterialRequestId),
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

    private static string BuildUsageKey(byte[] issueLineId)
        => Convert.ToBase64String(issueLineId);

    private static string ResolveReconciliationDisposition(
        int legacyExceptionCount,
        decimal deltaQty,
        decimal acknowledgedQty,
        decimal issuedQty,
        IReadOnlyCollection<SupplementalMaterialRequest> supplements,
        IReadOnlyCollection<LegacyLineageDispositionReportDto> legacyDispositions)
    {
        if (legacyExceptionCount > 0)
        {
            if (legacyDispositions.Count < legacyExceptionCount) return "LEGACY_DISPOSITION_PARTIAL";
            if (legacyDispositions.Any(item => item.Status == "PENDING_MANAGER_REVIEW")) return "LEGACY_DISPOSITION_PENDING_MANAGER_REVIEW";
            if (legacyDispositions.Any(item => item.Status == "APPROVED")) return "LEGACY_DISPOSITION_APPROVED_AWAITING_APPLY";
            if (legacyDispositions.Any(item => item.Status == "REJECTED")) return "LEGACY_DISPOSITION_REJECTED";
            return "LEGACY_LINEAGE_RECONCILIATION_REQUIRED";
        }
        if (supplements.Any(item => item.Status is not "REJECTED" and not "FULFILLED")) return "SUPPLEMENTAL_OPEN";
        if (acknowledgedQty < issuedQty) return "KITCHEN_ACK_PENDING";
        if (deltaQty > 0) return "DEMAND_REMAINING";
        if (deltaQty < 0) return "OVER_ISSUED_RECONCILIATION_REQUIRED";
        return "MATCHED";
    }

    private static LegacyLineageDispositionReportDto MapLegacyDispositionReport(
        string legacyLineType,
        byte[] legacyLineId,
        IReadOnlyCollection<LegacyLineageDisposition> dispositions)
    {
        var match = dispositions.FirstOrDefault(item =>
            item.LegacyLineType == legacyLineType && item.LegacyLineId.SequenceEqual(legacyLineId));
        return new LegacyLineageDispositionReportDto
        {
            LegacyLineType = legacyLineType,
            LegacyLineId = GuidHelper.ToGuidString(legacyLineId),
            DispositionId = match is null ? null : GuidHelper.ToGuidString(match.DispositionId),
            Status = match?.Status ?? "UNDISPOSITIONED",
            TargetLineId = match is null
                ? null
                : ToOptionalGuidString(legacyLineType == "ISSUE_LINE"
                    ? match.TargetMaterialRequestLineId
                    : match.TargetIssueLineId),
            Reason = match?.Reason,
            ReviewReason = match?.ReviewReason,
            Version = match?.Version,
        };
    }

    private static string? ToOptionalGuidString(byte[]? value)
        => value is null ? null : GuidHelper.ToGuidString(value);

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var parsed) ? parsed : null;

    private static byte[]? ParseCustomerId(string? value)
        => GuidHelper.ParseFilterIdOrThrow(value, "khách hàng");

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
