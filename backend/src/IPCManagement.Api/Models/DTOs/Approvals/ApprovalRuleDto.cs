using System.Collections.Generic;

namespace IPCManagement.Api.Models.DTOs.Approvals;

public class ApprovalRuleRequestDto
{
    public string RuleName { get; set; } = null!;
    public string DocumentType { get; set; } = null!;
    public decimal? MinAmount { get; set; }
    public decimal? MaxAmount { get; set; }
    public int? SlaHours { get; set; }
    public bool IsActive { get; set; }
    public List<ApprovalAssignmentRequestDto> Assignments { get; set; } = new();
}

public class ApprovalAssignmentRequestDto
{
    public int Sequence { get; set; }
    public string ApproverRole { get; set; } = null!;
    public string? ApproverUserId { get; set; }
    public bool IsRequired { get; set; } = true;
}
