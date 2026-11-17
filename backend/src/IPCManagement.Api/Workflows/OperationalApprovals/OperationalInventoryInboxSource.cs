using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;

namespace IPCManagement.Api.Workflows.OperationalApprovals;

internal sealed class OperationalInventoryInboxSource(IpcManagementContext context) : IInventoryApprovalInboxSource
{
    public async Task<IReadOnlyList<ApprovalInboxItemDto>> ReadAsync(ApprovalInboxQueryDto query,
        int offset, int limit, CancellationToken cancellationToken)
    {
        var items = new List<ApprovalInboxItemDto>();
        if (ApprovalInboxQueryPolicy.ShouldBuildTarget(query.TargetType, "legacy-lineage-disposition"))
            items.AddRange(await new OperationalLegacyLineageSource(context).ReadAsync(query, cancellationToken, offset, limit));
        if (ApprovalInboxQueryPolicy.ShouldBuildTarget(query.TargetType, "stocktake"))
            items.AddRange(await new OperationalStocktakeSource(context).ReadAsync(query, cancellationToken, offset, limit));
        return items;
    }
}
