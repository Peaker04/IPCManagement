using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public sealed class SupplementalMaterialRequestService : ISupplementalMaterialRequestService
{
    private readonly IpcManagementContext _context;

    public SupplementalMaterialRequestService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<SupplementalMaterialRequestDto> CreateAsync(
        CreateSupplementalMaterialRequestDto request,
        string actorUserId,
        string? scopedWarehouseId = null)
    {
        var actorId = GuidHelper.ParseGuidString(actorUserId)
            ?? throw new ArgumentException("Người yêu cầu không hợp lệ.");
        var issueId = GuidHelper.ParseGuidString(request.IssueId)
            ?? throw new ArgumentException("Phiếu xuất không hợp lệ.");
        var issueLineId = GuidHelper.ParseGuidString(request.IssueLineId)
            ?? throw new ArgumentException("Dòng nguyên liệu không hợp lệ.");

        if (request.RequestedQty <= 0)
        {
            throw new ArgumentException("Số lượng yêu cầu bổ sung phải lớn hơn 0.");
        }

        var source = await _context.Inventoryissuelines.FindAsync(issueLineId)
            ?? throw new InvalidOperationException("Không tìm thấy dòng nguyên liệu trên phiếu xuất.");
        if (!source.IssueId.SequenceEqual(issueId))
        {
            throw new InvalidOperationException("Dòng nguyên liệu không thuộc phiếu xuất đã chọn.");
        }

        await _context.Entry(source).Reference(line => line.Issue).LoadAsync();
        await _context.Entry(source).Reference(line => line.Ingredient).LoadAsync();
        await _context.Entry(source).Reference(line => line.Unit).LoadAsync();

        if (source.Issue.ReceivedAt is null)
        {
            throw new InvalidOperationException("Bếp cần xác nhận đã nhận phiếu xuất trước khi yêu cầu bổ sung.");
        }

        var scopedWarehouse = GuidHelper.ParseGuidString(scopedWarehouseId);
        if (scopedWarehouseId is not null &&
            (scopedWarehouse is null || !source.Issue.WarehouseId.SequenceEqual(scopedWarehouse)))
        {
            throw new UnauthorizedAccessException("Không có quyền gửi yêu cầu bổ sung tới kho khác.");
        }

        var entity = new Supplementalmaterialrequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = $"SUP-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}",
            IssueId = source.IssueId,
            IssueLineId = source.IssueLineId,
            WarehouseId = source.Issue.WarehouseId,
            IngredientId = source.IngredientId,
            UnitId = source.UnitId,
            RequestedQty = request.RequestedQty,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
            Status = "PENDING",
            RequestedBy = actorId,
            RequestedAt = DateTime.UtcNow,
        };

        _context.Supplementalmaterialrequests.Add(entity);
        await _context.SaveChangesAsync();

        return new SupplementalMaterialRequestDto
        {
            RequestId = GuidHelper.ToGuidString(entity.RequestId),
            RequestCode = entity.RequestCode,
            IssueId = GuidHelper.ToGuidString(entity.IssueId),
            IssueCode = source.Issue.IssueCode,
            IssueLineId = GuidHelper.ToGuidString(entity.IssueLineId),
            WarehouseId = GuidHelper.ToGuidString(entity.WarehouseId),
            IngredientId = GuidHelper.ToGuidString(entity.IngredientId),
            IngredientName = source.Ingredient.IngredientName,
            UnitId = GuidHelper.ToGuidString(entity.UnitId),
            UnitName = source.Unit.UnitName,
            RequestedQty = entity.RequestedQty,
            Reason = entity.Reason,
            Status = entity.Status,
            RequestedAt = entity.RequestedAt,
        };
    }
}
