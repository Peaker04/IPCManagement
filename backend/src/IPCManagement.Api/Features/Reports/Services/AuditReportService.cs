using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public class AuditReportService : IAuditReportService
{
    private readonly IpcManagementContext _context;

    public AuditReportService(IpcManagementContext context)
    {
        _context = context;
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

    public async Task<ReportFileContent> ExportAuditChangesCsvAsync(WorkflowReportQueryDto query)
    {
        query.Limit = 1000;
        var rows = await GetAuditChangesAsync(query);
        var generatedAt = DateTime.Now;
        return new ReportFileContent(
            AuditCsvExporter.Build(rows),
            "text/csv",
            $"audit-log-{generatedAt:yyyyMMddHHmmss}.csv");
    }

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

    private static DateTime? ResolveCursorBoundary(DateTime? cursorDate, int? cursorOffset, bool ascending)
    {
        if (cursorDate is null || cursorOffset is null) return cursorDate;

        return ascending
            ? cursorDate.Value > DateTime.MinValue ? cursorDate.Value.AddTicks(-1) : cursorDate
            : cursorDate.Value < DateTime.MaxValue ? cursorDate.Value.AddTicks(1) : cursorDate;
    }

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

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
}
