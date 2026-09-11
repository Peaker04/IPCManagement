using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Planning.Services;

internal static class ServiceRunRules
{
    internal static async Task<ServiceRun?> LoadTrackedAsync(
        IpcManagementContext context,
        string serviceRunId,
        CancellationToken cancellationToken)
    {
        var runId = GuidHelper.ParseGuidString(serviceRunId) ?? throw new ArgumentException("Ca phục vụ không hợp lệ.");
        return await context.Serviceruns.FirstOrDefaultAsync(item => item.ServiceRunId.SequenceEqual(runId), cancellationToken);
    }

    internal static async Task<bool> HasBomBlockerAsync(
        IpcManagementContext context,
        DateOnly serviceDate,
        IReadOnlyCollection<ProductionPlanLine> planLines,
        CancellationToken cancellationToken)
    {
        if (planLines.Count == 0) return false;
        var dishIds = planLines.Select(line => line.DishId).ToList();
        var boms = await context.Dishboms.AsNoTracking().Where(bom => dishIds.Contains(bom.DishId) && bom.BomStatus == "PUBLISHED" && bom.EffectiveFrom <= serviceDate && (bom.EffectiveTo == null || bom.EffectiveTo >= serviceDate)).ToListAsync(cancellationToken);
        return planLines.Any(line => !boms.Any(bom => bom.DishId.SequenceEqual(line.DishId) && bom.PriceTierAmount == line.QuantityPlanLine.MenuSchedule.MenuPrice && (bom.CustomerId is null || bom.CustomerId.SequenceEqual(line.CustomerId))));
    }

    internal static void EnsureOpen(ServiceRun run)
    {
        if (run.ClosedAt is not null) throw new InvalidOperationException("Ca đã đóng; hãy dùng luồng điều chỉnh có audit.");
    }

    internal static void EnsureReadyForConfirmation(ServiceRunLifecycleProjectionDto projection)
    {
        var unresolved = projection.Blockers.Where(blocker => blocker != ServiceRunBlocker.ServiceConfirmationRequired).ToList();
        if (unresolved.Count > 0) throw new InvalidOperationException("Ca còn blocker nghiệp vụ nên chưa thể xác nhận phục vụ.");
    }

    internal static byte[] ParseActor(string? userId) => GuidHelper.ParseGuidString(userId) ?? throw new UnauthorizedAccessException("Không xác định được người thao tác.");
    internal static string RequireCommandId(string? commandId) => string.IsNullOrWhiteSpace(commandId) ? throw new ArgumentException("CommandId không được để trống.") : commandId.Trim();
    internal static void EnsureExpectedVersion(ServiceRun run, long expectedVersion)
    {
        if (run.ConcurrencyVersion != expectedVersion)
            throw new DbUpdateConcurrencyException("Ca phục vụ đã thay đổi; hãy tải lại trạng thái hiện hành.");
    }
    internal static string RequireReason(string? reason, string message) => NormalizeOptionalReason(reason) ?? throw new ArgumentException(message);
    internal static string? NormalizeOptionalReason(string? reason) => string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    internal static bool CanConfirmOrWaive(IReadOnlyList<string> blockers)
        => blockers.Count == 1 && blockers[0] == ServiceRunBlocker.ServiceConfirmationRequired;

    internal static IReadOnlyList<ServiceRunTrackDto> BuildTracks(IReadOnlyList<string> blockers, string status)
    {
        var tracks = ServiceRunTrackDto.CreateEmptyTracks().Select(track => new ServiceRunTrackDto
        {
            TrackId = track.TrackId, DisplayLabel = track.DisplayLabel, ResponsibleRole = track.ResponsibleRole,
            Status = status, Blockers = blockers.Where(blocker => TrackForBlocker(blocker) == track.TrackId)
                .Select(blocker => new ServiceRunBlockerEvidenceDto { BlockerCode = blocker, DisplayLabel = blocker }).ToList(),
        }).ToList();
        return tracks;
    }

    internal static IReadOnlyList<ServiceRunAllowedActionDto> BuildAllowedActions(ServiceRun run, ServiceRunLifecycleEvaluation lifecycle, bool canSetConfirmationOutcome)
    {
        var actions = new List<ServiceRunAllowedActionDto>();
        if (lifecycle.CanStartService && run.StartedAt is null) actions.Add(new() { ActionId = "START", DisplayLabel = "Bắt đầu phục vụ" });
        if (run.ClosedAt is null && (run.StartedAt is not null || lifecycle.CanStartService)) actions.Add(new() { ActionId = "RECORD_ACTUAL", DisplayLabel = "Ghi nhận suất thực tế" });
        if (canSetConfirmationOutcome) actions.Add(new() { ActionId = "CONFIRM", DisplayLabel = "Xác nhận phục vụ" });
        if (canSetConfirmationOutcome && run.ServiceConfirmationPolicy == ServiceConfirmationPolicy.Waivable) actions.Add(new() { ActionId = "WAIVE_CONFIRMATION", DisplayLabel = "Miễn xác nhận" });
        if (lifecycle.CanClose) actions.Add(new() { ActionId = "CLOSE", DisplayLabel = "Đóng ca" });
        return actions;
    }

    internal static string TrackForBlocker(string blocker) => blocker switch
    {
        ServiceRunBlocker.PlanNotSignedOff or ServiceRunBlocker.DemandNotGenerated or ServiceRunBlocker.BomIncomplete => "PLANNING",
        ServiceRunBlocker.OpenSupply or ServiceRunBlocker.UnreceivedIssue or ServiceRunBlocker.OpenSupplemental => "MATERIAL_SUPPLY",
        ServiceRunBlocker.ActualServingsNotRecorded or ServiceRunBlocker.ServiceConfirmationRequired or ServiceRunBlocker.ConfirmationOutcomeConflict => "SERVICE_EXECUTION",
        _ => "RECONCILIATION",
    };

    internal static bool TryReadCloseSnapshot(string? json, out ServiceRunOperationalRowDto row)
    {
        row = new ServiceRunOperationalRowDto();
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            var snapshot = JsonSerializer.Deserialize<ServiceRunCloseSnapshotDto>(json);
            if (snapshot is null || snapshot.Version < 2 || string.IsNullOrWhiteSpace(snapshot.OperationalRow.Lifecycle.ServiceRunId)) return false;
            row = snapshot.OperationalRow;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    internal static ServiceRunOperationalRowDto ToClosedSnapshot(ServiceRunOperationalRowDto row)
    {
        row.IsCloseSnapshot = true;
        row.Lifecycle.Status = ServiceRunStatus.Closed;
        row.Lifecycle.Blockers = [];
        row.Lifecycle.CanStartService = false;
        row.Lifecycle.CanRecordActualServings = false;
        row.Lifecycle.CanConfirmService = false;
        row.Lifecycle.CanWaiveServiceConfirmation = false;
        row.Lifecycle.CanResolveVariance = false;
        row.Lifecycle.CanResolveServingVariance = false;
        row.Lifecycle.CanClose = false;
        return row;
    }

    internal static string NormalizeShift(string? shiftName) => (shiftName ?? string.Empty).Trim().ToUpperInvariant() switch
    {
        "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
        "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
        _ => throw new ArgumentException("Ca phục vụ không hợp lệ."),
    };

    internal static string ItemKey(byte[] ingredientId, byte[] unitId) => $"{Convert.ToBase64String(ingredientId)}:{Convert.ToBase64String(unitId)}";
    internal static ServiceRunAdjustmentDto ToAdjustmentDto(ServiceRunAdjustment item) => new()
    {
        ServiceRunAdjustmentId = GuidHelper.ToGuidString(item.ServiceRunAdjustmentId), ServiceRunId = GuidHelper.ToGuidString(item.ServiceRunId),
        CorrectedActualServings = item.CorrectedActualServings, Reason = item.Reason, CreatedAt = item.CreatedAt,
    };}
