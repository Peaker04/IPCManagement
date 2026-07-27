using IPCManagement.Api.Models.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IPCManagement.Api.Services.Approvals;

public interface IApprovalRoutingService
{
    Task<ApprovalRule?> GetMatchingRuleAsync(string documentType, decimal? amount);
    Task<IReadOnlyList<ApprovalRule>> GetActiveRulesAsync(string documentType);
    Task<IReadOnlyList<ApprovalAssignment>> GetAssignmentsForRuleAsync(byte[] ruleId);
    Task<IReadOnlyList<ApprovalRule>> GetAllRulesAsync();
    Task<ApprovalRule?> GetRuleByIdAsync(byte[] ruleId);
    Task<ApprovalRule> CreateRuleAsync(ApprovalRule rule, IEnumerable<ApprovalAssignment> assignments);
    Task<ApprovalRule?> UpdateRuleAsync(byte[] ruleId, ApprovalRule rule, IEnumerable<ApprovalAssignment> assignments);
    Task<bool> DeleteRuleAsync(byte[] ruleId);
}
