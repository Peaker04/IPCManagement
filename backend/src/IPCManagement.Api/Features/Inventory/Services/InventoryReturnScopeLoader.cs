using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.EntityFrameworkCore;
using static IPCManagement.Api.Features.Inventory.Services.InventoryReturnRules;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class InventoryReturnScopeLoader
{
    internal static async Task<List<SourceLineScope>> LoadScopedAsync(
        IpcManagementContext context,
        InventoryReturnAllocationBalanceQuery query,
        CancellationToken cancellationToken)
    {
        var customerId = query.CustomerId is null ? null : GuidHelper.ParseGuidString(query.CustomerId)
            ?? throw new ArgumentException("CustomerId không hợp lệ.");
        return await (
            from line in context.Inventoryissuelines.AsNoTracking()
            join issue in context.Inventoryissues.AsNoTracking() on line.IssueId equals issue.IssueId
            join material in context.Materialrequestlines.AsNoTracking() on line.MaterialRequestLineId equals material.RequestLineId
            join planLine in context.Productionplanlines.AsNoTracking() on material.PlanLineId equals planLine.PlanLineId
            join plan in context.Productionplans.AsNoTracking() on planLine.PlanId equals plan.PlanId
            where line.MaterialRequestLineId != null
                && (customerId == null || planLine.CustomerId.SequenceEqual(customerId))
                && (query.ServiceDate == null || plan.PlanDate == query.ServiceDate)
                && (query.ShiftName == null || planLine.ShiftName == query.ShiftName)
                && (query.PriceTierAmount == null || material.PriceTierAmount == query.PriceTierAmount)
            select new SourceLineScope(line, issue, material, planLine, plan)).ToListAsync(cancellationToken);
    }

    internal static async Task<SourceLineScope> LoadSourceAsync(
        IpcManagementContext context,
        byte[] sourceIssueLineId,
        CancellationToken cancellationToken)
    {
        var result = await LoadScopedAsync(context, new InventoryReturnAllocationBalanceQuery(), cancellationToken);
        return result.SingleOrDefault(item => item.Line.IssueLineId.SequenceEqual(sourceIssueLineId))
            ?? throw new BusinessRuleException("Dòng nguồn thiếu hoặc không có lineage material/customer/date/shift/tier.");
    }

    internal static async Task<bool> IsAdminAsync(IpcManagementContext context, string? userId, CancellationToken cancellationToken)
    {
        var actorId = GuidHelper.ParseGuidString(userId);
        if (actorId is null) return false;
        var roleName = await (
            from user in context.Users.AsNoTracking()
            join role in context.Roles.AsNoTracking() on user.RoleId equals role.RoleId
            where user.UserId.SequenceEqual(actorId)
            select role.RoleName).SingleOrDefaultAsync(cancellationToken);
        return AuthorizationPolicies.IsAdminRole(roleName);
    }
}
