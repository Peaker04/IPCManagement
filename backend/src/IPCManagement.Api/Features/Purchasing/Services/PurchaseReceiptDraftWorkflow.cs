using System.Collections.Concurrent;
using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal sealed class PurchaseReceiptDraftWorkflow(
    IpcManagementContext context,
    IEfTransactionRunner transactionRunner,
    ILifecycleTransitionRecorder lifecycleRecorder,
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
                    if (!await queries.WarehouseExistsAsync(warehouseId, token))
                    {
                        throw new KeyNotFoundException("Kho nhập hàng không tồn tại.");
                    }
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
                    foreach (var validated in validatedLines)
                    {
                        var activeReceipt = await queries.LoadActiveReceiptForOrderLineAsync(
                            validated.OrderLine.PurchaseOrderLineId,
                            token);
                        if (activeReceipt is not null)
                        {
                            throw new BusinessRuleException(
                                $"Dòng đơn mua này đang chờ xử lý trong phiếu {activeReceipt.ReceiptCode}. Không được tạo phiếu nhập trùng.");
                        }
                    }

                    var receipt = new InventoryReceipt
                    {
                        ReceiptId = receiptId,
                        ReceiptCode = $"RCP-PO-{Convert.ToHexString(receiptId)}",
                        ReceiptDate = request.ReceiptDate,
                        SupplierId = order.SupplierId,
                        WarehouseId = warehouseId,
                        PurchaseRequestId = order.PurchaseRequestId,
                        PurchaseOrderId = order.PurchaseOrderId,
                        CreatedBy = actorId,
                        CreatedAt = DateTime.UtcNow,
                        Status = "DRAFT",
                        QualityStatus = "PENDING_INSPECTION",
                        ConcurrencyVersion = 0
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
                            PurchaseOrderLineId = orderLine.PurchaseOrderLineId,
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
                    context.Purchasereceiptactivelines.AddRange(validatedLines.Select(validated => new PurchaseReceiptActiveLine
                    {
                        PurchaseOrderLineId = validated.OrderLine.PurchaseOrderLineId,
                        ReceiptId = receiptId,
                        CreatedAt = receipt.CreatedAt
                    }));
                    mutationStarted = true;
                    await InjectFaultAsync("AfterReceipt", token);

                    lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                        "Receipt", receipt.ReceiptId, normalizedKey, 0, null, "DRAFT", actorId, 0,
                        "Tạo phiếu nhập nháp chờ kiểm tra chất lượng.", normalizedKey, null,
                        $"{{\"receiptCode\":\"{receipt.ReceiptCode}\",\"purchaseOrderId\":\"{GuidHelper.ToGuidString(order.PurchaseOrderId)}\"}}",
                        $"{{\"receiptId\":\"{GuidHelper.ToGuidString(receipt.ReceiptId)}\",\"status\":\"DRAFT\"}}"));

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
        catch (DbUpdateException) when (context.Database.IsRelational())
        {
            context.ChangeTracker.Clear();
            foreach (var sourceLineId in request.Lines
                         .Select(line => GuidHelper.ParseGuidString(line.PurchaseOrderLineId))
                         .Where(line => line is not null))
            {
                var activeReceipt = await queries.LoadActiveReceiptForOrderLineAsync(sourceLineId!, cancellationToken);
                if (activeReceipt is not null)
                {
                    throw new BusinessRuleException(
                        $"Dòng đơn mua này đang chờ xử lý trong phiếu {activeReceipt.ReceiptCode}. Không được tạo phiếu nhập trùng.");
                }
            }

            throw;
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
