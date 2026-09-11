using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Models.Entities;
using Xunit;
namespace IPCManagement.Api.Tests;
public sealed class ReconciliationComparisonTests
{
    [Fact]
    public void Uses_signed_exact_differences_and_strict_tolerance()
    {
        var line = new ReconciliationBatchLine { BatchLineId=Guid.NewGuid().ToByteArray(),IngredientId=Guid.NewGuid().ToByteArray(),CanonicalUnitId=Guid.NewGuid().ToByteArray(),RequiredQuantity=10m,FrozenTolerance=0.5m,ToleranceSourceKind="SYSTEM_DEFAULT",ToleranceSourceVersion="1",Version=1 };
        var actuals = new[] { new ReconciliationActual { BatchLineId=line.BatchLineId,Side="PURCHASED",Quantity=10.5m } };
        var result = ReconciliationComparisonService.Map(line, actuals, null, 9.4m);
        Assert.Equal(0.5m,result.PurchasedRequiredDifference); Assert.Equal(-0.6m,result.IssuedRequiredDifference); Assert.Equal(1.1m,result.PurchasedIssuedDifference);
        Assert.DoesNotContain("PURCHASED_REQUIRED",result.Triggers); Assert.Contains("ISSUED_REQUIRED",result.Triggers); Assert.DoesNotContain("PURCHASED_ISSUED",result.Triggers);
    }

    [Fact]
    public void Missing_linked_issue_dictionary_entry_remains_null_instead_of_becoming_zero()
    {
        var lineId = Guid.NewGuid().ToByteArray();
        var empty = new Dictionary<string, decimal>();
        var withZero = new Dictionary<string, decimal> { [Convert.ToHexString(lineId)] = 0m };

        Assert.Null(ReconciliationBatchService.LinkedQuantity(empty, lineId));
        Assert.Equal(0m, ReconciliationBatchService.LinkedQuantity(withZero, lineId));
    }

    [Fact]
    public void Ignores_legacy_issued_actual_when_no_linked_inventory_issue_exists()
    {
        var line = new ReconciliationBatchLine { BatchLineId=Guid.NewGuid().ToByteArray(),IngredientId=Guid.NewGuid().ToByteArray(),CanonicalUnitId=Guid.NewGuid().ToByteArray(),RequiredQuantity=10m,FrozenTolerance=0.5m,ToleranceSourceKind="SYSTEM_DEFAULT",ToleranceSourceVersion="1",Version=1 };
        var legacyActuals = new[] { new ReconciliationActual { BatchLineId=line.BatchLineId,Side="ISSUED",Quantity=0m,Version=1 } };

        var result = ReconciliationComparisonService.Map(line, legacyActuals, null);

        Assert.Null(result.IssuedQuantity);
        Assert.Null(result.IssuedRequiredDifference);
        Assert.Equal("INCOMPLETE", result.Status);
    }
}
