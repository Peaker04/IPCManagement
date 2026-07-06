using System;

namespace IPCManagement.Api.Models.Entities;

public partial class Approvalassignment
{
    public byte[] AssignmentId { get; set; } = null!;

    public byte[] RuleId { get; set; } = null!;

    public int Sequence { get; set; }

    public string ApproverRole { get; set; } = null!;

    public byte[]? ApproverUserId { get; set; }

    public bool IsRequired { get; set; }

    public virtual Approvalrule Rule { get; set; } = null!;

    public virtual User? ApproverUser { get; set; }
}
