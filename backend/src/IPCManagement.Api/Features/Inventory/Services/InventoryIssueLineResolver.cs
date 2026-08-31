using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class InventoryIssueLineResolver
{
    internal static IReadOnlyList<ResolvedIssueLine> ResolveIssueLines(
        CreateInventoryIssueRequest dto,
        MaterialRequest materialRequest,
        IReadOnlyList<InventoryIssueLine> issuedLines)
    {
        var demandLines = materialRequest.Materialrequestlines
            .OrderBy(line => Convert.ToHexString(line.RequestLineId))
            .Select(line => new DemandLineSummary(
                line.RequestLineId,
                line.IngredientId,
                line.UnitId,
                line.Ingredient.IngredientName,
                line.Unit.UnitName,
                DecimalPolicy.RoundQuantity(line.TotalRequiredQty)))
            .ToList();

        if (demandLines.Count == 0)
        {
            throw new BusinessRuleException("Nhu cầu nguyên liệu chưa có dòng để xuất kho.");
        }

        var alreadyIssuedBySource = BuildIssuedBySourceLine(demandLines, issuedLines);

        var inputLines = dto.Lines ?? [];
        var requestedLines = inputLines.Count == 0
            ? BuildLinesFromRemainingDemand(demandLines, alreadyIssuedBySource)
            : BuildLinesFromRequest(inputLines, demandLines, alreadyIssuedBySource);

        if (requestedLines.Count == 0)
        {
            throw new BusinessRuleException("Nhu cầu nguyên liệu đã được xuất đủ.");
        }

        return requestedLines;
    }

    private static List<ResolvedIssueLine> BuildLinesFromRemainingDemand(
        IReadOnlyList<DemandLineSummary> demandLines,
        IReadOnlyDictionary<string, decimal> alreadyIssuedBySource)
    {
        var lines = new List<ResolvedIssueLine>();
        foreach (var demand in demandLines)
        {
            var remaining = CalculateRemaining(
                demand.TotalRequiredQty,
                alreadyIssuedBySource.GetValueOrDefault(BuildSourceKey(demand.MaterialRequestLineId)));
            if (DecimalPolicy.GreaterThanQuantity(remaining, 0))
            {
                lines.Add(new ResolvedIssueLine(
                    demand.MaterialRequestLineId,
                    demand.IngredientId,
                    demand.UnitId,
                    remaining,
                    remaining));
            }
        }

        return lines;
    }

    private static List<ResolvedIssueLine> BuildLinesFromRequest(
        IReadOnlyList<CreateInventoryIssueLineRequest> inputLines,
        IReadOnlyList<DemandLineSummary> demandLines,
        IReadOnlyDictionary<string, decimal> alreadyIssuedBySource)
    {
        var result = new List<ResolvedIssueLine>();
        var requestedBySource = new Dictionary<string, decimal>();
        foreach (var input in inputLines)
        {
            var ingredientId = GuidHelper.ParseGuidString(input.IngredientId)
                ?? throw new ArgumentException($"IngredientId '{input.IngredientId}' không hợp lệ.");
            var unitId = GuidHelper.ParseGuidString(input.UnitId)
                ?? throw new ArgumentException($"UnitId '{input.UnitId}' không hợp lệ.");
            var requestedQty = DecimalPolicy.RoundQuantity(input.RequestedQty);
            var issuedQty = DecimalPolicy.RoundQuantity(input.IssuedQty);
            var explicitSourceId = string.IsNullOrWhiteSpace(input.MaterialRequestLineId)
                ? null
                : GuidHelper.ParseGuidString(input.MaterialRequestLineId)
                    ?? throw new ArgumentException($"MaterialRequestLineId '{input.MaterialRequestLineId}' không hợp lệ.");
            var candidates = demandLines
                .Where(demand => demand.IngredientId.SequenceEqual(ingredientId) && demand.UnitId.SequenceEqual(unitId))
                .ToList();
            if (explicitSourceId is null && candidates.Count > 1)
            {
                throw new BusinessRuleException("Nhu cầu có nhiều dòng cùng nguyên liệu và đơn vị; cần chỉ rõ MaterialRequestLineId.");
            }
            var demand = explicitSourceId is null
                ? candidates.SingleOrDefault()
                : candidates.SingleOrDefault(candidate => candidate.MaterialRequestLineId.SequenceEqual(explicitSourceId));
            if (demand is null)
            {
                throw new BusinessRuleException("Dòng xuất kho không nằm trong nhu cầu nguyên liệu đã duyệt.");
            }

            if (!DecimalPolicy.GreaterThanQuantity(requestedQty, 0) ||
                !DecimalPolicy.GreaterThanQuantity(issuedQty, 0))
            {
                throw new BusinessRuleException("Số lượng xuất kho phải lớn hơn 0.");
            }
            if (DecimalPolicy.GreaterThanQuantity(issuedQty, requestedQty))
            {
                throw new BusinessRuleException("Số lượng xuất không được lớn hơn số lượng yêu cầu.");
            }

            var sourceKey = BuildSourceKey(demand.MaterialRequestLineId);
            if (requestedBySource.ContainsKey(sourceKey))
            {
                throw new BusinessRuleException("Mỗi dòng nhu cầu chỉ được xuất một lần trong cùng lệnh.");
            }
            var requestedEarlier = requestedBySource.GetValueOrDefault(sourceKey);
            var remaining = CalculateRemaining(
                demand.TotalRequiredQty,
                alreadyIssuedBySource.GetValueOrDefault(sourceKey) + requestedEarlier);
            if (DecimalPolicy.GreaterThanQuantity(requestedQty, remaining))
            {
                throw new BusinessRuleException(
                    $"Dòng xuất kho '{demand.IngredientName}' vượt nhu cầu còn lại. Yêu cầu: {requestedQty}, còn lại: {remaining}.");
            }

            requestedBySource[sourceKey] = requestedEarlier + requestedQty;
            result.Add(new ResolvedIssueLine(demand.MaterialRequestLineId, ingredientId, unitId, requestedQty, issuedQty));
        }

        return result;
    }

    private static decimal CalculateRemaining(decimal requiredQty, decimal issuedQty)
        => DecimalPolicy.RoundQuantity(requiredQty - issuedQty);

    private static string BuildKey(byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToHexString(ingredientId)}:{Convert.ToHexString(unitId)}";

    internal static string BuildSourceKey(byte[] materialRequestLineId)
        => Convert.ToHexString(materialRequestLineId);

    internal static Dictionary<string, decimal> BuildIssuedBySourceLine(
        IReadOnlyList<DemandLineSummary> demandLines,
        IReadOnlyList<InventoryIssueLine> issuedLines)
    {
        var issuedBySource = issuedLines
            .Where(line => line.MaterialRequestLineId is not null)
            .GroupBy(line => BuildSourceKey(line.MaterialRequestLineId!))
            .ToDictionary(group => group.Key, group => DecimalPolicy.RoundQuantity(group.Sum(line => line.IssuedQty)));
        var legacyIssuedByItem = issuedLines
            .Where(line => line.MaterialRequestLineId is null)
            .GroupBy(line => BuildKey(line.IngredientId, line.UnitId))
            .ToDictionary(group => group.Key, group => DecimalPolicy.RoundQuantity(group.Sum(line => line.IssuedQty)));

        foreach (var (itemKey, legacyQuantity) in legacyIssuedByItem)
        {
            if (!DecimalPolicy.GreaterThanQuantity(legacyQuantity, 0))
            {
                continue;
            }
            var sourceCandidates = demandLines
                .Where(demand => BuildKey(demand.IngredientId, demand.UnitId) == itemKey)
                .ToList();
            if (sourceCandidates.Count != 1)
            {
                throw new BusinessRuleException(
                    "Có dòng xuất lịch sử chưa có lineage nhưng nhu cầu có nhiều dòng cùng nguyên liệu/đơn vị; cần đối soát trước khi xuất thêm.");
            }
            var sourceKey = BuildSourceKey(sourceCandidates[0].MaterialRequestLineId);
            issuedBySource[sourceKey] = DecimalPolicy.RoundQuantity(
                issuedBySource.GetValueOrDefault(sourceKey) + legacyQuantity);
        }

        return issuedBySource;
    }

    internal static void UpdateMaterialRequestStatusIfCompleted(
        IpcManagementContext? context,
        MaterialRequest materialRequest,
        IReadOnlyList<InventoryIssueLine> previouslyIssuedLines,
        IReadOnlyList<ResolvedIssueLine> currentIssueLines,
        byte[] userIdBytes)
    {
        if (context is null) return;
        var demandLines = materialRequest.Materialrequestlines
            .OrderBy(line => Convert.ToHexString(line.RequestLineId))
            .Select(line => new DemandLineSummary(line.RequestLineId, line.IngredientId, line.UnitId,
                line.Ingredient.IngredientName, line.Unit.UnitName, DecimalPolicy.RoundQuantity(line.TotalRequiredQty)))
            .ToList();
        var alreadyIssuedBySource = BuildIssuedBySourceLine(demandLines, previouslyIssuedLines);
        foreach (var issueLine in currentIssueLines)
        {
            var sourceKey = BuildSourceKey(issueLine.MaterialRequestLineId);
            alreadyIssuedBySource[sourceKey] = alreadyIssuedBySource.GetValueOrDefault(sourceKey) + issueLine.IssuedQty;
        }
        if (demandLines.Any(demand => DecimalPolicy.LessThanQuantity(
            alreadyIssuedBySource.GetValueOrDefault(BuildSourceKey(demand.MaterialRequestLineId), 0m), demand.TotalRequiredQty))) return;

        const string newStatus = "EXPORTED";
        var oldStatus = materialRequest.Status;
        if (string.Equals(oldStatus, newStatus, StringComparison.OrdinalIgnoreCase)) return;
        materialRequest.Status = newStatus;
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = userIdBytes,
            BusinessArea = "InventoryIssue", EntityName = nameof(MaterialRequest), EntityId = materialRequest.RequestId,
            FieldName = nameof(MaterialRequest.Status), OldValue = oldStatus, NewValue = newStatus,
            Reason = "Đã xuất đủ nguyên liệu, tự động chuyển trạng thái Nhu cầu thành EXPORTED."
        });
    }

    internal sealed record DemandLineSummary(
        byte[] MaterialRequestLineId,
        byte[] IngredientId,
        byte[] UnitId,
        string? IngredientName,
        string? UnitName,
        decimal TotalRequiredQty);

    internal sealed record ResolvedIssueLine(
        byte[] MaterialRequestLineId,
        byte[] IngredientId,
        byte[] UnitId,
        decimal RequestedQty,
        decimal IssuedQty);
}
