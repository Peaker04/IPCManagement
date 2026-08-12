using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public class InventoryReturnService : IInventoryReturnService
{
    private const string ReturnTypeReturn = "RETURN";
    private const string ReturnTypeWaste = "WASTE";

    private readonly IInventoryReturnRepository _returnRepository;
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly IpcManagementContext? _context;

    public InventoryReturnService(
        IInventoryReturnRepository returnRepository,
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IpcManagementContext? context = null)
    {
        _returnRepository = returnRepository;
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _transactionRunner = transactionRunner;
        _context = context;
    }

    public async Task<PagedResponseDto<InventoryReturnDto>> GetPagedAsync(InventoryReturnFilterRequestDto request)
    {
        var (items, totalCount) = await _returnRepository.GetPagedAsync(request);

        return PagedResponseDto<InventoryReturnDto>.Create(
            items.Select(inventoryReturn => InventoryMapper.MapReturn(inventoryReturn, includeLines: true)),
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

    public async Task<InventoryReturnCreatedDto?> CreateAsync(CreateInventoryReturnRequest dto, string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var warehouseBytes = GuidHelper.ParseGuidString(dto.WarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        var issueBytes = GuidHelper.ParseGuidString(dto.IssueId)
            ?? throw new ArgumentException("IssueId không hợp lệ.");

        var returnType = NormalizeReturnType(dto.ReturnType);
        if (string.IsNullOrWhiteSpace(dto.Reason))
        {
            throw new ArgumentException("Cần ghi lý do trả kho hoặc hao hụt thực tế.");
        }

        var returnId = GuidHelper.NewId();
        var returnCode = $"{ResolveReturnCodePrefix(returnType)}-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
        return await _transactionRunner.ExecuteAsync(
            async _ =>
            {
                var issue = await _issueRepository.GetByIdWithLinesAsync(issueBytes)
                    ?? throw new KeyNotFoundException($"Không tìm thấy phiếu xuất kho với ID: {dto.IssueId}");

                if (!issue.WarehouseId.SequenceEqual(warehouseBytes))
                {
                    throw new BusinessRuleException("Phiếu trả phải thuộc cùng kho với phiếu xuất gốc.");
                }

                if (issue.ReceivedAt is null)
                {
                    throw new BusinessRuleException(
                        "Bếp cần xác nhận đã nhận phiếu xuất gốc trước khi tạo phiếu trả hoặc khai báo hao hụt.");
                }

                var accountedQuantities = await _returnRepository.GetReturnedQuantitiesBySourceIssueLineAsync(issueBytes);
                var sourceLineIds = new HashSet<string>(StringComparer.Ordinal);

                var inventoryReturn = new InventoryReturn
                {
                    ReturnId = returnId,
                    ReturnCode = returnCode,
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
                    var sourceLine = ResolveSourceIssueLine(issue, line.SourceIssueLineId, ingredientBytes, unitBytes);
                    var sourceLineId = GuidHelper.ToGuidString(sourceLine.IssueLineId);
                    if (!sourceLineIds.Add(sourceLineId))
                    {
                        throw new BusinessRuleException("Mỗi dòng nguồn của phiếu xuất chỉ được trả/ghi hao hụt một lần trên cùng chứng từ.");
                    }

                    var quantity = DecimalPolicy.RoundQuantity(line.Quantity);
                    ValidateReturnQuantity(sourceLine, accountedQuantities.GetValueOrDefault(sourceLineId), quantity);

                    return new InventoryReturnLine
                    {
                        ReturnLineId = GuidHelper.NewId(),
                        ReturnId = inventoryReturn.ReturnId,
                        IngredientId = ingredientBytes,
                        UnitId = unitBytes,
                        SourceIssueLineId = sourceLine.IssueLineId,
                        Quantity = quantity
                    };
                }).ToList();

                _returnRepository.Add(inventoryReturn);

                await _unitOfWork.SaveChangesAsync();

                return new InventoryReturnCreatedDto
                {
                    ReturnId = GuidHelper.ToGuidString(inventoryReturn.ReturnId),
                    ReturnCode = inventoryReturn.ReturnCode
                };
            },
            async _ => await _returnRepository.GetByIdWithLinesAsync(returnId) is not null);
    }

    private void AddWasteAudit(InventoryReturn inventoryReturn, InventoryIssue issue, byte[] userIdBytes)
    {
        if (_context is null) return;

        foreach (var line in inventoryReturn.Inventoryreturnlines)
        {
            _context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = DateTime.UtcNow,
                ChangedBy = userIdBytes,
                BusinessArea = "ProductionWaste",
                EntityName = nameof(InventoryReturnLine),
                EntityId = line.ReturnLineId,
                FieldName = "WasteQuantity",
                OldValue = "0",
                NewValue = line.Quantity.ToString("0.######"),
                Reason = $"Khai báo hao hụt {line.Quantity} từ phiếu xuất {issue.IssueCode}. Lý do: {inventoryReturn.Reason}"
            });
        }
    }

    public async Task<bool> ConfirmReceiptAsync(string id, ConfirmInventoryReturnReceiptRequest dto, string? userId)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (bytes is null || userIdBytes is null || _context is null) return false;

        // Luồng này ghi vào 6 bảng (inventoryreturns, inventoryreturnlines, auditlogs, currentstock,
        // currentstocklots, stockmovements). Không có transaction thì một lỗi giữa chừng để lại
        // phiếu đã đánh dấu "đã nhận" nhưng tồn kho chưa cộng. Dùng đúng khuôn mẫu của CreateAsync
        // trong chính file này. Đọc phiếu cũng nằm trong transaction để chốt chặn xác nhận hai lần.
        return await _transactionRunner.ExecuteAsync(
            async cancellationToken =>
            {
                var inventoryReturn = await _context.Inventoryreturns
                    .Include(r => r.Inventoryreturnlines)
                    .FirstOrDefaultAsync(r => r.ReturnId == bytes, cancellationToken);

                if (inventoryReturn is null) return false;

                if (inventoryReturn.ReceivedAt.HasValue)
                {
                    throw new ResourceConflictException("Phiếu trả nguyên liệu này đã được xác nhận.");
                }

                var proposedAdjustments = new List<(InventoryReturnLine Line, decimal Quantity)>();
                if (dto.AdjustedLines != null && dto.AdjustedLines.Any())
                {
                    var adjustedLineIds = new HashSet<string>(StringComparer.Ordinal);
                    foreach (var adjustedLine in dto.AdjustedLines)
                    {
                        var lineBytes = GuidHelper.ParseFilterIdOrThrow(adjustedLine.ReturnLineId, "dòng phiếu trả");
                        var line = inventoryReturn.Inventoryreturnlines.FirstOrDefault(l => lineBytes != null && l.ReturnLineId.SequenceEqual(lineBytes));
                        if (line is null)
                        {
                            throw new BusinessRuleException("Dòng điều chỉnh không thuộc phiếu trả đang xác nhận.");
                        }

                        var lineKey = Convert.ToHexString(line.ReturnLineId);
                        if (!adjustedLineIds.Add(lineKey))
                        {
                            throw new BusinessRuleException("Mỗi dòng phiếu trả chỉ được điều chỉnh một lần trong một lệnh xác nhận.");
                        }

                        var adjustedQuantity = DecimalPolicy.RoundQuantity(adjustedLine.NewQuantity);
                        if (!DecimalPolicy.GreaterThanQuantity(adjustedQuantity, 0))
                        {
                            throw new BusinessRuleException("Số lượng thực nhận sau điều chỉnh phải lớn hơn 0.");
                        }

                        proposedAdjustments.Add((line, adjustedQuantity));
                    }
                }

                await EnsureReturnBalanceAfterAdjustmentAsync(
                    inventoryReturn,
                    proposedAdjustments.ToDictionary(item => Convert.ToHexString(item.Line.ReturnLineId), item => item.Quantity),
                    cancellationToken);

                var confirmedAt = DateTime.UtcNow;
                inventoryReturn.ReceivedBy = userIdBytes;
                inventoryReturn.ReceivedAt = confirmedAt;
                var auditLogReason = $"Thủ kho xác nhận phiếu trả {inventoryReturn.ReturnCode}.";

                foreach (var (line, adjustedQuantity) in proposedAdjustments.Where(item => item.Line.Quantity != item.Quantity))
                {
                    _context.Auditlogs.Add(new AuditLog
                    {
                        AuditId = GuidHelper.NewId(),
                        ChangedAt = confirmedAt,
                        ChangedBy = userIdBytes,
                        BusinessArea = "StorekeeperReturnReceipt",
                        EntityName = nameof(InventoryReturnLine),
                        EntityId = line.ReturnLineId,
                        FieldName = "Quantity",
                        OldValue = line.Quantity.ToString("0.######"),
                        NewValue = adjustedQuantity.ToString("0.######"),
                        Reason = $"Thủ kho điều chỉnh số lượng thực nhận từ {line.Quantity} thành {adjustedQuantity} cho phiếu trả {inventoryReturn.ReturnCode}."
                    });
                    line.Quantity = adjustedQuantity;
                }

                if (dto.HasDiscrepancy)
                {
                    var note = dto.DiscrepancyNote?.Trim() ?? "";
                    _context.Auditlogs.Add(new AuditLog
                    {
                        AuditId = GuidHelper.NewId(),
                        ChangedAt = confirmedAt,
                        ChangedBy = userIdBytes,
                        BusinessArea = "StorekeeperReturnReceipt",
                        EntityName = nameof(InventoryReturn),
                        EntityId = inventoryReturn.ReturnId,
                        FieldName = "StorekeeperReceiptDiscrepancy",
                        OldValue = "expected=kitchen_qty",
                        NewValue = note,
                        Reason = $"Thủ kho báo chênh lệch khi nhận phiếu trả {inventoryReturn.ReturnCode}: {note}"
                    });
                }

                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = confirmedAt,
                    ChangedBy = userIdBytes,
                    BusinessArea = "StorekeeperReturnReceipt",
                    EntityName = nameof(InventoryReturn),
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

                await _context.SaveChangesAsync(cancellationToken);
                return true;
            },
            cancellationToken => _context.Inventoryreturns
                .AsNoTracking()
                .AnyAsync(
                    inventoryReturn => inventoryReturn.ReturnId == bytes && inventoryReturn.ReceivedAt != null,
                    cancellationToken));
    }

    private static InventoryIssueLine ResolveSourceIssueLine(
        InventoryIssue issue,
        string? requestedSourceIssueLineId,
        byte[] ingredientId,
        byte[] unitId)
    {
        if (string.IsNullOrWhiteSpace(requestedSourceIssueLineId))
        {
            throw new BusinessRuleException("Mỗi dòng trả hoặc hao hụt phải chỉ rõ SourceIssueLineId để giữ lineage.");
        }

        var sourceLineId = GuidHelper.ParseGuidString(requestedSourceIssueLineId)
            ?? throw new ArgumentException("SourceIssueLineId không hợp lệ.");
        var sourceLine = issue.Inventoryissuelines.SingleOrDefault(line => line.IssueLineId.SequenceEqual(sourceLineId))
            ?? throw new BusinessRuleException("Dòng nguồn không thuộc phiếu xuất gốc.");
        if (!sourceLine.IngredientId.SequenceEqual(ingredientId) || !sourceLine.UnitId.SequenceEqual(unitId))
        {
            throw new BusinessRuleException("Nguyên liệu hoặc đơn vị của dòng trả không khớp dòng nguồn phiếu xuất.");
        }
        return sourceLine;
    }

    private static void ValidateReturnQuantity(
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

    private async Task EnsureReturnBalanceAfterAdjustmentAsync(
        InventoryReturn inventoryReturn,
        IReadOnlyDictionary<string, decimal> proposedAdjustments,
        CancellationToken cancellationToken)
    {
        var issue = await _issueRepository.GetByIdWithLinesAsync(inventoryReturn.IssueId)
            ?? throw new BusinessRuleException("Không tìm thấy phiếu xuất gốc để đối soát số lượng trả.");

        var issuedBySourceLine = issue.Inventoryissuelines
            .ToDictionary(line => GuidHelper.ToGuidString(line.IssueLineId), line => DecimalPolicy.RoundQuantity(line.IssuedQty));

        var returnLines = await _context!.Inventoryreturnlines
            .Include(line => line.Return)
            .Where(line => line.Return.IssueId == inventoryReturn.IssueId)
            .ToListAsync(cancellationToken);
        var accountedBySourceLine = returnLines
            .Where(line => line.SourceIssueLineId is not null)
            .GroupBy(line => GuidHelper.ToGuidString(line.SourceIssueLineId!))
            .ToDictionary(
                group => group.Key,
                group => DecimalPolicy.RoundQuantity(group.Sum(line => proposedAdjustments.GetValueOrDefault(
                    Convert.ToHexString(line.ReturnLineId),
                    line.Quantity))));

        foreach (var (key, accountedQuantity) in accountedBySourceLine)
        {
            if (!issuedBySourceLine.TryGetValue(key, out var issuedQuantity) ||
                DecimalPolicy.GreaterThanQuantity(accountedQuantity, issuedQuantity))
            {
                throw new BusinessRuleException(
                    "Số lượng trả/hao hụt sau điều chỉnh vượt quá số lượng đã xuất của dòng nguồn.");
            }
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
