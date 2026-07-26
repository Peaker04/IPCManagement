using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

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
    private readonly IpcManagementContext? _context;

    public InventoryIssueService(
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IpcManagementContext? context = null)
    {
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _context = context;
    }

    public async Task<PagedResponseDto<InventoryIssueDto>> GetPagedAsync(InventoryIssueFilterRequestDto request)
    {
        var (items, totalCount) = await _issueRepository.GetPagedAsync(request);

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
            await EnsureStockAvailableAsync(warehouseBytes, dto.IssueDate, materialRequest, issueLines, userIdBytes);

            var issue = new Inventoryissue
            {
                IssueId = GuidHelper.NewId(),
                IssueCode = $"ISS-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
                IssueDate = dto.IssueDate,
                ShiftName = dto.ShiftName,
                WarehouseId = warehouseBytes,
                MaterialRequestId = materialRequestBytes,
                IssuedBy = userIdBytes,
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

            UpdateMaterialRequestStatusIfCompleted(materialRequest, issuedLines, issueLines, userIdBytes);

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return new InventoryIssueCreatedDto
            {
                IssueId = GuidHelper.ToGuidString(issue.IssueId),
                IssueCode = issue.IssueCode
            };
        }
        catch (StockShortageException ex)
        {
            await transaction.RollbackAsync();
            await WriteStockShortageAuditAsync(ex.Shortage, materialRequestBytes, userIdBytes);
            throw;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<InventoryIssueDto?> ConfirmReceiptAsync(
        string id,
        ConfirmInventoryIssueReceiptDto dto,
        string? userId)
    {
        if (_context is null)
        {
            throw new InvalidOperationException("Chưa cấu hình dữ liệu để xác nhận bếp nhận nguyên liệu.");
        }

        var issueId = GuidHelper.ParseGuidString(id);
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (issueId is null || userIdBytes is null)
        {
            return null;
        }

        if (dto.HasDiscrepancy && string.IsNullOrWhiteSpace(dto.DiscrepancyNote))
        {
            throw new ArgumentException("Vui lòng ghi rõ chênh lệch khi bếp nhận nguyên liệu.");
        }

        var issue = await _context.Inventoryissues
            .Include(item => item.Warehouse)
            .Include(item => item.IssuedByNavigation)
            .Include(item => item.ReceivedByNavigation)
            .Include(item => item.Inventoryissuelines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Inventoryissuelines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(item => item.IssueId == issueId);
        if (issue is null)
        {
            return null;
        }

        if (issue.ReceivedAt is not null)
        {
            throw new InvalidOperationException("Phiếu xuất này đã được bếp xác nhận nhận nguyên liệu.");
        }

        var confirmedAt = DateTime.UtcNow;
        issue.ReceivedBy = userIdBytes;
        issue.ReceivedAt = confirmedAt;

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = confirmedAt,
            ChangedBy = userIdBytes,
            BusinessArea = "KitchenReceipt",
            EntityName = nameof(Inventoryissue),
            EntityId = issue.IssueId,
            FieldName = "KitchenReceived",
            OldValue = null,
            NewValue = $"receivedAt={confirmedAt:O}",
            Reason = $"Bếp xác nhận đã nhận nguyên liệu từ phiếu xuất {issue.IssueCode}."
        });

        if (dto.HasDiscrepancy)
        {
            var note = dto.DiscrepancyNote!.Trim();
            _context.Auditlogs.Add(new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = confirmedAt,
                ChangedBy = userIdBytes,
                BusinessArea = "KitchenReceipt",
                EntityName = nameof(Inventoryissue),
                EntityId = issue.IssueId,
                FieldName = "KitchenReceiptDiscrepancy",
                OldValue = "expected=issued_qty",
                NewValue = note,
                Reason = $"Bếp báo chênh lệch khi nhận phiếu xuất {issue.IssueCode}: {note}"
            });
        }

        await _context.SaveChangesAsync();
        return InventoryMapper.MapIssue(issue, includeLines: true);
    }

    private async Task EnsureStockAvailableAsync(
        byte[] warehouseId,
        DateOnly issueDate,
        Materialrequest materialRequest,
        IReadOnlyList<ResolvedIssueLine> issueLines,
        byte[] actorId)
    {
        if (_context is null)
        {
            return;
        }

        var stocks = await _context.Currentstocks
            .AsNoTracking()
            .Include(stock => stock.Warehouse)
            .Include(stock => stock.Ingredient)
            .Include(stock => stock.Unit)
            .Where(stock => stock.WarehouseId == warehouseId)
            .ToListAsync();
        var warehouse = await _context.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.WarehouseId == warehouseId);
        var demandInfo = materialRequest.Materialrequestlines
            .GroupBy(line => BuildKey(line.IngredientId, line.UnitId))
            .ToDictionary(
                group => group.Key,
                group => group.First());

        var shortageLines = new List<StockShortageLineDto>();
        foreach (var line in issueLines)
        {
            var stock = stocks.FirstOrDefault(item => item.IngredientId.SequenceEqual(line.IngredientId));
            var demandLine = demandInfo.GetValueOrDefault(BuildKey(line.IngredientId, line.UnitId));
            var availableQty = CalculateAvailableQuantity(stock, demandLine?.Unit);
            if (!DecimalPolicy.LessThanQuantity(availableQty, line.IssuedQty))
            {
                continue;
            }

            shortageLines.Add(new StockShortageLineDto
            {
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                IngredientName = demandLine?.Ingredient.IngredientName ?? stock?.Ingredient.IngredientName ?? GuidHelper.ToGuidString(line.IngredientId),
                UnitId = GuidHelper.ToGuidString(line.UnitId),
                UnitName = demandLine?.Unit.UnitName ?? stock?.Unit.UnitName ?? GuidHelper.ToGuidString(line.UnitId),
                RequiredQty = DecimalPolicy.RoundQuantity(line.IssuedQty),
                AvailableQty = availableQty,
                MissingQty = DecimalPolicy.RoundQuantity(line.IssuedQty - availableQty)
            });
        }

        if (shortageLines.Count == 0)
        {
            return;
        }

        var shortage = new StockShortageIssueDto
        {
            MaterialRequestId = GuidHelper.ToGuidString(materialRequest.RequestId),
            MaterialRequestCode = materialRequest.RequestCode,
            WarehouseId = GuidHelper.ToGuidString(warehouseId),
            WarehouseName = warehouse?.WarehouseName,
            IssueDate = issueDate,
            Lines = shortageLines
        };
        await WriteStockShortageAuditAsync(shortage, materialRequest.RequestId, actorId);
        throw new StockShortageException(shortage);
    }

    private async Task WriteStockShortageAuditAsync(StockShortageIssueDto shortage, byte[] materialRequestId, byte[] actorId)
    {
        if (_context is null)
        {
            return;
        }

        var changedAt = DateTime.UtcNow;
        foreach (var line in shortage.Lines)
        {
            _context.Auditlogs.Add(new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = actorId,
                BusinessArea = "StockException",
                EntityName = nameof(Materialrequest),
                EntityId = materialRequestId,
                FieldName = "StockShortage",
                OldValue = $"available={line.AvailableQty}",
                NewValue = $"ingredient={line.IngredientName}; required={line.RequiredQty}; available={line.AvailableQty}; missing={line.MissingQty}; unit={line.UnitName}; date={shortage.IssueDate:yyyy-MM-dd}",
                Reason = $"Thiếu tồn kho {line.IngredientName}: cần {line.RequiredQty} {line.UnitName}, hiện có {line.AvailableQty} {line.UnitName} tại {shortage.WarehouseName ?? shortage.WarehouseId}."
            });
        }

        await _context.SaveChangesAsync();
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

    private void UpdateMaterialRequestStatusIfCompleted(
        Materialrequest materialRequest,
        IReadOnlyList<Inventoryissueline> previouslyIssuedLines,
        IReadOnlyList<ResolvedIssueLine> currentIssueLines,
        byte[] userIdBytes)
    {
        if (_context is null) return;

        var demandByItem = materialRequest.Materialrequestlines
            .GroupBy(line => BuildKey(line.IngredientId, line.UnitId))
            .ToDictionary(
                group => group.Key,
                group => DecimalPolicy.RoundQuantity(group.Sum(line => line.TotalRequiredQty)));

        var alreadyIssuedByItem = previouslyIssuedLines
            .GroupBy(line => BuildKey(line.IngredientId, line.UnitId))
            .ToDictionary(
                group => group.Key,
                group => DecimalPolicy.RoundQuantity(group.Sum(line => line.IssuedQty)));

        foreach (var issueLine in currentIssueLines)
        {
            var key = BuildKey(issueLine.IngredientId, issueLine.UnitId);
            var currentIssued = alreadyIssuedByItem.GetValueOrDefault(key, 0m);
            alreadyIssuedByItem[key] = currentIssued + issueLine.IssuedQty;
        }

        var isFullyIssued = true;
        foreach (var (key, requiredQty) in demandByItem)
        {
            var totalIssued = alreadyIssuedByItem.GetValueOrDefault(key, 0m);
            if (DecimalPolicy.LessThanQuantity(totalIssued, requiredQty))
            {
                isFullyIssued = false;
                break;
            }
        }

        if (isFullyIssued)
        {
            var oldStatus = materialRequest.Status;
            var newStatus = "EXPORTED";
            if (!string.Equals(oldStatus, newStatus, StringComparison.OrdinalIgnoreCase))
            {
                materialRequest.Status = newStatus;
                _context.Auditlogs.Add(new Auditlog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = DateTime.UtcNow,
                    ChangedBy = userIdBytes,
                    BusinessArea = "InventoryIssue",
                    EntityName = nameof(Materialrequest),
                    EntityId = materialRequest.RequestId,
                    FieldName = nameof(Materialrequest.Status),
                    OldValue = oldStatus,
                    NewValue = newStatus,
                    Reason = "Đã xuất đủ nguyên liệu, tự động chuyển trạng thái Nhu cầu thành EXPORTED."
                });
            }
        }
    }

    private static decimal CalculateRemaining(decimal requiredQty, decimal issuedQty)
        => DecimalPolicy.RoundQuantity(requiredQty - issuedQty);

    private static string BuildKey(byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToHexString(ingredientId)}:{Convert.ToHexString(unitId)}";

    private static decimal CalculateAvailableQuantity(Currentstock? stock, Unit? targetUnit)
    {
        if (stock is null)
        {
            return 0m;
        }

        if (targetUnit is not null)
        {
            return TryConvertQuantity(stock.CurrentQty, stock.Unit, targetUnit, out var convertedQty)
                ? convertedQty
                : 0m;
        }

        return DecimalPolicy.RoundQuantity(stock.CurrentQty);
    }

    private static bool TryConvertQuantity(decimal quantity, Unit sourceUnit, Unit targetUnit, out decimal convertedQty)
    {
        if (sourceUnit.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            convertedQty = DecimalPolicy.RoundQuantity(quantity);
            return true;
        }

        if (!CanConvertUnits(sourceUnit, targetUnit))
        {
            convertedQty = 0m;
            return false;
        }

        convertedQty = DecimalPolicy.RoundQuantity(quantity * sourceUnit.ConvertRateToBase / targetUnit.ConvertRateToBase);
        return true;
    }

    private static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
        => sourceUnit.ConvertRateToBase > 0 &&
           targetUnit.ConvertRateToBase > 0 &&
           string.Equals(NormalizedBaseUnitCode(sourceUnit), NormalizedBaseUnitCode(targetUnit), StringComparison.OrdinalIgnoreCase);

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();

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
