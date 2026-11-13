using System.Runtime.CompilerServices;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal sealed class MrxTransactionHistoryQuery(IpcManagementContext context)
{
    internal async Task<PagedResponseDto<MrxTransactionHistoryRowDto>> GetPageAsync(
        byte[]? batchId,
        DateOnly? fromDate,
        DateOnly? toDate,
        PagedRequestDto page,
        CancellationToken token)
    {
        var (issueLines, returnLines) = FilterLines(batchId, fromDate, toDate);
        var total = await issueLines.CountAsync(token) + await returnLines.CountAsync(token);
        if (total == 0)
        {
            return PagedResponseDto<MrxTransactionHistoryRowDto>.Create([], 0, page.PageNumber, page.PageSize);
        }

        var baseQuery = BuildBaseQuery(issueLines, returnLines);
        var baseRows = await Order(baseQuery)
            .Skip((page.PageNumber - 1) * page.PageSize)
            .Take(page.PageSize)
            .ToListAsync(token);

        var dtos = await EnrichAndMapAsync(baseRows, token);
        return PagedResponseDto<MrxTransactionHistoryRowDto>.Create(dtos, total, page.PageNumber, page.PageSize);
    }

    internal async IAsyncEnumerable<MrxTransactionHistoryRowDto> StreamAsync(
        byte[]? batchId,
        DateOnly? fromDate,
        DateOnly? toDate,
        [EnumeratorCancellation] CancellationToken token)
    {
        var (issueLines, returnLines) = FilterLines(batchId, fromDate, toDate);
        var baseQuery = Order(BuildBaseQuery(issueLines, returnLines));
        var buffer = new List<BaseRow>(250);

        await foreach (var row in baseQuery.AsAsyncEnumerable().WithCancellation(token))
        {
            buffer.Add(row);
            if (buffer.Count >= 250)
            {
                foreach (var dto in await EnrichAndMapAsync(buffer, token))
                {
                    yield return dto;
                }
                buffer.Clear();
            }
        }

        if (buffer.Count > 0)
        {
            foreach (var dto in await EnrichAndMapAsync(buffer, token))
            {
                yield return dto;
            }
        }
    }

    private (IQueryable<InventoryIssueLine> IssueLines, IQueryable<InventoryReturnLine> ReturnLines) FilterLines(
        byte[]? batchId,
        DateOnly? fromDate,
        DateOnly? toDate)
    {
        var issueLines = context.Inventoryissuelines.AsNoTracking()
            .Where(line => line.Issue.ReconciliationBatchId != null);
        var returnLines = context.Inventoryreturnlines.AsNoTracking()
            .Where(line => line.Return.Issue.ReconciliationBatchId != null);

        if (batchId is not null)
        {
            issueLines = issueLines.Where(line => line.Issue.ReconciliationBatchId == batchId);
            returnLines = returnLines.Where(line => line.Return.Issue.ReconciliationBatchId == batchId);
        }
        if (fromDate is not null)
        {
            issueLines = issueLines.Where(line => line.Issue.IssueDate >= fromDate.Value);
            returnLines = returnLines.Where(line => line.Return.ReturnDate >= fromDate.Value);
        }
        if (toDate is not null)
        {
            issueLines = issueLines.Where(line => line.Issue.IssueDate <= toDate.Value);
            returnLines = returnLines.Where(line => line.Return.ReturnDate <= toDate.Value);
        }

        return (issueLines, returnLines);
    }

    private static IQueryable<BaseRow> BuildBaseQuery(
        IQueryable<InventoryIssueLine> issueLines,
        IQueryable<InventoryReturnLine> returnLines)
    {
        var issues = issueLines.Select(line => new BaseRow
        {
            IsReturn = false,
            DocumentCode = line.Issue.IssueCode,
            Date = line.Issue.IssueDate,
            BatchId = line.Issue.ReconciliationBatchId!,
            IngredientCode = line.Ingredient.IngredientCode,
            IngredientName = line.Ingredient.IngredientName,
            UnitName = line.Unit.UnitName,
            Quantity = line.IssuedQty,
            ActorName = line.Issue.IssuedByNavigation.FullName,
            CreatedAt = line.Issue.CreatedAt,
            StaticReason = null,
            LineId = line.IssueLineId
        });

        var returns = returnLines.Select(line => new BaseRow
        {
            IsReturn = true,
            DocumentCode = line.Return.ReturnCode,
            Date = line.Return.ReturnDate,
            BatchId = line.Return.Issue.ReconciliationBatchId!,
            IngredientCode = line.Ingredient.IngredientCode,
            IngredientName = line.Ingredient.IngredientName,
            UnitName = line.Unit.UnitName,
            Quantity = line.Quantity,
            ActorName = line.Return.CreatedByNavigation.FullName,
            CreatedAt = line.Return.CreatedAt,
            StaticReason = line.Return.Reason,
            LineId = line.ReturnLineId
        });

        return issues.Concat(returns);
    }

    private static IOrderedQueryable<BaseRow> Order(IQueryable<BaseRow> query) => query
        .OrderByDescending(row => row.CreatedAt)
        .ThenBy(row => row.DocumentCode)
        .ThenBy(row => row.LineId);

    private async Task<IReadOnlyList<MrxTransactionHistoryRowDto>> EnrichAndMapAsync(
        IReadOnlyList<BaseRow> rows,
        CancellationToken token)
    {
        if (rows.Count == 0) return [];

        var inMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);

        // 1. Batch-load CustomerName by BatchId -> MenuVersionId -> Customer
        var distinctBatchIds = rows.Select(r => r.BatchId).DistinctBy(Convert.ToHexString).ToList();
        var batchHexSet = distinctBatchIds.Select(Convert.ToHexString).ToHashSet(StringComparer.Ordinal);
        var batches = inMemory
            ? (await context.Reconciliationbatches.AsNoTracking()
                .Select(b => new { b.BatchId, b.MenuVersionId })
                .ToListAsync(token))
                .Where(b => batchHexSet.Contains(Convert.ToHexString(b.BatchId)))
                .ToList()
            : await context.Reconciliationbatches.AsNoTracking()
                .Where(b => distinctBatchIds.Contains(b.BatchId))
                .Select(b => new { b.BatchId, b.MenuVersionId })
                .ToListAsync(token);

        var customerByBatchHex = new Dictionary<string, string?>(StringComparer.Ordinal);
        if (batches.Count > 0)
        {
            var mvIds = batches.Select(b => b.MenuVersionId).DistinctBy(Convert.ToHexString).ToList();
            var mvHexSet = mvIds.Select(Convert.ToHexString).ToHashSet(StringComparer.Ordinal);
            var menuVersions = inMemory
                ? (await context.Menuversions.AsNoTracking()
                    .Include(mv => mv.Customer)
                    .ToListAsync(token))
                    .Where(mv => mvHexSet.Contains(Convert.ToHexString(mv.MenuVersionId)))
                    .ToDictionary(mv => Convert.ToHexString(mv.MenuVersionId), mv => mv.Customer?.CustomerName, StringComparer.Ordinal)
                : await context.Menuversions.AsNoTracking()
                    .Where(mv => mvIds.Contains(mv.MenuVersionId))
                    .Select(mv => new { mv.MenuVersionId, CustomerName = mv.Customer != null ? mv.Customer.CustomerName : null })
                    .ToDictionaryAsync(mv => Convert.ToHexString(mv.MenuVersionId), mv => mv.CustomerName, StringComparer.Ordinal, token);

            foreach (var b in batches)
            {
                menuVersions.TryGetValue(Convert.ToHexString(b.MenuVersionId), out var custName);
                customerByBatchHex[Convert.ToHexString(b.BatchId)] = custName;
            }
        }

        // 2. Batch-load earliest Issue.CreatedAt per (ReconciliationBatchId, IssueDate) & latest AuditLog.Reason for issue lines
        var issueRows = rows.Where(r => !r.IsReturn).ToList();
        var minIssueCreatedAtByBatchDate = new Dictionary<(string BatchHex, DateOnly Date), DateTime>();
        var issueReasonByLineHex = new Dictionary<string, string?>(StringComparer.Ordinal);

        if (issueRows.Count > 0)
        {
            var issueBatchIds = issueRows.Select(r => r.BatchId).DistinctBy(Convert.ToHexString).ToList();
            var issueBatchHexSet = issueBatchIds.Select(Convert.ToHexString).ToHashSet(StringComparer.Ordinal);
            var issueDates = issueRows.Select(r => r.Date).Distinct().ToList();

            var batchIssues = inMemory
                ? (await context.Inventoryissues.AsNoTracking()
                    .Where(i => i.ReconciliationBatchId != null && issueDates.Contains(i.IssueDate))
                    .Select(i => new { BatchId = i.ReconciliationBatchId!, i.IssueDate, i.CreatedAt })
                    .ToListAsync(token))
                    .Where(i => issueBatchHexSet.Contains(Convert.ToHexString(i.BatchId)))
                    .ToList()
                : await context.Inventoryissues.AsNoTracking()
                    .Where(i => i.ReconciliationBatchId != null
                        && issueBatchIds.Contains(i.ReconciliationBatchId)
                        && issueDates.Contains(i.IssueDate))
                    .Select(i => new { BatchId = i.ReconciliationBatchId!, i.IssueDate, i.CreatedAt })
                    .ToListAsync(token);

            foreach (var group in batchIssues.GroupBy(i => (Convert.ToHexString(i.BatchId), i.IssueDate)))
            {
                minIssueCreatedAtByBatchDate[group.Key] = group.Min(i => i.CreatedAt);
            }

            var issueLineIds = issueRows.Select(r => r.LineId).DistinctBy(Convert.ToHexString).ToList();
            var issueLineHexSet = issueLineIds.Select(Convert.ToHexString).ToHashSet(StringComparer.Ordinal);
            var audits = inMemory
                ? (await context.Auditlogs.AsNoTracking()
                    .Where(a => a.EntityId != null
                        && a.EntityName == nameof(InventoryIssueLine)
                        && a.FieldName == nameof(InventoryIssueLine.IssuedQty))
                    .Select(a => new { EntityId = a.EntityId!, a.ChangedAt, a.Reason })
                    .ToListAsync(token))
                    .Where(a => issueLineHexSet.Contains(Convert.ToHexString(a.EntityId)))
                    .ToList()
                : await context.Auditlogs.AsNoTracking()
                    .Where(a => a.EntityId != null
                        && a.EntityName == nameof(InventoryIssueLine)
                        && a.FieldName == nameof(InventoryIssueLine.IssuedQty)
                        && issueLineIds.Contains(a.EntityId))
                    .Select(a => new { EntityId = a.EntityId!, a.ChangedAt, a.Reason })
                    .ToListAsync(token);

            foreach (var group in audits.GroupBy(a => Convert.ToHexString(a.EntityId), StringComparer.Ordinal))
            {
                issueReasonByLineHex[group.Key] = group.OrderByDescending(a => a.ChangedAt).First().Reason;
            }
        }

        var result = new List<MrxTransactionHistoryRowDto>(rows.Count);
        foreach (var row in rows)
        {
            var batchHex = Convert.ToHexString(row.BatchId);
            customerByBatchHex.TryGetValue(batchHex, out var customerName);

            string transactionType;
            string? reason;
            if (row.IsReturn)
            {
                transactionType = "PHYSICAL_RETURN";
                reason = row.StaticReason;
            }
            else
            {
                var hasEarlierIssue = minIssueCreatedAtByBatchDate.TryGetValue((batchHex, row.Date), out var minCreated)
                    && minCreated < row.CreatedAt;
                transactionType = hasEarlierIssue ? "SUPPLEMENTAL_ISSUE" : "INITIAL_ISSUE";
                issueReasonByLineHex.TryGetValue(Convert.ToHexString(row.LineId), out reason);
            }

            result.Add(new MrxTransactionHistoryRowDto(
                transactionType,
                row.DocumentCode,
                row.Date,
                GuidHelper.ToGuidString(row.BatchId),
                customerName ?? "Khách hàng",
                row.IngredientCode,
                row.IngredientName,
                row.UnitName,
                row.Quantity,
                row.ActorName ?? (row.IsReturn ? "Bếp" : "Thủ kho"),
                row.CreatedAt,
                reason));
        }

        return result;
    }

    private sealed class BaseRow
    {
        public bool IsReturn { get; init; }
        public string DocumentCode { get; init; } = string.Empty;
        public DateOnly Date { get; init; }
        public byte[] BatchId { get; init; } = [];
        public string IngredientCode { get; init; } = string.Empty;
        public string IngredientName { get; init; } = string.Empty;
        public string UnitName { get; init; } = string.Empty;
        public decimal Quantity { get; init; }
        public string? ActorName { get; init; }
        public DateTime CreatedAt { get; init; }
        public string? StaticReason { get; init; }
        public byte[] LineId { get; init; } = [];
    }
}
