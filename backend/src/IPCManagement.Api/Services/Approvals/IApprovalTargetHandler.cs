using IPCManagement.Api.Models.DTOs.Approvals;

namespace IPCManagement.Api.Services.Approvals;

public interface IApprovalTargetHandler
{
    ApprovalTargetType TargetType { get; }
    Task<ApprovalResultDto?> HandleAsync(string targetId, ApprovalRequest request, byte[] actorId);
}