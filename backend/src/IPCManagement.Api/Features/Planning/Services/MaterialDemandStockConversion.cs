using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Planning.Services;

internal sealed record StockConversionResult(
    decimal Quantity,
    IReadOnlyList<MissingUnitConversionIssueDto> MissingConversionIssues);

internal static class MaterialDemandStockConversion
{
    public static StockConversionResult Calculate(IReadOnlyList<CurrentStock> stocks, Unit bomUnit)
    {
        if (stocks.Count == 0)
        {
            return new StockConversionResult(0m, []);
        }

        var total = 0m;
        var issues = new List<MissingUnitConversionIssueDto>();
        foreach (var stock in stocks)
        {
            if (MaterialStockPool.TryConvertQuantity(stock.CurrentQty, stock.Unit, bomUnit, out var convertedQty))
            {
                total += convertedQty;
                continue;
            }

            issues.Add(BuildMissingConversionIssue(stock.Unit, bomUnit));
        }

        return new StockConversionResult(DecimalPolicy.RoundQuantity(total), Deduplicate(issues));
    }

    public static IReadOnlyList<MissingUnitConversionIssueDto> Deduplicate(
        IEnumerable<MissingUnitConversionIssueDto> issues)
        => issues
            .GroupBy(issue => issue.IssueId)
            .Select(group => group.First())
            .ToList();

    private static MissingUnitConversionIssueDto BuildMissingConversionIssue(Unit sourceUnit, Unit targetUnit)
    {
        var sourceUnitId = GuidHelper.ToGuidString(sourceUnit.UnitId);
        var targetUnitId = GuidHelper.ToGuidString(targetUnit.UnitId);
        return new MissingUnitConversionIssueDto
        {
            IssueId = $"missing_conversion:{sourceUnitId}:{targetUnitId}",
            SourceUnitId = sourceUnitId,
            SourceUnitName = sourceUnit.UnitName,
            TargetUnitId = targetUnitId,
            TargetUnitName = targetUnit.UnitName,
            Message = $"Thiếu cấu hình quy đổi từ {sourceUnit.UnitName} sang {targetUnit.UnitName}."
        };
    }
}
