using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Approvals.Services;

public sealed class ApprovalHistoryQueryService : IApprovalHistoryQueryService
{
    private readonly IpcManagementContext _context;

    public ApprovalHistoryQueryService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<ApprovalHistoryItemDto>> GetHistoryAsync(
        string targetType,
        byte[] targetId)
    {
        var history = await _context.Approvalhistories
            .Include(item => item.ActionByNavigation)
            .AsNoTracking()
            .Where(item => item.TargetType == targetType && item.TargetId.SequenceEqual(targetId))
            .OrderBy(item => item.ActionAt)
            .ToListAsync();

        return history.Select(item => new ApprovalHistoryItemDto
        {
            HistoryId = GuidHelper.ToGuidString(item.ApprovalHistoryId),
            TargetType = item.TargetType,
            TargetId = GuidHelper.ToGuidString(item.TargetId),
            Decision = item.Decision,
            OldStatus = item.OldStatus,
            NewStatus = item.NewStatus,
            Reason = item.Reason,
            ActionBy = GuidHelper.ToGuidString(item.ActionBy),
            ActionByName = item.ActionByNavigation?.FullName ?? "Unknown",
            ActionAt = item.ActionAt
        }).ToList();
    }
}
