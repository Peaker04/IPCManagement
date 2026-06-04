using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Inventory;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Repositories;
using IPCManagement.Application.Interfaces.Services;
using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Services;

public class InventoryIssueService : IInventoryIssueService
{
    private readonly IInventoryIssueRepository _issueRepository;

    public InventoryIssueService(IInventoryIssueRepository issueRepository)
    {
        _issueRepository = issueRepository;
    }

    public async Task<PagedResponseDto<InventoryIssueDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _issueRepository.GetPagedAsync(
            request.PageNumber,
            request.PageSize);

        return PagedResponseDto<InventoryIssueDto>.Create(
            items.Select(issue => MapIssue(issue)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<InventoryIssueDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var issue = await _issueRepository.GetByIdWithLinesAsync(bytes);
        return issue is null ? null : MapIssue(issue, includeLines: true);
    }

    private static InventoryIssueDto MapIssue(Inventoryissue issue, bool includeLines = false) => new()
    {
        IssueId = GuidHelper.ToGuidString(issue.IssueId),
        IssueCode = issue.IssueCode,
        IssueDate = issue.IssueDate,
        ShiftName = issue.ShiftName,
        WarehouseId = GuidHelper.ToGuidString(issue.WarehouseId),
        WarehouseName = issue.Warehouse?.WarehouseName,
        MaterialRequestId = GuidHelper.ToGuidString(issue.MaterialRequestId),
        IssuedBy = GuidHelper.ToGuidString(issue.IssuedBy),
        IssuedByName = issue.IssuedByNavigation?.FullName,
        ReceivedBy = issue.ReceivedBy is not null ? GuidHelper.ToGuidString(issue.ReceivedBy) : null,
        ReceivedByName = issue.ReceivedByNavigation?.FullName,
        CreatedAt = issue.CreatedAt,
        Lines = includeLines
            ? issue.Inventoryissuelines.Select(MapLine).ToList()
            : new List<InventoryIssueLineDto>()
    };

    private static InventoryIssueLineDto MapLine(Inventoryissueline line) => new()
    {
        IssueLineId = GuidHelper.ToGuidString(line.IssueLineId),
        IngredientId = GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line.Ingredient?.IngredientName,
        RequestedQty = line.RequestedQty,
        IssuedQty = line.IssuedQty,
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName
    };
}
