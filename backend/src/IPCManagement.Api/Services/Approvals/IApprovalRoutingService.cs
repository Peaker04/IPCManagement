using IPCManagement.Api.Models.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IPCManagement.Api.Services.Approvals;

public interface IApprovalRoutingService
{
    Task<Approvalrule?> GetMatchingRuleAsync(string documentType, decimal? amount);
    Task<IReadOnlyList<Approvalassignment>> GetAssignmentsForRuleAsync(byte[] ruleId);
    Task<IReadOnlyList<Approvalrule>> GetAllRulesAsync();
    Task<Approvalrule?> GetRuleByIdAsync(byte[] ruleId);
    Task<Approvalrule> CreateRuleAsync(Approvalrule rule, IEnumerable<Approvalassignment> assignments);
    Task<Approvalrule?> UpdateRuleAsync(byte[] ruleId, Approvalrule rule, IEnumerable<Approvalassignment> assignments);
    Task<bool> DeleteRuleAsync(byte[] ruleId);
}
