using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class FrozenBomQuantityPolicy
{
    internal const string UnavailableReason = "FROZEN_UNIT_CONVERSION_MISSING";

    internal static bool TryGetCanonicalPerServing(ReconciliationBatchContributor contributor, out decimal quantity)
    {
        quantity = 0m;
        if (contributor.FrozenBomQuantityPerServing is not > 0
            || contributor.FrozenBomUnitToBaseRate is not > 0
            || contributor.FrozenCanonicalUnitToBaseRate is not > 0)
            return false;
        try
        {
            // Round only after applying servings; SourceQuantity has already lost per-serving precision.
            quantity = contributor.FrozenBomQuantityPerServing.Value * contributor.FrozenBomUnitToBaseRate.Value
                / contributor.FrozenCanonicalUnitToBaseRate.Value;
            return quantity > 0;
        }
        catch (OverflowException)
        {
            return false;
        }
    }
}
