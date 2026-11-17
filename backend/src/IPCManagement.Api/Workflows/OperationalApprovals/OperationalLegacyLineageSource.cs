using IPCManagement.Api.Features.Approvals.Services;
using System.Security.Claims;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Workflows.OperationalApprovals;

internal sealed class OperationalLegacyLineageSource(IpcManagementContext context)
{
    internal async Task<IReadOnlyList<ApprovalInboxItemDto>> ReadAsync(ApprovalInboxQueryDto query, CancellationToken token, int offset = 0, int limit = 100)
    {
        var id = string.IsNullOrWhiteSpace(query.TargetId) ? null : GuidHelper.ParseGuidString(query.TargetId)
            ?? throw new ArgumentException("Mã hồ sơ liên kết chứng từ không hợp lệ.");
        var source = ScopedSource().Where(x => (id == null || x.DispositionId == id)
            && (query.State == "PENDING" ? x.Status == "PENDING_MANAGER_REVIEW" || x.Status == "APPROVED" : x.Status != "PENDING_MANAGER_REVIEW"));
        source = ApprovalInboxSourceFilter.ByDate(source, x => DateOnly.FromDateTime(x.CreatedAt), query);
        var rows = await (from x in source join u in context.Users on x.CreatedBy equals u.UserId
            orderby x.CreatedAt, x.DispositionId
            select new { Record = x, u.FullName, DocumentCode = x.LegacyLineType == "ISSUE_LINE"
                ? context.Inventoryissues.Where(document => context.Inventoryissuelines.Any(line => line.IssueLineId.SequenceEqual(x.LegacyLineId)
                    && line.IssueId.SequenceEqual(document.IssueId))).Select(document => document.IssueCode).FirstOrDefault()
                : context.Inventoryreturns.Where(document => context.Inventoryreturnlines.Any(line => line.ReturnLineId.SequenceEqual(x.LegacyLineId)
                    && line.ReturnId.SequenceEqual(document.ReturnId))).Select(document => document.ReturnCode).FirstOrDefault() })
            .Skip(offset).Take(limit).ToListAsync(token);
        return rows.Select(x => new ApprovalInboxItemDto {
            InboxItemId = $"DEFAULT:legacy-lineage-disposition:{GuidHelper.ToGuidString(x.Record.DispositionId)}:{(x.Record.Status == "APPROVED" ? "APPLY" : x.Record.Status == "PENDING_MANAGER_REVIEW" ? "REVIEW" : "HISTORY")}",
            TargetType = "legacy-lineage-disposition", ItemType = "legacy-lineage-disposition", TargetId = GuidHelper.ToGuidString(x.Record.DispositionId),
            TargetCode = $"LG-{GuidHelper.ToGuidString(x.Record.DispositionId)[..8].ToUpperInvariant()}", Title = "Đối chiếu liên kết chứng từ cũ",
            Source = $"{(x.Record.LegacyLineType == "ISSUE_LINE" ? "Dòng xuất kho" : "Dòng trả kho")} · {x.DocumentCode}",
            SourceDocumentCode = x.DocumentCode, SubmittedBy = x.FullName,
            SubmittedAt = x.Record.CreatedAt, DueDate = DateOnly.FromDateTime(x.Record.CreatedAt), Status = x.Record.Status, Reason = x.Record.Reason,
            OwnerRole = x.Record.Status == "APPROVED" ? "Admin" : x.Record.Status == "PENDING_MANAGER_REVIEW" ? "Manager" : "",
            NextAction = x.Record.Status == "APPROVED" ? "Áp dụng liên kết đã duyệt" : x.Record.Status == "PENDING_MANAGER_REVIEW" ? "Duyệt đối chiếu" : "Xem lịch sử",
            Route = $"/approvals?targetType=legacy-lineage-disposition&targetId={GuidHelper.ToGuidString(x.Record.DispositionId)}&state={query.State}"
        }).ToList();
    }

    internal async Task<LegacyLineageDispositionDto> DetailAsync(string id, CancellationToken token)
    {
        var key = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Mã hồ sơ không hợp lệ.");
        return LegacyLineageDispositionService.Map(await ScopedSource().SingleOrDefaultAsync(x => x.DispositionId == key, token)
            ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ đối chiếu."));
    }

    private IQueryable<LegacyLineageDisposition> ScopedSource() =>
        LegacyLineageSourceScope.Filter(context, context.Legacylinedispositions.AsNoTracking());

    internal static IReadOnlyList<string> AllowedActions(LegacyLineageDispositionDto item, ClaimsPrincipal actor)
    {
        var roles = actor.FindAll(ClaimTypes.Role).Select(x => x.Value);
        if (item.Status == "APPROVED" && roles.Any(AuthorizationPolicies.IsAdminRole)) return ["APPLY"];
        if (item.Status == "PENDING_MANAGER_REVIEW" && !string.Equals(item.CreatedBy, actor.FindFirstValue(ClaimTypes.NameIdentifier), StringComparison.OrdinalIgnoreCase)
            && roles.Any(AuthorizationPolicies.MatchesManagerRole)) return ["REVIEW_APPROVE", "REVIEW_REJECT"];
        return [];
    }

    internal async Task<IReadOnlyList<ApprovalHistoryItemDto>> HistoryAsync(string id, CancellationToken token)
    {
        var root = await DetailAsync(id, token);
        var lineId = GuidHelper.ParseGuidString(root.LegacyLineId)!;
        var aggregate = $"LegacyLineageDisposition:{root.LegacyLineType}";
        var events = await (from e in context.Lifecycletransitions.AsNoTracking()
            join u in context.Users on e.ActorId equals u.UserId into users from u in users.DefaultIfEmpty()
            where e.AggregateType == aggregate && e.AggregateId == lineId
            orderby e.CreatedAt, e.TransitionId
            select new { Event = e, Name = u == null ? "" : u.FullName }).ToListAsync(token);
        // The owner aggregate is a legacy line; multiple rejected proposals may share it.
        // Only lifecycle payloads for this exact disposition belong to its timeline.
        return events.Where(x => x.Event.PayloadJson != null
                && string.Equals(JsonSerializer.Deserialize<LegacyLineageDispositionDto>(x.Event.PayloadJson)?.DispositionId, root.DispositionId, StringComparison.OrdinalIgnoreCase))
            .Select(x => new ApprovalHistoryItemDto { HistoryId = GuidHelper.ToGuidString(x.Event.TransitionId),
                TargetType = "legacy-lineage-disposition", TargetId = id, OldStatus = x.Event.FromState, NewStatus = x.Event.ToState,
                Decision = x.Event.ToState, ActionAt = x.Event.CreatedAt, ActionBy = x.Event.ActorId == null ? "" : GuidHelper.ToGuidString(x.Event.ActorId),
                ActionByName = x.Name, Reason = x.Event.Reason }).ToList();
    }
}
