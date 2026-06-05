using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Materialrequest
{
    public byte[] RequestId { get; set; } = null!;

    public string RequestCode { get; set; } = null!;

    public byte[] PlanId { get; set; } = null!;

    public DateOnly RequestDate { get; set; }

    public string RequestScope { get; set; } = null!;

    public string Status { get; set; } = null!;

    public byte[] CreatedBy { get; set; } = null!;

    public byte[]? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public virtual User? ApprovedByNavigation { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<Inventoryissue> Inventoryissues { get; set; } = new List<Inventoryissue>();

    public virtual ICollection<Materialrequestline> Materialrequestlines { get; set; } = new List<Materialrequestline>();

    public virtual Productionplan Plan { get; set; } = null!;
}
