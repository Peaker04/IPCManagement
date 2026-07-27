using IPCManagement.Api.Features.Approvals.Contracts;

namespace IPCManagement.Api.Features.Approvals.Services;

public interface IApprovalHistoryQueryService
{
    Task<IReadOnlyList<ApprovalHistoryItemDto>> GetHistoryAsync(string targetType, byte[] targetId);
}
