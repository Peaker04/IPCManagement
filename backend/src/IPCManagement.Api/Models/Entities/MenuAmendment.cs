namespace IPCManagement.Api.Models.Entities;

public sealed class MenuAmendment
{
    public byte[] MenuAmendmentId { get; set; } = null!;
    public byte[] CustomerId { get; set; } = null!;
    public DateOnly WeekStartDate { get; set; }
    public byte[]? BaseMenuVersionId { get; set; }
    public string Status { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public string ImpactSnapshotJson { get; set; } = null!;
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public byte[]? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public byte[]? ExecutedBy { get; set; }
    public DateTime? ExecutedAt { get; set; }

    public Customer Customer { get; set; } = null!;
    public MenuVersion? BaseMenuVersion { get; set; }
    public User CreatedByNavigation { get; set; } = null!;
    public User? ReviewedByNavigation { get; set; }
    public User? ExecutedByNavigation { get; set; }
    public ICollection<MenuAmendmentLine> Lines { get; set; } = new List<MenuAmendmentLine>();
}

public sealed class MenuAmendmentReconciliationCase
{
    public byte[] MenuAmendmentReconciliationCaseId { get; set; } = null!;
    public byte[] MenuAmendmentId { get; set; } = null!;
    public string ImpactSnapshotJson { get; set; } = null!;
    public string Status { get; set; } = "OPEN";
    public DateTime CreatedAt { get; set; }
    public MenuAmendment MenuAmendment { get; set; } = null!;
}

public sealed class MenuAmendmentReconciliationCorrection
{
    public byte[] MenuAmendmentReconciliationCorrectionId { get; set; } = null!;
    public byte[] MenuAmendmentReconciliationCaseId { get; set; } = null!;
    public byte[] ServiceRunId { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}

public sealed class MenuAmendmentLine
{
    public byte[] MenuAmendmentLineId { get; set; } = null!;
    public byte[] MenuAmendmentId { get; set; } = null!;
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = null!;
    public string DishSlot { get; set; } = null!;
    public byte[]? OldDishId { get; set; }
    public byte[] NewDishId { get; set; } = null!;

    public MenuAmendment MenuAmendment { get; set; } = null!;
    public Dish? OldDish { get; set; }
    public Dish NewDish { get; set; } = null!;
}
