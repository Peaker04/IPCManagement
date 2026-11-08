using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class InventoryReturnSourceDeltaHandler
{
    public static async Task<ReconciliationSourceDelta?> ValidateAndLoadSourceDeltaAsync(
        IpcManagementContext? context,
        CreateInventoryReturnRequest dto,
        string returnType,
        string returnTypeReturn,
        byte[]? reconciliationBatchId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(dto.ReconciliationSourceDeltaId)) return null;

        if (context is null || dto.ExpectedSourceDeltaVersion is null || returnType != returnTypeReturn || reconciliationBatchId is null || dto.Lines.Count != 1)
            throw new BusinessRuleException("Hoàn trả thay đổi nguồn phải dùng đúng một dòng phiếu trả vật lý của lô đối chiếu.");

        var sourceDeltaId = GuidHelper.ParseGuidString(dto.ReconciliationSourceDeltaId)
            ?? throw new ArgumentException("ReconciliationSourceDeltaId không hợp lệ.");
        var sourceDelta = await context.Reconciliationsourcedeltas.SingleOrDefaultAsync(item => item.SourceDeltaId == sourceDeltaId, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy thay đổi nguồn cần hoàn trả.");

        if (sourceDelta.Status != "PENDING" || sourceDelta.Version != dto.ExpectedSourceDeltaVersion
            || sourceDelta.WorkKind != "RETURN_REQUIRED" || !sourceDelta.BatchId.SequenceEqual(reconciliationBatchId))
            throw new DbUpdateConcurrencyException("Thay đổi nguồn đã đổi hoặc không còn chờ hoàn trả; hãy tải lại hàng đợi.");

        return sourceDelta;
    }

    public static void ValidateReturnLineMatchesSourceDelta(
        ReconciliationSourceDelta? sourceDelta,
        InventoryReturn inventoryReturn,
        InventoryIssue issue)
    {
        if (sourceDelta is null) return;

        var returnLine = inventoryReturn.Inventoryreturnlines.Single();
        var sourceIssueLine = issue.Inventoryissuelines.Single(item => item.IssueLineId.SequenceEqual(returnLine.SourceIssueLineId!));
        if (sourceDelta.DailyLineId is null || sourceIssueLine.ReconciliationBatchDailyLineId is null
            || !sourceDelta.DailyLineId.SequenceEqual(sourceIssueLine.ReconciliationBatchDailyLineId)
            || !sourceDelta.IngredientId.SequenceEqual(returnLine.IngredientId)
            || !sourceDelta.CanonicalUnitId.SequenceEqual(returnLine.UnitId)
            || DecimalPolicy.RoundQuantity(Math.Abs(sourceDelta.DeltaQuantity)) != returnLine.Quantity)
            throw new DbUpdateConcurrencyException("Dòng hoàn trả không khớp delta nguồn đang chờ xử lý.");
    }

    public static async Task<ReconciliationSourceDelta?> ValidateSourceDeltaForReceiptAsync(
        IpcManagementContext? context,
        InventoryReturn inventoryReturn,
        CancellationToken cancellationToken = default)
    {
        if (inventoryReturn.ReconciliationSourceDeltaId is null || context is null) return null;

        var sourceDelta = await context.Reconciliationsourcedeltas.SingleOrDefaultAsync(
            item => item.SourceDeltaId == inventoryReturn.ReconciliationSourceDeltaId, cancellationToken)
            ?? throw new BusinessRuleException("Không tìm thấy delta nguồn của phiếu trả.");

        if (sourceDelta.Status != "PENDING" || sourceDelta.Version != inventoryReturn.ReconciliationSourceDeltaVersion
            || sourceDelta.WorkKind != "RETURN_REQUIRED")
            throw new DbUpdateConcurrencyException("Delta nguồn đã thay đổi; hãy tải lại trước khi nhận hoàn trả.");

        return sourceDelta;
    }

    public static void ResolveSourceDeltaOnReceipt(
        IpcManagementContext context,
        ReconciliationSourceDelta? sourceDelta,
        InventoryReturn inventoryReturn,
        DateTime confirmedAt,
        byte[] userIdBytes,
        string commandId)
    {
        if (sourceDelta is null) return;

        context.Entry(sourceDelta).Property(item => item.Version).OriginalValue = inventoryReturn.ReconciliationSourceDeltaVersion!.Value;
        sourceDelta.Status = "RESOLVED";
        sourceDelta.Version++;
        sourceDelta.ResolvedAt = confirmedAt;
        sourceDelta.ResolvedBy = userIdBytes;
        sourceDelta.ResolutionEntity = nameof(InventoryReturn);
        sourceDelta.ResolutionId = inventoryReturn.ReturnId;
        sourceDelta.ResolutionCommandId = commandId;
    }
}
