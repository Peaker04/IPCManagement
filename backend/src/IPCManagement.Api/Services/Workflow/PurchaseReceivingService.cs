using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Workflow;

public sealed class PurchaseReceivingService : IPurchaseReceivingService
{
    private const string StatusOrdered = "ORDERED";
    private const string StatusPartiallyReceived = "PARTIALLY_RECEIVED";
    private const string StatusReceived = "RECEIVED";
    private const string StatusCancelled = "CANCELLED";
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> InMemoryOrderLocks = new(StringComparer.Ordinal);

    private readonly IpcManagementContext _context;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly Func<string, CancellationToken, Task>? _faultInjector;

    public PurchaseReceivingService(
        IpcManagementContext context,
        IStockLedgerService stockLedgerService,
        Func<string, CancellationToken, Task>? faultInjector = null)
    {
        _context = context;
        _stockLedgerService = stockLedgerService;
        _faultInjector = faultInjector;
    }

    public async Task<WarehousePurchaseReceiptResultDto> RecordAsync(
        RecordWarehousePurchaseReceiptDto request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        ValidateDataAnnotations(request);
        foreach (var line in request.Lines)
        {
            ValidateDataAnnotations(line);
        }

        var purchaseOrderId = GuidHelper.ParseGuidString(request.PurchaseOrderId)
            ?? throw new ArgumentException("Đơn mua hàng không hợp lệ.");
        var warehouseId = GuidHelper.ParseGuidString(request.WarehouseId)
            ?? throw new ArgumentException("Kho nhập hàng không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(userId)
            ?? throw new ArgumentException("Không xác định được người ghi nhận nhập kho.");
        var normalizedKey = request.IdempotencyKey.Trim();
        var receiptId = BuildReceiptId(purchaseOrderId, normalizedKey);
        var lockKey = Convert.ToHexString(purchaseOrderId);

        SemaphoreSlim? inMemoryLock = null;
        if (IsInMemoryProvider())
        {
            inMemoryLock = InMemoryOrderLocks.GetOrAdd(lockKey, static _ => new SemaphoreSlim(1, 1));
            await inMemoryLock.WaitAsync(cancellationToken);
        }

        try
        {
            return await RecordCoreAsync(
                request,
                normalizedKey,
                purchaseOrderId,
                warehouseId,
                actorId,
                receiptId,
                cancellationToken);
        }
        finally
        {
            inMemoryLock?.Release();
        }
    }

    private async Task<WarehousePurchaseReceiptResultDto> RecordCoreAsync(
        RecordWarehousePurchaseReceiptDto request,
        string normalizedKey,
        byte[] purchaseOrderId,
        byte[] warehouseId,
        byte[] actorId,
        byte[] receiptId,
        CancellationToken cancellationToken)
    {
        await using var transaction = _context.Database.IsRelational()
            ? await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken)
            : null;
        var mutationStarted = false;

        try
        {
            var order = await LoadOrderAsync(purchaseOrderId, cancellationToken)
                ?? throw new KeyNotFoundException("Không tìm thấy đơn mua hàng.");
            var requirements = BuildEvidenceRequirements(order);
            var existingReceipt = await LoadReceiptAsync(receiptId, cancellationToken);
            if (existingReceipt is not null)
            {
                ValidateIdempotentReplay(existingReceipt, order, request, warehouseId);
                if (transaction is not null)
                {
                    await transaction.CommitAsync(cancellationToken);
                }

                return BuildResult(existingReceipt, order, normalizedKey, requirements);
            }

            if (order.Status is StatusCancelled or StatusReceived)
            {
                throw new InvalidOperationException("Đơn mua hàng đã đóng hoặc bị hủy, không thể nhập thêm.");
            }

            if (order.Status is not StatusOrdered and not StatusPartiallyReceived)
            {
                throw new InvalidOperationException("Trạng thái đơn mua hàng không cho phép nhập kho.");
            }

            var validatedLines = await ValidateActualReceiptAsync(order, requirements, request, cancellationToken);
            var now = DateTime.UtcNow;
            var receipt = new Inventoryreceipt
            {
                ReceiptId = receiptId,
                ReceiptCode = $"RCP-PO-{Convert.ToHexString(receiptId)}",
                ReceiptDate = request.ReceiptDate,
                SupplierId = order.SupplierId,
                WarehouseId = warehouseId,
                PurchaseRequestId = order.PurchaseRequestId,
                CreatedBy = actorId,
                CreatedAt = now
            };

            foreach (var validated in validatedLines)
            {
                var input = validated.Input;
                var orderLine = validated.OrderLine;
                receipt.Inventoryreceiptlines.Add(new Inventoryreceiptline
                {
                    ReceiptLineId = BuildReceiptLineId(receiptId, orderLine.PurchaseOrderLineId),
                    ReceiptId = receiptId,
                    PurchaseRequestLineId = orderLine.PurchaseRequestLineId,
                    IngredientId = orderLine.IngredientId,
                    UnitId = orderLine.UnitId,
                    Quantity = DecimalPolicy.RoundQuantity(input.ActualQuantity),
                    UnitPrice = DecimalPolicy.RoundMoney(input.ActualUnitPrice),
                    Amount = DecimalPolicy.RoundMoney(input.ActualQuantity * input.ActualUnitPrice),
                    PackageQuantitySnapshot = input.PackageQuantity is null
                        ? null
                        : DecimalPolicy.RoundQuantity(input.PackageQuantity.Value),
                    PackageBaseUnitIdSnapshot = GuidHelper.ParseGuidString(input.PackageBaseUnitId),
                    PackagePolicyVersionSnapshot = NormalizeOptional(input.PackagePolicyVersion),
                    LotNumber = NormalizeOptional(input.LotNumber),
                    ManufactureDate = input.ManufactureDate,
                    ExpiredDate = input.ExpiryDate
                });
            }

            _context.Inventoryreceipts.Add(receipt);
            mutationStarted = true;
            await InjectFaultAsync("AfterReceipt", cancellationToken);

            foreach (var line in receipt.Inventoryreceiptlines)
            {
                await _stockLedgerService.AddStockAsync(
                    warehouseId,
                    line.IngredientId,
                    line.UnitId,
                    line.Quantity,
                    "RECEIPT",
                    "purchaseorders",
                    order.PurchaseOrderId,
                    actorId,
                    "Nhập kho từ đơn mua hàng",
                    $"Phiếu nhập {receipt.ReceiptCode} từ {order.PurchaseOrderCode}",
                    line.LotNumber,
                    line.ManufactureDate,
                    line.ExpiredDate);
            }

            await InjectFaultAsync("AfterStock", cancellationToken);

            var oldStatus = order.Status;
            foreach (var validated in validatedLines)
            {
                validated.OrderLine.ReceivedQty = DecimalPolicy.RoundQuantity(
                    validated.OrderLine.ReceivedQty + validated.Input.ActualQuantity);
            }

            order.Status = ComputeOrderStatus(order.Purchaseorderlines);
            order.UpdatedAt = now;
            await InjectFaultAsync("AfterOrderProgress", cancellationToken);

            _context.Auditlogs.Add(new Auditlog
            {
                AuditId = BuildAuditId(receiptId),
                ChangedAt = now,
                ChangedBy = actorId,
                BusinessArea = "Receipt",
                EntityName = nameof(Purchaseorder),
                EntityId = order.PurchaseOrderId,
                FieldName = nameof(Purchaseorder.Status),
                OldValue = oldStatus,
                NewValue = order.Status,
                Reason = $"Kho ghi nhận phiếu {receipt.ReceiptCode} cho {order.PurchaseOrderCode}."
            });
            await InjectFaultAsync("AfterAudit", cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return BuildResult(receipt, order, normalizedKey, requirements);
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            if (mutationStarted || transaction is not null)
            {
                _context.ChangeTracker.Clear();
            }

            throw;
        }
    }

    private async Task<IReadOnlyList<ValidatedReceiptLine>> ValidateActualReceiptAsync(
        Purchaseorder order,
        IReadOnlyList<PurchaseReceiptEvidenceRequirementsDto> requirements,
        RecordWarehousePurchaseReceiptDto request,
        CancellationToken cancellationToken)
    {
        if (request.Lines.Count == 0)
        {
            throw new ArgumentException("Vui lòng nhập ít nhất một dòng thực nhận.");
        }

        var duplicatedLine = request.Lines
            .GroupBy(line => line.PurchaseOrderLineId.Trim(), StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicatedLine is not null)
        {
            throw new ArgumentException("Mỗi dòng đơn mua hàng chỉ được ghi nhận một lần trong phiếu nhập.");
        }

        var orderLines = order.Purchaseorderlines.ToDictionary(
            line => GuidHelper.ToGuidString(line.PurchaseOrderLineId),
            StringComparer.OrdinalIgnoreCase);
        var requirementsByLine = requirements.ToDictionary(
            item => item.PurchaseOrderLineId,
            StringComparer.OrdinalIgnoreCase);
        var validated = new List<ValidatedReceiptLine>(request.Lines.Count);
        foreach (var input in request.Lines)
        {
            if (!orderLines.TryGetValue(input.PurchaseOrderLineId.Trim(), out var orderLine))
            {
                throw new KeyNotFoundException("Không tìm thấy dòng đơn mua hàng.");
            }

            var actualUnitId = GuidHelper.ParseGuidString(input.ActualUnitId)
                ?? throw new ArgumentException("Đơn vị thực nhận không hợp lệ.");
            if (!orderLine.UnitId.AsSpan().SequenceEqual(actualUnitId))
            {
                throw new InvalidOperationException("Đơn vị thực nhận không khớp đơn vị đã đặt.");
            }

            var newTotal = DecimalPolicy.RoundQuantity(orderLine.ReceivedQty + input.ActualQuantity);
            if (DecimalPolicy.GreaterThanQuantity(newTotal, orderLine.OrderedQty))
            {
                throw new InvalidOperationException(
                    $"Số lượng thực nhận cho '{orderLine.Ingredient.IngredientName}' vượt số lượng còn lại.");
            }

            var requirement = requirementsByLine[GuidHelper.ToGuidString(orderLine.PurchaseOrderLineId)];
            if (!string.IsNullOrWhiteSpace(requirement.BlockerReason))
            {
                throw new InvalidOperationException(requirement.BlockerReason);
            }

            ValidateRequiredEvidence(requirement, input);
            if (input.PackageBaseUnitId is not null)
            {
                var packageBaseUnitId = GuidHelper.ParseGuidString(input.PackageBaseUnitId)
                    ?? throw new ArgumentException("Đơn vị cơ sở của quy cách không hợp lệ.");
                var packageUnitExists = await UnitExistsAsync(packageBaseUnitId, cancellationToken);
                if (!packageUnitExists)
                {
                    throw new InvalidOperationException("Không tìm thấy đơn vị cơ sở của quy cách đóng gói.");
                }
            }

            validated.Add(new ValidatedReceiptLine(orderLine, input));
        }

        return validated;
    }

    private static IReadOnlyList<PurchaseReceiptEvidenceRequirementsDto> BuildEvidenceRequirements(Purchaseorder order)
        => order.Purchaseorderlines
            .OrderBy(line => line.Ingredient.IngredientName, StringComparer.Ordinal)
            .Select(line => new PurchaseReceiptEvidenceRequirementsDto
            {
                PurchaseOrderLineId = GuidHelper.ToGuidString(line.PurchaseOrderLineId),
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                IngredientName = line.Ingredient.IngredientName,
                LotNumberRequired = true,
                ManufactureDateRequired = line.Ingredient.IsFreshDaily,
                ExpiryDateRequired = line.Ingredient.IsFreshDaily,
                BlockerReason = line.Ingredient.IsActive == true
                    ? null
                    : $"Thiếu chính sách bằng chứng nhập kho hiện hành cho '{line.Ingredient.IngredientName}'."
            })
            .ToList();

    private static void ValidateRequiredEvidence(
        PurchaseReceiptEvidenceRequirementsDto requirement,
        WarehousePurchaseReceiptLineDto input)
    {
        if (requirement.LotNumberRequired && string.IsNullOrWhiteSpace(input.LotNumber))
        {
            throw new ArgumentException($"Số lô là bằng chứng bắt buộc cho '{requirement.IngredientName}'.");
        }

        if (requirement.ManufactureDateRequired && !input.ManufactureDate.HasValue)
        {
            throw new ArgumentException($"Ngày sản xuất là bằng chứng bắt buộc cho '{requirement.IngredientName}'.");
        }

        if (requirement.ExpiryDateRequired && !input.ExpiryDate.HasValue)
        {
            throw new ArgumentException($"Hạn sử dụng là bằng chứng bắt buộc cho '{requirement.IngredientName}'.");
        }
    }

    private static void ValidateIdempotentReplay(
        Inventoryreceipt existingReceipt,
        Purchaseorder order,
        RecordWarehousePurchaseReceiptDto request,
        byte[] warehouseId)
    {
        var existingByPurchaseLine = existingReceipt.Inventoryreceiptlines.ToDictionary(
            line => Convert.ToHexString(line.PurchaseRequestLineId ?? []),
            StringComparer.Ordinal);
        var orderLinesById = order.Purchaseorderlines.ToDictionary(
            line => GuidHelper.ToGuidString(line.PurchaseOrderLineId),
            StringComparer.OrdinalIgnoreCase);
        var matches = existingReceipt.WarehouseId.AsSpan().SequenceEqual(warehouseId) &&
            existingReceipt.SupplierId.AsSpan().SequenceEqual(order.SupplierId) &&
            existingReceipt.PurchaseRequestId is not null &&
            existingReceipt.PurchaseRequestId.AsSpan().SequenceEqual(order.PurchaseRequestId) &&
            existingReceipt.ReceiptDate == request.ReceiptDate &&
            existingReceipt.Inventoryreceiptlines.Count == request.Lines.Count &&
            request.Lines.All(input =>
            {
                if (!orderLinesById.TryGetValue(input.PurchaseOrderLineId.Trim(), out var orderLine) ||
                    !existingByPurchaseLine.TryGetValue(Convert.ToHexString(orderLine.PurchaseRequestLineId), out var stored))
                {
                    return false;
                }

                return stored.UnitId.AsSpan().SequenceEqual(GuidHelper.ParseGuidString(input.ActualUnitId)) &&
                    stored.Quantity == DecimalPolicy.RoundQuantity(input.ActualQuantity) &&
                    stored.UnitPrice == DecimalPolicy.RoundMoney(input.ActualUnitPrice) &&
                    string.Equals(stored.LotNumber, NormalizeOptional(input.LotNumber), StringComparison.Ordinal) &&
                    stored.ManufactureDate == input.ManufactureDate &&
                    stored.ExpiredDate == input.ExpiryDate &&
                    stored.PackageQuantitySnapshot == input.PackageQuantity &&
                    ByteArraysEqual(stored.PackageBaseUnitIdSnapshot, GuidHelper.ParseGuidString(input.PackageBaseUnitId)) &&
                    string.Equals(stored.PackagePolicyVersionSnapshot, NormalizeOptional(input.PackagePolicyVersion), StringComparison.Ordinal);
            });

        if (!matches)
        {
            throw new InvalidOperationException("Idempotency key đã được dùng với nội dung phiếu nhập khác.");
        }
    }

    private async Task<Purchaseorder?> LoadOrderAsync(byte[] purchaseOrderId, CancellationToken cancellationToken)
    {
        if (!IsInMemoryProvider())
        {
            return await _context.Purchaseorders
                .Include(order => order.Supplier)
                .Include(order => order.PurchaseRequest)
                .Include(order => order.Purchaseorderlines)
                    .ThenInclude(line => line.Ingredient)
                .Include(order => order.Purchaseorderlines)
                    .ThenInclude(line => line.Unit)
                .SingleOrDefaultAsync(
                    order => order.PurchaseOrderId == purchaseOrderId,
                    cancellationToken);
        }

        var order = (await _context.Purchaseorders.ToListAsync(cancellationToken))
            .SingleOrDefault(item => item.PurchaseOrderId.AsSpan().SequenceEqual(purchaseOrderId));
        if (order is null)
        {
            return null;
        }

        order.Supplier = (await _context.Suppliers.ToListAsync(cancellationToken))
            .Single(item => item.SupplierId.AsSpan().SequenceEqual(order.SupplierId));
        order.PurchaseRequest = (await _context.Purchaserequests.ToListAsync(cancellationToken))
            .Single(item => item.PurchaseRequestId.AsSpan().SequenceEqual(order.PurchaseRequestId));
        order.Purchaseorderlines = (await _context.Purchaseorderlines.ToListAsync(cancellationToken))
            .Where(line => line.PurchaseOrderId.AsSpan().SequenceEqual(order.PurchaseOrderId))
            .ToList();
        var ingredients = await _context.Ingredients.ToListAsync(cancellationToken);
        var units = await _context.Units.ToListAsync(cancellationToken);
        foreach (var line in order.Purchaseorderlines)
        {
            line.Ingredient = ingredients.Single(item =>
                item.IngredientId.AsSpan().SequenceEqual(line.IngredientId));
            line.Unit = units.Single(item => item.UnitId.AsSpan().SequenceEqual(line.UnitId));
        }

        return order;
    }

    private async Task<Inventoryreceipt?> LoadReceiptAsync(byte[] receiptId, CancellationToken cancellationToken)
    {
        var query = _context.Inventoryreceipts
            .Include(receipt => receipt.Inventoryreceiptlines)
            .AsQueryable();
        if (!IsInMemoryProvider())
        {
            return await query.SingleOrDefaultAsync(receipt => receipt.ReceiptId == receiptId, cancellationToken);
        }

        var receipts = await query.ToListAsync(cancellationToken);
        return receipts.SingleOrDefault(receipt => receipt.ReceiptId.AsSpan().SequenceEqual(receiptId));
    }

    private async Task<bool> UnitExistsAsync(byte[] unitId, CancellationToken cancellationToken)
    {
        if (!IsInMemoryProvider())
        {
            return await _context.Units.AnyAsync(unit => unit.UnitId == unitId, cancellationToken);
        }

        return (await _context.Units.AsNoTracking().ToListAsync(cancellationToken))
            .Any(unit => unit.UnitId.AsSpan().SequenceEqual(unitId));
    }

    private Task InjectFaultAsync(string point, CancellationToken cancellationToken)
        => _faultInjector?.Invoke(point, cancellationToken) ?? Task.CompletedTask;

    private bool IsInMemoryProvider()
        => string.Equals(
            _context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);

    private static void ValidateDataAnnotations(object value)
    {
        var validationResults = new List<ValidationResult>();
        if (!Validator.TryValidateObject(value, new ValidationContext(value), validationResults, validateAllProperties: true))
        {
            throw new ArgumentException(string.Join(" ", validationResults.Select(result => result.ErrorMessage)));
        }
    }

    private static string ComputeOrderStatus(IEnumerable<Purchaseorderline> lines)
    {
        var lineList = lines.ToList();
        if (lineList.All(line => !DecimalPolicy.LessThanQuantity(line.ReceivedQty, line.OrderedQty)))
        {
            return StatusReceived;
        }

        return lineList.Any(line => line.ReceivedQty > 0m) ? StatusPartiallyReceived : StatusOrdered;
    }

    private static WarehousePurchaseReceiptResultDto BuildResult(
        Inventoryreceipt receipt,
        Purchaseorder order,
        string idempotencyKey,
        IReadOnlyList<PurchaseReceiptEvidenceRequirementsDto> requirements)
        => new()
        {
            ReceiptId = GuidHelper.ToGuidString(receipt.ReceiptId),
            PurchaseOrderId = GuidHelper.ToGuidString(order.PurchaseOrderId),
            IdempotencyKey = idempotencyKey,
            PurchaseOrderStatus = order.Status,
            EvidenceRequirements = requirements
        };

    private static byte[] BuildReceiptId(byte[] purchaseOrderId, string idempotencyKey)
        => HashId($"receipt|{GuidHelper.ToGuidString(purchaseOrderId)}|{idempotencyKey}");

    private static byte[] BuildReceiptLineId(byte[] receiptId, byte[] purchaseOrderLineId)
        => HashId($"receipt-line|{Convert.ToHexString(receiptId)}|{GuidHelper.ToGuidString(purchaseOrderLineId)}");

    private static byte[] BuildAuditId(byte[] receiptId)
        => HashId($"receipt-audit|{Convert.ToHexString(receiptId)}");

    private static byte[] HashId(string value)
        => SHA256.HashData(Encoding.UTF8.GetBytes(value)).AsSpan(0, 16).ToArray();

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool ByteArraysEqual(byte[]? left, byte[]? right)
        => left is null ? right is null : right is not null && left.AsSpan().SequenceEqual(right);

    private sealed record ValidatedReceiptLine(
        Purchaseorderline OrderLine,
        WarehousePurchaseReceiptLineDto Input);
}
