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

    private static KitchenIssueReportDto MapKitchenIssue(InventoryIssueLine item)
        => new()
        {
            IssueId = GuidHelper.ToGuidString(item.IssueId),
            IssueLineId = GuidHelper.ToGuidString(item.IssueLineId),
            IssueCode = item.Issue.IssueCode,
            IssueDate = item.Issue.IssueDate,
            ShiftName = item.Issue.ShiftName,
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

    private static string BuildUsageKey(byte[] issueId, byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToBase64String(issueId)}|{Convert.ToBase64String(ingredientId)}|{Convert.ToBase64String(unitId)}";

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
