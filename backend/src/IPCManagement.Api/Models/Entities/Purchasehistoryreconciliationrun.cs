using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Purchasehistoryreconciliationrun
{
    public byte[] PurchaseHistoryReconciliationRunId { get; set; } = null!;

    public string ManifestId { get; set; } = null!;

    public string ManifestHash { get; set; } = null!;

    public string SourceName { get; set; } = null!;

    public string SourceSha256 { get; set; } = null!;

    public string PolicyVersion { get; set; } = null!;

    public DateOnly AsOfDate { get; set; }

    public string DatabaseFingerprint { get; set; } = null!;

    public string BackupIdentifier { get; set; } = null!;

    public string BackupTargetFingerprint { get; set; } = null!;

    public string RestoreFingerprint { get; set; } = null!;

    public bool RestoreVerified { get; set; }

    public byte[] AppliedBy { get; set; } = null!;

    public DateTime AppliedAt { get; set; }

    public string Status { get; set; } = null!;

    public int CandidateCount { get; set; }

    public int CurrentUniqueBusinessKeyCount { get; set; }

    public int AuditedDeltaCount { get; set; }

    public int ActionCount { get; set; }

    public int BlockerCount { get; set; }

    public int KeepCount { get; set; }

    public int VersionCount { get; set; }

    public int DeactivateCount { get; set; }

    public int DeleteCount { get; set; }

    public int BlockCount { get; set; }

    public virtual User AppliedByNavigation { get; set; } = null!;

    public virtual ICollection<Purchasehistoryreconciliationaction> Purchasehistoryreconciliationactions { get; set; }
        = new List<Purchasehistoryreconciliationaction>();
}
