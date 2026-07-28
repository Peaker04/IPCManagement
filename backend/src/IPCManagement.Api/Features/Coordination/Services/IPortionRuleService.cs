using IPCManagement.Api.Features.Coordination.Contracts;

namespace IPCManagement.Api.Features.Coordination.Services;

public interface IPortionRuleService
{
    Task<IReadOnlyList<PortionRuleDto>> GetPortionRulesAsync(PortionRuleQueryDto query);
    Task<PortionRuleDto> CreatePortionRuleAsync(CreatePortionRuleRequest request, string? userId);
    Task<PortionRuleDto?> UpdatePortionRuleAsync(
        string portionRuleId,
        UpdatePortionRuleRequest request,
        string? userId);
    Task<ResolvedPortionRuleDto?> ResolvePortionRuleAsync(ResolvePortionRuleRequest request);
}
