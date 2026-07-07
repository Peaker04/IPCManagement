using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Approvalrule
{
    public byte[] RuleId { get; set; } = null!;

    public string RuleName { get; set; } = null!;

    public string DocumentType { get; set; } = null!;

    public decimal? MinAmount { get; set; }

    public decimal? MaxAmount { get; set; }

    public int? SlaHours { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<Approvalassignment> Approvalassignments { get; set; } = new List<Approvalassignment>();
}
