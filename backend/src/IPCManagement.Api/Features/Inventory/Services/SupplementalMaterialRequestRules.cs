using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class SupplementalMaterialRequestRules
{
    private const string PendingStatus = "PENDING_WAREHOUSE_REVIEW";
    private const string FulfilledStatus = "FULFILLED";
    private const string RejectedStatus = "REJECTED";
    private const string OpenIssueLineUniqueIndex = "uxSupplementalMaterialRequestsOpenIssueLine";

    internal static async Task<SupplementalMaterialRequest> LoadTrackedAsync(IpcManagementContext context, string id)
    {
        var requestId = GuidHelper.ParseGuidString(id)
            ?? throw new ArgumentException("Yêu cầu bổ sung không hợp lệ.");
        return await context.Supplementalmaterialrequests
            .FirstOrDefaultAsync(item => item.RequestId == requestId)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu cấp nguyên liệu bổ sung.");
    }
    internal static void AddAudit(
        IpcManagementContext context,
        SupplementalMaterialRequest entity,
        byte[] actorId,
        string fieldName,
        string? oldValue,
        string? newValue,
        string reason)
        => context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = actorId,
            BusinessArea = "SupplementalMaterial",
            EntityName = nameof(SupplementalMaterialRequest),
            EntityId = entity.RequestId,
            FieldName = fieldName,
            OldValue = oldValue,
            NewValue = newValue,
            Reason = reason,
        });

    internal static void EnsureActionable(SupplementalMaterialRequest entity)
    {
        var status = NormalizeStatus(entity.Status);
        if (status is RejectedStatus or FulfilledStatus)
        {
            throw new BusinessRuleException("Yêu cầu bổ sung đã ở trạng thái kết thúc và không thể thao tác thêm.");
        }
    }

    internal static void EnsureWarehouseScope(SupplementalMaterialRequest entity, string? scopedWarehouseId)
        => EnsureWarehouseScope(entity.WarehouseId, scopedWarehouseId);

    internal static void EnsureWarehouseScope(byte[] warehouseId, string? scopedWarehouseId)
    {
        if (scopedWarehouseId is null)
        {
            return;
        }
        var scopedWarehouse = GuidHelper.ParseGuidString(scopedWarehouseId);
        if (scopedWarehouse is null || !warehouseId.SequenceEqual(scopedWarehouse))
        {
            throw new UnauthorizedAccessException("Không có quyền xử lý yêu cầu của kho khác.");
        }
    }

    internal static byte[] ParseActor(string actorUserId)
        => GuidHelper.ParseGuidString(actorUserId)
            ?? throw new ArgumentException("Người thao tác không hợp lệ.");

    internal static string RequireCommandId(string? commandId)
        => !string.IsNullOrWhiteSpace(commandId) && commandId.Trim().Length <= 100
            ? commandId.Trim()
            : throw new ArgumentException("Mã thao tác không hợp lệ.");

    internal static SupplementalMaterialRequestDto DeserializeResponse(string responseJson)
        => JsonSerializer.Deserialize<SupplementalMaterialRequestDto>(responseJson)
            ?? throw new InvalidOperationException("Không thể đọc lại kết quả yêu cầu bổ sung.");

    internal static string NormalizeStatus(string? status)
        => string.Equals(status, "PENDING", StringComparison.OrdinalIgnoreCase)
            ? PendingStatus
            : status?.Trim().ToUpperInvariant() ?? PendingStatus;

    internal static bool IsInMemory(IpcManagementContext context)
        => string.Equals(
            context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);

    internal static bool IsOpenIssueLineUniqueViolation(DbUpdateException exception)
    {
        for (var inner = exception.InnerException; inner is not null; inner = inner.InnerException)
        {
            if (inner.Message.Contains(OpenIssueLineUniqueIndex, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
