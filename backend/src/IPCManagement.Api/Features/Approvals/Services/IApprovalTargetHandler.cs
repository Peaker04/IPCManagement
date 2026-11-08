using IPCManagement.Api.Features.Approvals.Contracts;

namespace IPCManagement.Api.Features.Approvals.Services;

public interface IApprovalTargetHandler
{
    ApprovalTargetType TargetType { get; }
    Task<ApprovalResultDto?> HandleAsync(string targetId, ApprovalRequest request, byte[] actorId);
}

internal interface IApprovalTargetPersistenceHandler
{
    Task<ApprovalResultDto?> StageAsync(string targetId, ApprovalRequest request, byte[] actorId);
}
