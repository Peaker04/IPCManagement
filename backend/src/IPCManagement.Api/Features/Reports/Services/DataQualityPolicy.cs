using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

internal static class DataQualityPolicy
{
    internal static DataQualityIssueDto BuildIssue(
        string category,
        string severity,
        string entityName,
        string? entityId,
        string entityCode,
        string entityLabel,
        string message,
        string suggestedAction,
        string route,
        DateTime utcNow)
    {
        var priorityRank = ResolvePriorityRank(category, severity);
        var slaHours = ResolveSlaHours(category, severity);

        return new DataQualityIssueDto
        {
            IssueId = $"{category}:{entityName}:{entityId ?? entityCode}",
            Category = category,
            Severity = severity,
            Owner = ResolveOwner(category, route),
            PriorityRank = priorityRank,
            SlaHours = slaHours,
            SlaDueAt = utcNow.AddHours(slaHours),
            SlaLabel = FormatSlaLabel(priorityRank, slaHours),
            EntityName = entityName,
            EntityId = entityId,
            EntityCode = entityCode,
            EntityLabel = entityLabel,
            Message = message,
            SuggestedAction = suggestedAction,
            Route = route
        };
    }

    internal static string NormalizeRemediationAction(string action)
        => action.Trim().ToLowerInvariant() switch
        {
            "resolve" or "resolved" => "resolved",
            "reopen" or "reopened" => "reopened",
            _ => throw new ArgumentException("Hành động data-quality issue phải là resolve hoặc reopen.")
        };

    internal static HashSet<string> NormalizeCleanupCategories(IReadOnlyList<string>? categories)
    {
        var normalized = (categories ?? ["orphan_document", "stale_demand", "stale_purchase_request"])
            .Where(category => !string.IsNullOrWhiteSpace(category))
            .Select(category => category.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (normalized.Count == 0)
        {
            normalized.Add("orphan_document");
            normalized.Add("stale_demand");
            normalized.Add("stale_purchase_request");
        }

        var unsupported = normalized
            .Where(category => category is not (
                "orphan_document" or
                "stale_demand" or
                "stale_purchase_request" or
                "inventory_ledger_baseline" or
                "zero_stock_unit"))
            .OrderBy(category => category)
            .ToList();
        if (unsupported.Count > 0)
        {
            throw new ArgumentException(
                $"Data-quality cleanup chỉ hỗ trợ orphan_document, stale_demand, stale_purchase_request, inventory_ledger_baseline, zero_stock_unit. Không hỗ trợ: {string.Join(", ", unsupported)}.");
        }

        return normalized;
    }

    internal static string NormalizeRemediationStatus(string? status)
        => status?.Trim().ToLowerInvariant() switch
        {
            "resolved" => "resolved",
            "reopened" => "reopened",
            _ => "open"
        };

    internal static string BuildMissingBomRemediationRoute(
        byte[] dishId,
        DateOnly serviceDate,
        WorkflowReportQueryDto query)
    {
        var scope = NormalizeShiftName(query.ShiftName) ?? "FULLDAY";
        var parts = new List<string>
        {
            "view=adjustments",
            "remediate=missing_bom",
            $"dishId={Uri.EscapeDataString(GuidHelper.ToGuidString(dishId))}",
            $"serviceDate={Uri.EscapeDataString(serviceDate.ToString("yyyy-MM-dd"))}",
            $"scope={Uri.EscapeDataString(scope)}"
        };

        if (!string.IsNullOrWhiteSpace(query.CustomerId))
        {
            parts.Add($"customerId={Uri.EscapeDataString(query.CustomerId.Trim())}");
        }

        return $"/admin-data?{string.Join("&", parts)}";
    }

    internal static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
    {
        if (sourceUnit.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return true;
        }

        return sourceUnit.ConvertRateToBase > 0 &&
               targetUnit.ConvertRateToBase > 0 &&
               string.Equals(
                   NormalizedBaseUnitCode(sourceUnit),
                   NormalizedBaseUnitCode(targetUnit),
                   StringComparison.OrdinalIgnoreCase);
    }

    internal static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var date) ? date : null;

    internal static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

    internal static WorkflowReportQueryDto CloneQuery(WorkflowReportQueryDto query, int limit)
        => new()
        {
            ServiceDate = query.ServiceDate,
            DateFrom = query.DateFrom,
            DateTo = query.DateTo,
            CustomerId = query.CustomerId,
            WarehouseId = query.WarehouseId,
            IngredientId = query.IngredientId,
            SupplierId = query.SupplierId,
            ShiftName = query.ShiftName,
            Format = query.Format,
            CursorDate = query.CursorDate,
            CursorId = query.CursorId,
            CursorOffset = query.CursorOffset,
            Limit = limit,
            SortDirection = query.SortDirection,
            Actor = query.Actor,
            BusinessArea = query.BusinessArea,
            EntityName = query.EntityName,
            FieldName = query.FieldName,
            GroupBy = query.GroupBy,
            PriceTier = query.PriceTier
        };

    private static int ResolvePriorityRank(string category, string severity)
        => category switch
        {
            "stock_shortage" or "negative_stock" or "inventory_ledger_mismatch" => 1,
            "missing_bom" or "missing_conversion" or "invalid_unit" => 2,
            "missing_contract" or "missing_supplier" => 2,
            "kitchen_receipt_discrepancy" or "inactive_bom_ingredient" => 3,
            "stale_demand" or "stale_purchase_request" => 3,
            "orphan_document" => 4,
            _ when severity == "error" => 2,
            _ => 4
        };

    private static int ResolveSlaHours(string category, string severity)
        => category switch
        {
            "stock_shortage" or "negative_stock" or "inventory_ledger_mismatch" => 2,
            "missing_bom" => 4,
            "missing_conversion" or "invalid_unit" => 8,
            "missing_contract" or "missing_supplier" => 8,
            "kitchen_receipt_discrepancy" => 12,
            "stale_demand" or "stale_purchase_request" => 24,
            "inactive_bom_ingredient" => 24,
            "orphan_document" => 48,
            _ when severity == "error" => 8,
            _ => 48
        };

    private static string FormatSlaLabel(int priorityRank, int slaHours)
        => priorityRank switch
        {
            1 => $"P1 / {slaHours}h",
            2 => $"P2 / {slaHours}h",
            3 => $"P3 / {slaHours}h",
            _ => $"P4 / {slaHours}h"
        };

    private static string ResolveOwner(string category, string route)
        => category switch
        {
            "missing_bom" or "legacy_missing_bom" or "inactive_bom_ingredient" => "Kitchen Admin",
            "invalid_unit" or "missing_conversion" or "legacy_missing_conversion" => "Admin dữ liệu",
            "missing_contract" => "Quản lý vận hành",
            "missing_supplier" or "stale_purchase_request" => "Thu mua",
            "stale_demand" => "Điều phối",
            "negative_stock" or "inventory_ledger_mismatch" or "stock_shortage" => "Thủ kho",
            "kitchen_receipt_discrepancy" => "Bếp trưởng",
            "orphan_document" when route.Contains("weekly-menu", StringComparison.OrdinalIgnoreCase) => "Điều phối",
            "orphan_document" when route.Contains("warehouse", StringComparison.OrdinalIgnoreCase) => "Thủ kho",
            _ => "Quản lý vận hành"
        };

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();

    private static string? NormalizeShiftName(string? shift)
        => string.IsNullOrWhiteSpace(shift)
            ? null
            : shift.Trim().ToUpperInvariant() switch
            {
                "SÁNG" or "SANG" or "BREAKFAST" => "BREAKFAST",
                "TRƯA" or "TRUA" or "LUNCH" => "LUNCH",
                "CHIỀU" or "CHIEU" or "DINNER" => "DINNER",
                "CẢ NGÀY" or "CA NGAY" or "FULLDAY" => "FULLDAY",
                _ => shift.Trim().ToUpperInvariant()
            };
}
