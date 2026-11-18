using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Approvals.Services;

internal sealed class OperationalMrxHistoricalPurposeSource(IpcManagementContext context)
{
    internal async Task<(IReadOnlyList<ApprovalInboxItemDto> Items, bool HasMore)> ReadAsync(
        ApprovalInboxQueryDto query, CancellationToken token, int offset, int limit)
    {
        var targetId = GuidHelper.ParseGuidString(query.TargetId);
        var customerCode = query.CustomerCode?.Trim().ToUpperInvariant();
        DateOnly? date = DateOnly.TryParseExact(query.Date, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None, out var parsed) ? parsed : null;
        var rows = await (from row in context.Mrxhistoricalpurposeproposals.AsNoTracking()
            join menu in context.Menuversions.AsNoTracking() on row.Batch.MenuVersionId equals menu.MenuVersionId
            join customer in context.Customers.AsNoTracking() on menu.CustomerId equals customer.CustomerId
            where query.State == "PENDING" ? row.Status == "PENDING" : row.Status != "PENDING"
            where targetId == null || row.ProposalId == targetId
            where date == null || row.ServiceDate == date
            where string.IsNullOrEmpty(customerCode) || customer.CustomerCode.ToUpper() == customerCode
            orderby row.CreatedAt, row.ProposalId
            select new { row.ProposalId, row.ServiceDate, row.Status, row.Reason, row.CreatedAt, row.IssueLine.Issue.IssueCode,
                row.UnallocatedQuantity, row.IssueLine.Ingredient.IngredientName, row.IssueLine.Unit.UnitName,
                row.CreatedByUser.FullName, menu.WeekStartDate, customer.CustomerCode, customer.CustomerName })
            .Skip(offset).Take(limit + 1).ToListAsync(token);
        return (rows.Take(limit).Select(row =>
        {
            var id = GuidHelper.ToGuidString(row.ProposalId);
            return new ApprovalInboxItemDto { InboxItemId = $"MATERIAL_RECONCILIATION:mrx-historical-purpose:{id}",
                TargetType = "mrx-historical-purpose", TargetId = id, TargetCode = row.IssueCode, Title = "Phân bổ phiếu lịch sử",
                CustomerCode = row.CustomerCode, Source = row.CustomerName, OwnerRole = "Quản lý/Admin", SubmittedBy = row.FullName,
                SubmittedAt = row.CreatedAt, Status = row.Status, Reason = row.Reason, ServiceDate = row.ServiceDate,
                WeekStartDate = row.WeekStartDate, LineCount = 1,
                Materials = [new() { Name = row.IngredientName, Unit = row.UnitName, Quantity = row.UnallocatedQuantity }],
                Route = $"/approvals?targetType=mrx-historical-purpose&targetId={id}&state={query.State}" };
        }).ToList(), rows.Count > limit);
    }

    internal async Task<IReadOnlyList<ApprovalHistoryItemDto>> HistoryAsync(string id, byte[] key, CancellationToken token)
    {
        if (!await context.Mrxhistoricalpurposeproposals.AnyAsync(row => row.ProposalId == key, token))
            throw new KeyNotFoundException("Không tìm thấy đề xuất phân bổ.");
        var rows = await context.Auditlogs.AsNoTracking().Include(row => row.ChangedByNavigation)
            .Where(row => row.BusinessArea == "MATERIAL_RECONCILIATION" && row.EntityName == nameof(MrxHistoricalPurposeProposal)
                && row.EntityId == key && row.FieldName == "Status")
            .OrderBy(row => row.ChangedAt).ThenBy(row => row.AuditId).ToListAsync(token);
        return rows.Select(row => new ApprovalHistoryItemDto { HistoryId = GuidHelper.ToGuidString(row.AuditId),
            TargetType = "mrx-historical-purpose", TargetId = id, Decision = row.NewValue ?? "", OldStatus = row.OldValue,
            NewStatus = row.NewValue == "ADMIN_DIRECT" ? "APPLIED" : row.NewValue ?? "", Reason = row.Reason,
            ActionBy = GuidHelper.ToGuidString(row.ChangedBy), ActionByName = row.ChangedByNavigation?.FullName ?? "", ActionAt = row.ChangedAt }).ToList();
    }
}
