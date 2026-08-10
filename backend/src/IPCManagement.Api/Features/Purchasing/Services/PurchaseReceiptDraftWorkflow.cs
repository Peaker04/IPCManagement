using System.Collections.Concurrent;
using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal sealed class PurchaseReceiptDraftWorkflow(
    IpcManagementContext context,
    IStockLedgerService stockLedgerService,
    IEfTransactionRunner transactionRunner,
    PurchaseReceivingQueries queries,
    PurchaseReceivingValidator validator,
    Func<string, CancellationToken, Task>? faultInjector)
{
    private const string StatusOrdered = "ORDERED";
    private const string StatusPartiallyReceived = "PARTIALLY_RECEIVED";
    private const string StatusReceived = "RECEIVED";
    private const string StatusCancelled = "CANCELLED";
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> InMemoryOrderLocks = new(StringComparer.Ordinal);

    public async Task<WarehousePurchaseReceiptResultDto> RecordAsync(
        RecordWarehousePurchaseReceiptRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        PurchaseReceivingValidator.ValidateDataAnnotations(request);
        foreach (var line in request.Lines)
        {
            PurchaseReceivingValidator.ValidateDataAnnotations(line);
        }

        var purchaseOrderId = GuidHelper.ParseGuidString(request.PurchaseOrderId)
            ?? throw new ArgumentException("Đơn mua hàng không hợp lệ.");
        var warehouseId = GuidHelper.ParseGuidString(request.WarehouseId)
            ?? throw new ArgumentException("Kho nhập hàng không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(userId)
            ?? throw new ArgumentException("Không xác định được người ghi nhận nhập kho.");
        var normalizedKey = request.IdempotencyKey.Trim();
        var receiptId = PurchaseReceivingMapper.BuildReceiptId(purchaseOrderId, normalizedKey);
        var lockKey = Convert.ToHexString(purchaseOrderId);

        SemaphoreSlim? inMemoryLock = null;
        if (queries.IsInMemoryProvider())
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
        RecordWarehousePurchaseReceiptRequest request,
        string normalizedKey,
        byte[] purchaseOrderId,
        byte[] warehouseId,
        byte[] actorId,
        byte[] receiptId,
        CancellationToken cancellationToken)
    {
        var mutationStarted = false;

        try
        {
            return await transactionRunner.ExecuteAsync(
                async token =>
                {
                    var order = await queries.LoadOrderAsync(purchaseOrderId, token)
                        ?? throw new KeyNotFoundException("Không tìm thấy đơn mua hàng.");
                    var requirements = PurchaseReceivingMapper.BuildEvidenceRequirements(order);
                    var existingReceipt = await queries.LoadReceiptAsync(receiptId, token);
                    if (existingReceipt is not null)
                    {
                        PurchaseReceivingValidator.ValidateIdempotentReplay(existingReceipt, order, request, warehouseId);
                        return PurchaseReceivingMapper.BuildResult(existingReceipt, order, normalizedKey, requirements);
                    }

                    if (order.Status is StatusCancelled or StatusReceived)
                    {
                        throw new BusinessRuleException("Đơn mua hàng đã đóng hoặc bị hủy, không thể nhập thêm.");
                    }

                    if (order.Status is not StatusOrdered and not StatusPartiallyReceived)
                    {
                        throw new BusinessRuleException("Trạng thái đơn mua hàng không cho phép nhập kho.");
                    }

                    var purchaseRequestId = GuidHelper.ToGuidString(order.PurchaseRequestId);
                    var supplementalAudit = await context.Auditlogs
                        .AsNoTracking()
                        .Where(item => item.EntityName == nameof(SupplementalMaterialRequest) &&
                            item.FieldName == "PurchaseRequestId" &&
                            item.NewValue == purchaseRequestId)
                        .OrderByDescending(item => item.ChangedAt)
                        .FirstOrDefaultAsync(token);
                    var supplementalRequest = supplementalAudit?.EntityId is null
                        ? null
                        : await context.Supplementalmaterialrequests
                            .AsNoTracking()
                            .FirstOrDefaultAsync(item => item.RequestId == supplementalAudit.EntityId, token);
                    if (supplementalRequest is not null && !supplementalRequest.WarehouseId.SequenceEqual(warehouseId))
                    {
                        throw new BusinessRuleException(
                            "Đơn mua bổ sung phải được nhập vào đúng kho đang xử lý yêu cầu của bếp.");
                    }

                    var validatedLines = await validator.ValidateActualReceiptAsync(order, requirements, request, token);
                    var now = DateTime.UtcNow;
                    var receipt = new InventoryReceipt
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
                        receipt.Inventoryreceiptlines.Add(new InventoryReceiptLine
                        {
                            ReceiptLineId = PurchaseReceivingMapper.BuildReceiptLineId(receiptId, orderLine.PurchaseOrderLineId),
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
                            PackagePolicyVersionSnapshot = PurchaseReceivingMapper.NormalizeOptional(input.PackagePolicyVersion),
                            LotNumber = PurchaseReceivingMapper.NormalizeOptional(input.LotNumber),
                            ManufactureDate = input.ManufactureDate,
                            ExpiredDate = input.ExpiryDate
                        });
                    }

                    context.Inventoryreceipts.Add(receipt);
                    mutationStarted = true;
                    await InjectFaultAsync("AfterReceipt", token);

                    foreach (var line in receipt.Inventoryreceiptlines)
                    {
                        await stockLedgerService.AddStockAsync(
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

                    await InjectFaultAsync("AfterStock", token);

                    var oldStatus = order.Status;
                    foreach (var validated in validatedLines)
                    {
                        validated.OrderLine.ReceivedQty = DecimalPolicy.RoundQuantity(
                            validated.OrderLine.ReceivedQty + validated.Input.ActualQuantity);
                    }

                    order.Status = PurchaseReceivingMapper.ComputeOrderStatus(order.Purchaseorderlines);
                    order.UpdatedAt = now;
                    await InjectFaultAsync("AfterOrderProgress", token);

                    context.Auditlogs.Add(new AuditLog
                    {
                        AuditId = PurchaseReceivingMapper.BuildAuditId(receiptId),
                        ChangedAt = now,
                        ChangedBy = actorId,
                        BusinessArea = "Receipt",
                        EntityName = nameof(PurchaseOrder),
                        EntityId = order.PurchaseOrderId,
                        FieldName = nameof(PurchaseOrder.Status),
                        OldValue = oldStatus,
                        NewValue = order.Status,
                        Reason = $"Kho ghi nhận phiếu {receipt.ReceiptCode} cho {order.PurchaseOrderCode}."
                    });
                    await InjectFaultAsync("AfterAudit", token);

                    await context.SaveChangesAsync(token);
                    return PurchaseReceivingMapper.BuildResult(receipt, order, normalizedKey, requirements);
                },
                async token =>
                {
                    var order = await queries.LoadOrderAsync(purchaseOrderId, token);
                    var receipt = await queries.LoadReceiptAsync(receiptId, token);
                    if (order is null || receipt is null)
                    {
                        return false;
                    }

                    PurchaseReceivingValidator.ValidateIdempotentReplay(receipt, order, request, warehouseId);
                    return true;
                },
                IsolationLevel.Serializable,
                cancellationToken);
        }
        catch
        {
            if (mutationStarted || context.Database.IsRelational())
            {
                context.ChangeTracker.Clear();
            }
            throw;
        }
    }

    private Task InjectFaultAsync(string point, CancellationToken cancellationToken)
        => faultInjector?.Invoke(point, cancellationToken) ?? Task.CompletedTask;
}
