using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class InventoryReturnRules
{
    internal static void EnsureAllocationContext(IpcManagementContext? context)
    {
        if (context is null) throw new InvalidOperationException("Allocation disposition requires the inventory data context.");
    }

    internal static void ValidateReturnQuantity(
        InventoryIssueLine sourceLine,
        decimal alreadyAccounted,
        decimal accountedQuantity)
    {
        if (!DecimalPolicy.GreaterThanQuantity(accountedQuantity, 0))
        {
            throw new BusinessRuleException("Số lượng trả/hao hụt phải lớn hơn 0.");
        }

        if (DecimalPolicy.GreaterThanQuantity(alreadyAccounted + accountedQuantity, sourceLine.IssuedQty))
        {
            throw new BusinessRuleException(
                $"Số lượng trả/hao hụt vượt quá số lượng đã xuất. Đã xuất: {sourceLine.IssuedQty}, đã ghi nhận: {alreadyAccounted}, ghi thêm: {accountedQuantity}.");
        }
    }

    internal static void EnsureCompatibleCrossCustomerScope(SourceLineScope source, SourceLineScope destination)
    {
        if (source.PlanLine.CustomerId.SequenceEqual(destination.PlanLine.CustomerId))
            throw new BusinessRuleException("Disposition cross-customer phải chọn dòng đích của khách hàng khác.");
        if (!source.Line.IngredientId.SequenceEqual(destination.Line.IngredientId) || !source.Line.UnitId.SequenceEqual(destination.Line.UnitId))
            throw new BusinessRuleException("Dòng nguồn và dòng đích phải khớp exact ingredient và unit; tên nguyên liệu không đủ.");
        if (source.Issue.ReceivedAt is null || destination.Issue.ReceivedAt is null)
            throw new BusinessRuleException("Cả hai dòng nguồn phải được Bếp xác nhận trước disposition.");
    }

    internal static InventoryAllocationDispositionDto MapDisposition(InventoryAllocationDisposition item) => new()
    {
        AllocationDispositionId = GuidHelper.ToGuidString(item.AllocationDispositionId),
        SourceIssueLineId = GuidHelper.ToGuidString(item.SourceIssueLineId),
        DestinationSourceLineId = GuidHelper.ToGuidString(item.DestinationIssueLineId),
        Quantity = item.Quantity,
        Reason = item.Reason,
        CreatedBy = GuidHelper.ToGuidString(item.CreatedBy),
        CreatedAt = item.CreatedAt,
        Version = item.Version,
        CorrelationId = item.CorrelationId,
        CausationId = item.CausationId,
    };

    internal static InventoryAllocationDispositionDto DeserializeDisposition(string responseJson)
        => JsonSerializer.Deserialize<InventoryAllocationDispositionDto>(responseJson)
            ?? throw new InvalidOperationException("Không thể đọc lại kết quả allocation disposition.");

    internal static async Task<byte[]> ResolveCanonicalWarehouseAsync(
        IOperationalWarehouseResolver resolver,
        string? suppliedWarehouseId,
        bool authorizationScope = false)
    {
        var canonicalId = await resolver.ResolveAsync();
        if (suppliedWarehouseId is null) return canonicalId;
        var suppliedId = GuidHelper.ParseGuidString(suppliedWarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        if (!suppliedId.AsSpan().SequenceEqual(canonicalId))
        {
            if (authorizationScope)
                throw new UnauthorizedAccessException("Phạm vi kho không khớp kho vận hành của hệ thống.");
            throw new BusinessRuleException("Kho trên yêu cầu không khớp kho vận hành của hệ thống.");
        }
        return canonicalId;
    }

    internal static string BuildDecisionId(string sourceIssueLineId) => $"return-allocation:{sourceIssueLineId}";
    internal static byte[] ParseRequiredId(string? value, string message) => GuidHelper.ParseGuidString(value) ?? throw new ArgumentException(message);
    internal static string RequireText(string? value, string message, int maximumLength)
        => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= maximumLength ? value.Trim() : throw new ArgumentException(message);
    internal sealed record SourceLineScope(
        InventoryIssueLine Line,
        InventoryIssue Issue,
        MaterialRequestLine Material,
        ProductionPlanLine PlanLine,
        ProductionPlan Plan);
    internal static string NormalizeReturnType(string? returnType)
    {
        var normalized = string.IsNullOrWhiteSpace(returnType)
            ? "RETURN"
            : returnType.Trim().ToUpperInvariant();

        return normalized is "RETURN" or "WASTE"
            ? normalized
            : throw new ArgumentException("Loại ghi nhận phải là RETURN hoặc WASTE.");
    }

    internal static string ResolveReturnCodePrefix(string returnType)
        => returnType == "WASTE" ? "WST" : "RET";}
