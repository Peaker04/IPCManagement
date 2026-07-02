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
    private static readonly HashSet<string> IssuableDemandStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "MANAGERAPPROVED",
        "APPROVED",
        "SENTTOWAREHOUSE"
    };

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
        var materialRequest = await _issueRepository.GetMaterialRequestForIssueAsync(materialRequestBytes)
            ?? throw new InvalidOperationException("Không tìm thấy nhu cầu nguyên liệu để tạo phiếu xuất kho.");
        if (!IssuableDemandStatuses.Contains(materialRequest.Status))
        {
            throw new InvalidOperationException("Cần duyệt nhu cầu nguyên liệu trước khi xuất kho.");
        }

        var issuedLines = await _issueRepository.GetIssuedLinesForMaterialRequestAsync(materialRequestBytes);
        var issueLines = ResolveIssueLines(dto, materialRequest, issuedLines);

        using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var issue = new Inventoryissue
            {
                IssueId = GuidHelper.NewId(),
                IssueCode = $"ISS-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
                IssueDate = dto.IssueDate,
                ShiftName = dto.ShiftName,
                WarehouseId = warehouseBytes,
                MaterialRequestId = materialRequestBytes,
                IssuedBy = userIdBytes,
                ReceivedBy = receivedByBytes,
                CreatedAt = DateTime.UtcNow
            };

            issue.Inventoryissuelines = issueLines.Select(line => new Inventoryissueline
            {
                IssueLineId = GuidHelper.NewId(),
                IssueId = issue.IssueId,
                IngredientId = line.IngredientId,
                RequestedQty = line.RequestedQty,
                IssuedQty = line.IssuedQty,
                UnitId = line.UnitId
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

    private static IReadOnlyList<ResolvedIssueLine> ResolveIssueLines(
        CreateInventoryIssueDto dto,
        Materialrequest materialRequest,
        IReadOnlyList<Inventoryissueline> issuedLines)
    {
        var demandByItem = materialRequest.Materialrequestlines
            .GroupBy(line => BuildKey(line.IngredientId, line.UnitId))
            .ToDictionary(
                group => group.Key,
                group => new DemandLineSummary(
                    group.First().IngredientId,
                    group.First().UnitId,
                    group.First().Ingredient.IngredientName,
                    group.First().Unit.UnitName,
                    DecimalPolicy.RoundQuantity(group.Sum(line => line.TotalRequiredQty))));

        if (demandByItem.Count == 0)
        {
            throw new InvalidOperationException("Nhu cầu nguyên liệu chưa có dòng để xuất kho.");
        }

        var alreadyIssuedByItem = issuedLines
            .GroupBy(line => BuildKey(line.IngredientId, line.UnitId))
            .ToDictionary(
                group => group.Key,
                group => DecimalPolicy.RoundQuantity(group.Sum(line => line.IssuedQty)));

        var inputLines = dto.Lines ?? [];
        var requestedLines = inputLines.Count == 0
            ? BuildLinesFromRemainingDemand(demandByItem, alreadyIssuedByItem)
            : BuildLinesFromRequest(inputLines, demandByItem, alreadyIssuedByItem);

        if (requestedLines.Count == 0)
        {
            throw new InvalidOperationException("Nhu cầu nguyên liệu đã được xuất đủ.");
        }

        return requestedLines;
    }

    private static List<ResolvedIssueLine> BuildLinesFromRemainingDemand(
        IReadOnlyDictionary<string, DemandLineSummary> demandByItem,
        IReadOnlyDictionary<string, decimal> alreadyIssuedByItem)
    {
        var lines = new List<ResolvedIssueLine>();
        foreach (var (key, demand) in demandByItem)
        {
            var remaining = CalculateRemaining(demand.TotalRequiredQty, alreadyIssuedByItem.GetValueOrDefault(key));
            if (DecimalPolicy.GreaterThanQuantity(remaining, 0))
            {
                lines.Add(new ResolvedIssueLine(demand.IngredientId, demand.UnitId, remaining, remaining));
            }
        }

        return lines;
    }

    private static List<ResolvedIssueLine> BuildLinesFromRequest(
        IReadOnlyList<CreateInventoryIssueLineDto> inputLines,
        IReadOnlyDictionary<string, DemandLineSummary> demandByItem,
        IReadOnlyDictionary<string, decimal> alreadyIssuedByItem)
    {
        var groupedLines = inputLines
            .Select(line =>
            {
                var ingredientId = GuidHelper.ParseGuidString(line.IngredientId)
                    ?? throw new ArgumentException($"IngredientId '{line.IngredientId}' không hợp lệ.");
                var unitId = GuidHelper.ParseGuidString(line.UnitId)
                    ?? throw new ArgumentException($"UnitId '{line.UnitId}' không hợp lệ.");
                return new ResolvedIssueLine(
                    ingredientId,
                    unitId,
                    DecimalPolicy.RoundQuantity(line.RequestedQty),
                    DecimalPolicy.RoundQuantity(line.IssuedQty));
            })
            .GroupBy(line => BuildKey(line.IngredientId, line.UnitId))
            .Select(group => new
            {
                Key = group.Key,
                Line = new ResolvedIssueLine(
                    group.First().IngredientId,
                    group.First().UnitId,
                    DecimalPolicy.RoundQuantity(group.Sum(line => line.RequestedQty)),
                    DecimalPolicy.RoundQuantity(group.Sum(line => line.IssuedQty)))
            })
            .ToList();

        var result = new List<ResolvedIssueLine>();
        foreach (var item in groupedLines)
        {
            if (!demandByItem.TryGetValue(item.Key, out var demand))
            {
                throw new InvalidOperationException("Dòng xuất kho không nằm trong nhu cầu nguyên liệu đã duyệt.");
            }

            if (!DecimalPolicy.GreaterThanQuantity(item.Line.RequestedQty, 0) ||
                !DecimalPolicy.GreaterThanQuantity(item.Line.IssuedQty, 0))
            {
                throw new InvalidOperationException("Số lượng xuất kho phải lớn hơn 0.");
            }
            if (DecimalPolicy.GreaterThanQuantity(item.Line.IssuedQty, item.Line.RequestedQty))
            {
                throw new InvalidOperationException("Số lượng xuất không được lớn hơn số lượng yêu cầu.");
            }

            var remaining = CalculateRemaining(demand.TotalRequiredQty, alreadyIssuedByItem.GetValueOrDefault(item.Key));
            if (DecimalPolicy.GreaterThanQuantity(item.Line.RequestedQty, remaining))
            {
                throw new InvalidOperationException(
                    $"Dòng xuất kho '{demand.IngredientName}' vượt nhu cầu còn lại. Yêu cầu: {item.Line.RequestedQty}, còn lại: {remaining}.");
            }

            result.Add(item.Line);
        }

        return result;
    }

    private static decimal CalculateRemaining(decimal requiredQty, decimal issuedQty)
        => DecimalPolicy.RoundQuantity(requiredQty - issuedQty);

    private static string BuildKey(byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToHexString(ingredientId)}:{Convert.ToHexString(unitId)}";

    private sealed record DemandLineSummary(
        byte[] IngredientId,
        byte[] UnitId,
        string? IngredientName,
        string? UnitName,
        decimal TotalRequiredQty);

    private sealed record ResolvedIssueLine(
        byte[] IngredientId,
        byte[] UnitId,
        decimal RequestedQty,
        decimal IssuedQty);

}
