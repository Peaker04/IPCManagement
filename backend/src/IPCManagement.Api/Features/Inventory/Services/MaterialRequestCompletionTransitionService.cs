using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Inventory.Services;

public interface IMaterialRequestCompletionTransitionService
{
    MaterialRequestCompletionTransitionResult Stage(MaterialRequestCompletionTransitionInput input);
}

public sealed record MaterialRequestCompletionTransitionInput(
    MaterialRequest MaterialRequest,
    IReadOnlyList<InventoryIssueLine> PreviouslyIssuedLines,
    IReadOnlyList<MaterialRequestCompletionIssueLine> CurrentIssueLines,
    byte[] ChangedBy);

public sealed record MaterialRequestCompletionIssueLine(byte[] MaterialRequestLineId, decimal IssuedQty);

public enum MaterialRequestCompletionTransitionOutcome
{
    Incomplete,
    Transitioned,
    AlreadyCompleted
}

public sealed record MaterialRequestCompletionTransitionResult(
    MaterialRequestCompletionTransitionOutcome Outcome,
    string PreviousStatus,
    string CurrentStatus);

public sealed class MaterialRequestCompletionTransitionService(IpcManagementContext context)
    : IMaterialRequestCompletionTransitionService
{
    public MaterialRequestCompletionTransitionResult Stage(MaterialRequestCompletionTransitionInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(input.MaterialRequest);

        var request = input.MaterialRequest;
        const string completedStatus = "EXPORTED";
        if (string.Equals(request.Status, completedStatus, StringComparison.OrdinalIgnoreCase))
        {
            return new MaterialRequestCompletionTransitionResult(
                MaterialRequestCompletionTransitionOutcome.AlreadyCompleted,
                request.Status,
                request.Status);
        }

        var demandLines = request.Materialrequestlines
            .OrderBy(line => Convert.ToHexString(line.RequestLineId))
            .Select(line => new InventoryIssueLineResolver.DemandLineSummary(
                line.RequestLineId,
                line.IngredientId,
                line.UnitId,
                line.Ingredient.IngredientName,
                line.Unit.UnitName,
                DecimalPolicy.RoundQuantity(line.TotalRequiredQty)))
            .ToList();
        var demandIds = demandLines
            .Select(line => InventoryIssueLineResolver.BuildSourceKey(line.MaterialRequestLineId))
            .ToHashSet(StringComparer.Ordinal);

        foreach (var issuedLine in input.PreviouslyIssuedLines)
        {
            if (issuedLine.Issue is null ||
                issuedLine.Issue.MaterialRequestId is null ||
                !issuedLine.Issue.MaterialRequestId.SequenceEqual(request.RequestId) ||
                issuedLine.Issue.ReconciliationBatchId is not null ||
                issuedLine.ReconciliationBatchLineId is not null)
            {
                throw new BusinessRuleException("Dòng xuất không thuộc exact MaterialRequest lineage nên không thể hoàn tất nhu cầu.");
            }

            if (issuedLine.MaterialRequestLineId is not null &&
                !demandIds.Contains(InventoryIssueLineResolver.BuildSourceKey(issuedLine.MaterialRequestLineId)))
            {
                throw new BusinessRuleException("Dòng xuất tham chiếu dòng nhu cầu ngoài MaterialRequest hiện tại.");
            }
        }

        var issuedBySource = InventoryIssueLineResolver.BuildIssuedBySourceLine(demandLines, input.PreviouslyIssuedLines);
        foreach (var issueLine in input.CurrentIssueLines)
        {
            var sourceKey = InventoryIssueLineResolver.BuildSourceKey(issueLine.MaterialRequestLineId);
            if (!demandIds.Contains(sourceKey))
                throw new BusinessRuleException("Dòng xuất mới tham chiếu dòng nhu cầu ngoài MaterialRequest hiện tại.");
            issuedBySource[sourceKey] = DecimalPolicy.RoundQuantity(
                issuedBySource.GetValueOrDefault(sourceKey) + issueLine.IssuedQty);
        }

        if (demandLines.Any(demand => DecimalPolicy.LessThanQuantity(
                issuedBySource.GetValueOrDefault(InventoryIssueLineResolver.BuildSourceKey(demand.MaterialRequestLineId)),
                demand.TotalRequiredQty)))
        {
            return new MaterialRequestCompletionTransitionResult(
                MaterialRequestCompletionTransitionOutcome.Incomplete,
                request.Status,
                request.Status);
        }

        var previousStatus = request.Status;
        var changedAt = DateTime.UtcNow;
        request.Status = completedStatus;
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = changedAt,
            ChangedBy = input.ChangedBy,
            BusinessArea = "InventoryIssue",
            EntityName = nameof(MaterialRequest),
            EntityId = request.RequestId,
            FieldName = nameof(MaterialRequest.Status),
            OldValue = previousStatus,
            NewValue = completedStatus,
            Reason = "Đã xuất đủ nguyên liệu, tự động chuyển trạng thái Nhu cầu thành EXPORTED."
        });

        return new MaterialRequestCompletionTransitionResult(
            MaterialRequestCompletionTransitionOutcome.Transitioned,
            previousStatus,
            completedStatus);
    }
}
