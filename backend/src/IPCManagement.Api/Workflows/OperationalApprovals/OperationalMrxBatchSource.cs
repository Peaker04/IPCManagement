using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Workflows.OperationalApprovals;

internal sealed class OperationalMrxBatchSource(IpcManagementContext context)
{
    internal async Task<(IReadOnlyList<ApprovalInboxItemDto> Items, bool HasMore)> ReadAsync(
        ApprovalInboxQueryDto query, CancellationToken token, int offset = 0, int limit = 100)
    {
        if (!ApprovalInboxQueryPolicy.ShouldBuildTarget(query.TargetType, "mrx-batch-review")) return ([], false);
        var batches = ApprovalInboxSourceFilter.ByIdentity(context.Reconciliationbatches.AsNoTracking(), x => x.BatchId, query)
            .Where(x => query.State == "PENDING" ? x.Status == "IN_PROGRESS" : x.Status == "COMPLETED");
        var customerCode = query.CustomerCode?.Trim().ToUpperInvariant();
        var records = await (from batch in batches
            join menu in context.Menuversions on batch.MenuVersionId equals menu.MenuVersionId
            join customer in context.Customers on menu.CustomerId equals customer.CustomerId
            join user in context.Users on batch.CreatedBy equals user.UserId into users
            from user in users.DefaultIfEmpty()
            where string.IsNullOrEmpty(customerCode) || customer.CustomerCode.ToUpper() == customerCode
            orderby batch.CreatedAt, batch.BatchId
            select new { Batch = batch, menu.WeekStartDate, customer.CustomerCode, customer.CustomerName,
                Actor = user == null ? "" : user.FullName })
            .Skip(offset).Take(limit + 1).ToListAsync(token);
        var eligibleIds = new HashSet<string>(StringComparer.Ordinal);
        if (query.State == "PENDING" && records.Count > 0)
        {
            var candidates = records.Take(limit).Select(x => x.Batch).ToList();
            var ids = candidates.Select(x => x.BatchId).ToList();
            var lines = await context.Reconciliationbatchlines.AsNoTracking().Where(x => ids.Contains(x.BatchId)).ToListAsync(token);
            var daily = await ReconciliationWarehouseDailyQuery.GetManyAsync(context,
                candidates.Select(x => GuidHelper.ToGuidString(x.BatchId)).ToList(), candidates, lines, null, null, token, includeMetadata: false);
            foreach (var batch in candidates)
            {
                batch.Lines = lines.Where(x => x.BatchId.SequenceEqual(batch.BatchId)).ToList();
                var id = GuidHelper.ToGuidString(batch.BatchId);
                try
                {
                    await ReconciliationCompletionEligibility.RequireAsync(context, batch, daily.GetValueOrDefault(id), token);
                    eligibleIds.Add(id);
                }
                catch (BusinessRuleException) { /* Ordinary prerequisite blockers are not pending decisions. Read failures propagate. */ }
            }
        }
        var items = records.Take(limit).Where(x => query.State != "PENDING" || eligibleIds.Contains(GuidHelper.ToGuidString(x.Batch.BatchId))).Select(x =>
        {
            var id = GuidHelper.ToGuidString(x.Batch.BatchId);
            return new ApprovalInboxItemDto { InboxItemId = $"MATERIAL_RECONCILIATION:mrx-batch-review:{id}",
                TargetType = "mrx-batch-review", TargetId = id, TargetCode = x.CustomerCode, CustomerCode = x.CustomerCode,
                Title = "Rà soát và chốt lô", Source = x.CustomerName, SubmittedBy = x.Actor,
                SubmittedAt = x.Batch.CreatedAt, WeekStartDate = x.WeekStartDate, Status = x.Batch.Status == "IN_PROGRESS" ? "COMPLETION_READY" : x.Batch.Status,
                OwnerRole = "Manager/Admin", NextAction = "Mở đối soát", Route = $"/reconciliation?batchId={id}",
                Reason = x.Batch.Status == "COMPLETED" ? "Lô đã chốt. Xem lịch sử và kết quả đối soát."
                    : "Đã đủ điều kiện chốt. Rà soát kết quả và chốt tại trạm đối soát; hệ thống kiểm tra lại điều kiện khi xác nhận." };
        }).ToList();
        return (items, records.Count > limit);
    }

    internal async Task<IReadOnlyList<ApprovalHistoryItemDto>> HistoryAsync(string id, CancellationToken token)
    {
        var key = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Mã lô không hợp lệ.");
        var batch = await context.Reconciliationbatches.AsNoTracking().SingleOrDefaultAsync(x => x.BatchId == key, token)
            ?? throw new KeyNotFoundException("Không tìm thấy lô đối soát.");
        var events = new List<(string Status, byte[] Actor, DateTime At)> { ("DRAFT", batch.CreatedBy, batch.CreatedAt) };
        if (batch.ReadyAt is not null && batch.ReadyBy is not null) events.Add(("READY", batch.ReadyBy, batch.ReadyAt.Value));
        var handoff = await context.Auditlogs.AsNoTracking()
            .Where(x => x.BusinessArea == "MATERIAL_RECONCILIATION" && x.EntityName == nameof(ReconciliationBatch)
                && x.EntityId == key && x.FieldName == nameof(ReconciliationBatch.Status) && x.NewValue == "TRANSFERRED")
            .OrderByDescending(x => x.ChangedAt).ThenByDescending(x => x.AuditId).FirstOrDefaultAsync(token);
        if (handoff is not null) events.Add(("TRANSFERRED", handoff.ChangedBy, handoff.ChangedAt));
        if (batch.CompletedAt is not null && batch.CompletedBy is not null) events.Add(("COMPLETED", batch.CompletedBy, batch.CompletedAt.Value));
        var ids = events.Select(x => x.Actor).ToList();
        var users = await context.Users.AsNoTracking().Where(x => ids.Contains(x.UserId)).ToListAsync(token);
        return events.Select(x => new ApprovalHistoryItemDto { HistoryId = $"{id}:{x.Status}", TargetId = id,
            TargetType = "mrx-batch-review", Decision = x.Status, NewStatus = x.Status,
            ActionBy = GuidHelper.ToGuidString(x.Actor), ActionAt = x.At,
            ActionByName = users.FirstOrDefault(u => u.UserId.SequenceEqual(x.Actor))?.FullName ?? "" }).ToList();
    }
}
