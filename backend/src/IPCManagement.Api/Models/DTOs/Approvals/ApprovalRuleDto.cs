using System.Collections.Generic;

namespace IPCManagement.Api.Models.DTOs.Approvals;

public class ApprovalRuleRequest
{
    public string RuleName { get; set; } = null!;
    public string DocumentType { get; set; } = null!;
    public decimal? MinAmount { get; set; }
    public decimal? MaxAmount { get; set; }
    public int? SlaHours { get; set; }
    public bool IsActive { get; set; }
    public List<ApprovalAssignmentRequest> Assignments { get; set; } = new();
}

public class ApprovalAssignmentRequest
{
    public int Sequence { get; set; }
    public string ApproverRole { get; set; } = null!;
    public string? ApproverUserId { get; set; }
    public bool IsRequired { get; set; } = true;
}
