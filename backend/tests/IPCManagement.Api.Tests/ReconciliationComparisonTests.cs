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
        var actuals = new[] { new ReconciliationActual { BatchLineId=line.BatchLineId,Side="PURCHASED",Quantity=10.5m }, new ReconciliationActual { BatchLineId=line.BatchLineId,Side="ISSUED",Quantity=9.4m } };
        var result = ReconciliationComparisonService.Map(line, actuals, null);
        Assert.Equal(0.5m,result.PurchasedRequiredDifference); Assert.Equal(-0.6m,result.IssuedRequiredDifference); Assert.Equal(1.1m,result.PurchasedIssuedDifference);
        Assert.DoesNotContain("PURCHASED_REQUIRED",result.Triggers); Assert.Contains("ISSUED_REQUIRED",result.Triggers); Assert.Contains("PURCHASED_ISSUED",result.Triggers);
    }
}
