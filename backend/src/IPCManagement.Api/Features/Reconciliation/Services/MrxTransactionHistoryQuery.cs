using System.Runtime.CompilerServices;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
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
        var query = Build(batchId, fromDate, toDate);
        var total = await query.CountAsync(token);
        var rows = await Order(query).Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize).ToListAsync(token);
        return PagedResponseDto<MrxTransactionHistoryRowDto>.Create(Map(rows), total, page.PageNumber, page.PageSize);
    }

    internal async IAsyncEnumerable<MrxTransactionHistoryRowDto> StreamAsync(
        byte[]? batchId,
        DateOnly? fromDate,
        DateOnly? toDate,
        [EnumeratorCancellation] CancellationToken token)
    {
        await foreach (var row in Order(Build(batchId, fromDate, toDate))
                           .AsAsyncEnumerable()
                           .WithCancellation(token))
        {
            yield return Map(row);
        }
    }

    private IQueryable<Row> Build(byte[]? batchId, DateOnly? fromDate, DateOnly? toDate)
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

        var issues = issueLines.Select(line => new Row
        {
            TransactionType = context.Inventoryissues.Any(other =>
                other.ReconciliationBatchId == line.Issue.ReconciliationBatchId
                && other.IssueDate == line.Issue.IssueDate
                && other.CreatedAt < line.Issue.CreatedAt)
                ? "SUPPLEMENTAL_ISSUE"
                : "INITIAL_ISSUE",
            DocumentCode = line.Issue.IssueCode,
            Date = line.Issue.IssueDate,
            BatchId = line.Issue.ReconciliationBatchId!,
            CustomerName = context.Menuversions
                .Where(version => version.MenuVersionId == line.Issue.ReconciliationBatch!.MenuVersionId)
                .Select(version => version.Customer!.CustomerName)
                .FirstOrDefault(),
            IngredientCode = line.Ingredient.IngredientCode,
            IngredientName = line.Ingredient.IngredientName,
            UnitName = line.Unit.UnitName,
            Quantity = line.IssuedQty,
            ActorName = line.Issue.IssuedByNavigation.FullName,
            CreatedAt = line.Issue.CreatedAt,
            Reason = context.Auditlogs
                .Where(audit => audit.EntityName == nameof(Models.Entities.InventoryIssueLine)
                    && audit.FieldName == nameof(Models.Entities.InventoryIssueLine.IssuedQty)
                    && audit.EntityId == line.IssueLineId)
                .OrderByDescending(audit => audit.ChangedAt)
                .Select(audit => audit.Reason)
                .FirstOrDefault(),
            LineId = line.IssueLineId
        });
        var returns = returnLines.Select(line => new Row
        {
            TransactionType = "PHYSICAL_RETURN",
            DocumentCode = line.Return.ReturnCode,
            Date = line.Return.ReturnDate,
            BatchId = line.Return.Issue.ReconciliationBatchId!,
            CustomerName = context.Menuversions
                .Where(version => version.MenuVersionId == line.Return.Issue.ReconciliationBatch!.MenuVersionId)
                .Select(version => version.Customer!.CustomerName)
                .FirstOrDefault(),
            IngredientCode = line.Ingredient.IngredientCode,
            IngredientName = line.Ingredient.IngredientName,
            UnitName = line.Unit.UnitName,
            Quantity = line.Quantity,
            ActorName = line.Return.CreatedByNavigation.FullName,
            CreatedAt = line.Return.CreatedAt,
            Reason = line.Return.Reason,
            LineId = line.ReturnLineId
        });
        return issues.Concat(returns);
    }

    private static IOrderedQueryable<Row> Order(IQueryable<Row> query) => query
        .OrderByDescending(row => row.CreatedAt)
        .ThenBy(row => row.DocumentCode)
        .ThenBy(row => row.LineId);

    private static IReadOnlyList<MrxTransactionHistoryRowDto> Map(IEnumerable<Row> rows) => rows.Select(Map).ToList();

    private static MrxTransactionHistoryRowDto Map(Row row) =>
        new(
            row.TransactionType,
            row.DocumentCode,
            row.Date,
            GuidHelper.ToGuidString(row.BatchId),
            row.CustomerName ?? "Khách hàng",
            row.IngredientCode,
            row.IngredientName,
            row.UnitName,
            row.Quantity,
            row.ActorName ?? (row.TransactionType == "PHYSICAL_RETURN" ? "Bếp" : "Thủ kho"),
            row.CreatedAt,
            row.Reason);

    private sealed class Row
    {
        public string TransactionType { get; init; } = string.Empty;
        public string DocumentCode { get; init; } = string.Empty;
        public DateOnly Date { get; init; }
        public byte[] BatchId { get; init; } = [];
        public string? CustomerName { get; init; }
        public string IngredientCode { get; init; } = string.Empty;
        public string IngredientName { get; init; } = string.Empty;
        public string UnitName { get; init; } = string.Empty;
        public decimal Quantity { get; init; }
        public string? ActorName { get; init; }
        public DateTime CreatedAt { get; init; }
        public string? Reason { get; init; }
        public byte[] LineId { get; init; } = [];
    }
}
