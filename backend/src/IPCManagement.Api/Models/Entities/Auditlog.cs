using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Auditlog
{
    public byte[] AuditId { get; set; } = null!;

    public DateTime ChangedAt { get; set; }

    public byte[] ChangedBy { get; set; } = null!;

    public string BusinessArea { get; set; } = null!;

    public string EntityName { get; set; } = null!;

    public byte[]? EntityId { get; set; }

    public string? FieldName { get; set; }

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public string? Reason { get; set; }

    public virtual User ChangedByNavigation { get; set; } = null!;
}
