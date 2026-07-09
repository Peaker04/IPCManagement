using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class InventoryReturnService : IInventoryReturnService
{
    private const string ReturnTypeReturn = "RETURN";
    private const string ReturnTypeWaste = "WASTE";

    private readonly IInventoryReturnRepository _returnRepository;
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IpcManagementContext? _context;

    public InventoryReturnService(
        IInventoryReturnRepository returnRepository,
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IpcManagementContext? context = null)
    {
        _returnRepository = returnRepository;
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _context = context;
    }

    public async Task<PagedResponseDto<InventoryReturnDto>> GetPagedAsync(InventoryReturnFilterRequestDto request)
    {
        var (items, totalCount) = await _returnRepository.GetPagedAsync(
            request.PageNumber,
            request.PageSize);

        return PagedResponseDto<InventoryReturnDto>.Create(
            items.Select(inventoryReturn => InventoryMapper.MapReturn(inventoryReturn)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<InventoryReturnDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var inventoryReturn = await _returnRepository.GetByIdWithLinesAsync(bytes);
        return inventoryReturn is null
            ? null
            : InventoryMapper.MapReturn(inventoryReturn, includeLines: true);
    }

    public async Task<InventoryReturnCreatedDto?> CreateAsync(CreateInventoryReturnDto dto, string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var warehouseBytes = GuidHelper.ParseGuidString(dto.WarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        var issueBytes = GuidHelper.ParseGuidString(dto.IssueId)
            ?? throw new ArgumentException("IssueId không hợp lệ.");

        var issue = await _issueRepository.GetByIdWithLinesAsync(issueBytes)
            ?? throw new KeyNotFoundException($"Không tìm thấy phiếu xuất kho với ID: {dto.IssueId}");

        if (!issue.WarehouseId.SequenceEqual(warehouseBytes))
        {
            throw new InvalidOperationException("Phiếu trả phải thuộc cùng kho với phiếu xuất gốc.");
        }

        var returnType = NormalizeReturnType(dto.ReturnType);
        if (string.IsNullOrWhiteSpace(dto.Reason))
        {
            throw new ArgumentException("Cần ghi lý do trả kho hoặc hao hụt thực tế.");
        }

        var accountedQuantities = await _returnRepository.GetReturnedQuantitiesByIssueAsync(issueBytes);
        var issueQuantities = issue.Inventoryissuelines
            .GroupBy(line => InventoryReturnRepository.BuildLineKey(line.IngredientId, line.UnitId))
            .ToDictionary(group => group.Key, group => group.Sum(line => line.IssuedQty));

        using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var inventoryReturn = new Inventoryreturn
            {
                ReturnId = GuidHelper.NewId(),
                ReturnCode = $"{ResolveReturnCodePrefix(returnType)}-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
                ReturnDate = dto.ReturnDate,
                ShiftName = dto.ShiftName,
                ReturnType = returnType,
                WarehouseId = warehouseBytes,
                IssueId = issueBytes,
                Reason = dto.Reason.Trim(),
                CreatedBy = userIdBytes,
                CreatedAt = DateTime.UtcNow
            };

            inventoryReturn.Inventoryreturnlines = dto.Lines.Select(line =>
            {
                var ingredientBytes = GuidHelper.ParseGuidString(line.IngredientId)
                    ?? throw new ArgumentException($"IngredientId '{line.IngredientId}' không hợp lệ.");
                var unitBytes = GuidHelper.ParseGuidString(line.UnitId)
                    ?? throw new ArgumentException($"UnitId '{line.UnitId}' không hợp lệ.");

                var quantity = DecimalPolicy.RoundQuantity(line.Quantity);
                ValidateReturnQuantity(
                    issueQuantities,
                    accountedQuantities,
                    ingredientBytes,
                    unitBytes,
                    quantity);

                return new Inventoryreturnline
                {
                    ReturnLineId = GuidHelper.NewId(),
                    ReturnId = inventoryReturn.ReturnId,
                    IngredientId = ingredientBytes,
                    UnitId = unitBytes,
                    Quantity = quantity
                };
            }).ToList();

            _returnRepository.Add(inventoryReturn);

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return new InventoryReturnCreatedDto
            {
                ReturnId = GuidHelper.ToGuidString(inventoryReturn.ReturnId),
                ReturnCode = inventoryReturn.ReturnCode
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private void AddWasteAudit(Inventoryreturn inventoryReturn, Inventoryissue issue, byte[] userIdBytes)
    {
        if (_context is null) return;
        
        foreach (var line in inventoryReturn.Inventoryreturnlines)
        {
            _context.Auditlogs.Add(new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = DateTime.UtcNow,
                ChangedBy = userIdBytes,
                BusinessArea = "ProductionWaste",
                EntityName = nameof(Inventoryreturnline),
                EntityId = line.ReturnLineId,
                FieldName = "WasteQuantity",
                OldValue = "0",
                NewValue = line.Quantity.ToString("0.######"),
                Reason = $"Khai báo hao hụt {line.Quantity} từ phiếu xuất {issue.IssueCode}. Lý do: {inventoryReturn.Reason}"
            });
        }
    }

    public async Task<bool> ConfirmReceiptAsync(string id, ConfirmInventoryReturnReceiptDto dto, string? userId)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (bytes is null || userIdBytes is null || _context is null) return false;

        var inventoryReturn = await _context.Inventoryreturns
            .Include(r => r.Inventoryreturnlines)
            .FirstOrDefaultAsync(r => r.ReturnId == bytes);

        if (inventoryReturn is null) return false;

        if (inventoryReturn.ReceivedAt.HasValue)
        {
            throw new InvalidOperationException("Phiếu trả nguyên liệu này đã được xác nhận.");
        }

        var confirmedAt = DateTime.UtcNow;
        inventoryReturn.ReceivedBy = userIdBytes;
        inventoryReturn.ReceivedAt = confirmedAt;

        var auditLogReason = $"Thủ kho xác nhận phiếu trả {inventoryReturn.ReturnCode}.";
        
        if (dto.AdjustedLines != null && dto.AdjustedLines.Any())
        {
            foreach (var adjustedLine in dto.AdjustedLines)
            {
                var lineBytes = GuidHelper.ParseGuidString(adjustedLine.ReturnLineId);
                var line = inventoryReturn.Inventoryreturnlines.FirstOrDefault(l => lineBytes != null && l.ReturnLineId.SequenceEqual(lineBytes));
                if (line != null && line.Quantity != adjustedLine.NewQuantity)
                {
                    _context.Auditlogs.Add(new Auditlog
                    {
                        AuditId = GuidHelper.NewId(),
                        ChangedAt = confirmedAt,
                        ChangedBy = userIdBytes,
                        BusinessArea = "StorekeeperReturnReceipt",
                        EntityName = nameof(Inventoryreturnline),
                        EntityId = line.ReturnLineId,
                        FieldName = "Quantity",
                        OldValue = line.Quantity.ToString("0.######"),
                        NewValue = adjustedLine.NewQuantity.ToString("0.######"),
                        Reason = $"Thủ kho điều chỉnh số lượng thực nhận từ {line.Quantity} thành {adjustedLine.NewQuantity} cho phiếu trả {inventoryReturn.ReturnCode}."
                    });
                    line.Quantity = adjustedLine.NewQuantity;
                }
            }
        }

        if (dto.HasDiscrepancy)
        {
            var note = dto.DiscrepancyNote?.Trim() ?? "";
            _context.Auditlogs.Add(new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = confirmedAt,
                ChangedBy = userIdBytes,
                BusinessArea = "StorekeeperReturnReceipt",
                EntityName = nameof(Inventoryreturn),
                EntityId = inventoryReturn.ReturnId,
                FieldName = "StorekeeperReceiptDiscrepancy",
                OldValue = "expected=kitchen_qty",
                NewValue = note,
                Reason = $"Thủ kho báo chênh lệch khi nhận phiếu trả {inventoryReturn.ReturnCode}: {note}"
            });
        }

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = confirmedAt,
            ChangedBy = userIdBytes,
            BusinessArea = "StorekeeperReturnReceipt",
            EntityName = nameof(Inventoryreturn),
            EntityId = inventoryReturn.ReturnId,
            FieldName = "StorekeeperReceived",
            OldValue = null,
            NewValue = $"receivedAt={confirmedAt:O}",
            Reason = auditLogReason
        });

        if (inventoryReturn.ReturnType == ReturnTypeReturn)
        {
            foreach (var line in inventoryReturn.Inventoryreturnlines)
            {
                await _stockLedgerService.AddStockAsync(
                    inventoryReturn.WarehouseId,
                    line.IngredientId,
                    line.UnitId,
                    line.Quantity,
                    "RETURN",
                    "inventoryreturns",
                    inventoryReturn.ReturnId,
                    userIdBytes,
                    "Trả nguyên liệu dư sau sản xuất",
                    $"Phiếu trả {inventoryReturn.ReturnCode}");
            }
        }
        else
        {
            var issue = await _issueRepository.GetByIdWithLinesAsync(inventoryReturn.IssueId);
            if (issue != null)
            {
                AddWasteAudit(inventoryReturn, issue, userIdBytes);
            }
        }

        await _context.SaveChangesAsync();
        return true;
    }

    private static void ValidateReturnQuantity(
        IReadOnlyDictionary<string, decimal> issueQuantities,
        IReadOnlyDictionary<string, decimal> accountedQuantities,
        byte[] ingredientId,
        byte[] unitId,
        decimal accountedQuantity)
    {
        var key = InventoryReturnRepository.BuildLineKey(ingredientId, unitId);

        if (!issueQuantities.TryGetValue(key, out var issuedQuantity))
        {
            throw new InvalidOperationException(
                "Nguyên liệu trả phải tồn tại trong phiếu xuất gốc và cùng đơn vị tính.");
        }

        var alreadyAccounted = accountedQuantities.GetValueOrDefault(key);
        if (DecimalPolicy.GreaterThanQuantity(alreadyAccounted + accountedQuantity, issuedQuantity))
        {
            throw new InvalidOperationException(
                $"Số lượng trả/hao hụt vượt quá số lượng đã xuất. Đã xuất: {issuedQuantity}, đã ghi nhận: {alreadyAccounted}, ghi thêm: {accountedQuantity}.");
        }
    }

    private static string NormalizeReturnType(string? returnType)
    {
        var normalized = string.IsNullOrWhiteSpace(returnType)
            ? ReturnTypeReturn
            : returnType.Trim().ToUpperInvariant();

        return normalized is ReturnTypeReturn or ReturnTypeWaste
            ? normalized
            : throw new ArgumentException("Loại ghi nhận phải là RETURN hoặc WASTE.");
    }

    private static string ResolveReturnCodePrefix(string returnType)
        => returnType == ReturnTypeWaste ? "WST" : "RET";
}
