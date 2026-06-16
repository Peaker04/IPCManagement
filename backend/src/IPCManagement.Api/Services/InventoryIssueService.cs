using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Services;

public class InventoryIssueService : IInventoryIssueService
{
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;

    public InventoryIssueService(
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService)
    {
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
    }

    public async Task<PagedResponseDto<InventoryIssueDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _issueRepository.GetPagedAsync(
            request.PageNumber,
            request.PageSize);

        return PagedResponseDto<InventoryIssueDto>.Create(
            items.Select(issue => InventoryMapper.MapIssue(issue)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<InventoryIssueDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var issue = await _issueRepository.GetByIdWithLinesAsync(bytes);
        return issue is null ? null : InventoryMapper.MapIssue(issue, includeLines: true);
    }

    public async Task<InventoryIssueCreatedDto?> CreateAsync(CreateInventoryIssueDto dto, string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var warehouseBytes = GuidHelper.ParseGuidString(dto.WarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        var materialRequestBytes = GuidHelper.ParseGuidString(dto.MaterialRequestId)
            ?? throw new ArgumentException("MaterialRequestId không hợp lệ.");
        var receivedByBytes = dto.ReceivedBy is not null
            ? GuidHelper.ParseGuidString(dto.ReceivedBy)
            : null;

        using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var issue = new Inventoryissue
            {
                IssueId = GuidHelper.NewId(),
                IssueCode = $"ISS-{DateTime.Now:yyyyMMdd-HHmmss}",
                IssueDate = dto.IssueDate,
                ShiftName = dto.ShiftName,
                WarehouseId = warehouseBytes,
                MaterialRequestId = materialRequestBytes,
                IssuedBy = userIdBytes,
                ReceivedBy = receivedByBytes,
                CreatedAt = DateTime.UtcNow
            };

            issue.Inventoryissuelines = dto.Lines.Select(line => new Inventoryissueline
            {
                IssueLineId = GuidHelper.NewId(),
                IssueId = issue.IssueId,
                IngredientId = GuidHelper.ParseGuidString(line.IngredientId)
                    ?? throw new ArgumentException($"IngredientId '{line.IngredientId}' không hợp lệ."),
                RequestedQty = line.RequestedQty,
                IssuedQty = line.IssuedQty,
                UnitId = GuidHelper.ParseGuidString(line.UnitId)
                    ?? throw new ArgumentException($"UnitId '{line.UnitId}' không hợp lệ.")
            }).ToList();

            // Add issue using sync change tracking
            _issueRepository.Add(issue);

            // Cập nhật tồn kho hiện tại + ghi nhận stock movements
            foreach (var line in issue.Inventoryissuelines)
            {
                await _stockLedgerService.RemoveStockWithCheckAsync(
                    warehouseBytes,
                    line.IngredientId,
                    line.UnitId,
                    line.IssuedQty,
                    "ISSUE",
                    "inventoryissues",
                    issue.IssueId,
                    userIdBytes,
                    "Xuất kho sản xuất",
                    $"Phiếu xuất {issue.IssueCode}");
            }

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return new InventoryIssueCreatedDto
            {
                IssueId = GuidHelper.ToGuidString(issue.IssueId),
                IssueCode = issue.IssueCode
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

}
