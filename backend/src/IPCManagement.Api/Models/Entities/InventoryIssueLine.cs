using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class InventoryIssueLine
{
    public byte[] IssueLineId { get; set; } = null!;

    public byte[] IssueId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    // Legacy issue rows may predate durable demand-line provenance. New issue writes always set this value.
    public byte[]? MaterialRequestLineId { get; set; }

    public byte[]? ReconciliationBatchLineId { get; set; }

    public decimal RequestedQty { get; set; }

    public decimal IssuedQty { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual InventoryIssue Issue { get; set; } = null!;

    public virtual MaterialRequestLine? MaterialRequestLine { get; set; }

    public virtual ReconciliationBatchLine? ReconciliationBatchLine { get; set; }

    public virtual Unit Unit { get; set; } = null!;
}
