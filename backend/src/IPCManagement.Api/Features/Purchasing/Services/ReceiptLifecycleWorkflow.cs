using System.Data;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal sealed class ReceiptLifecycleWorkflow(
    IpcManagementContext context,
    IStockLedgerService stockLedgerService,
    IEfTransactionRunner transactionRunner,
    ILifecycleTransitionRecorder lifecycleRecorder,
    PurchaseReceivingQueries queries)
{
    public async Task<WarehousePurchaseReceiptResultDto> AcceptQualityAsync(
        string receiptId,
        ReceiptQualityDecisionRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        PurchaseReceivingValidator.ValidateDataAnnotations(request);
        var receiptIdBytes = GuidHelper.ParseGuidString(receiptId)
            ?? throw new ArgumentException("Phiếu nhập không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(userId)
            ?? throw new ArgumentException("Không xác định được người kiểm tra chất lượng.");
        var commandId = request.CommandId.Trim();

        return await transactionRunner.ExecuteAsync(
            async token =>
            {
                var receipt = await queries.LoadReceiptAsync(receiptIdBytes, token)
                    ?? throw new KeyNotFoundException("Không tìm thấy phiếu nhập kho.");
                var order = await queries.LoadOrderForReceiptAsync(receipt, token)
                    ?? throw new BusinessRuleException("Không xác định được đơn mua nguồn của phiếu nhập.");
                var existing = await lifecycleRecorder.FindExistingCommandAsync(commandId, "Receipt", receiptIdBytes, token);
                if (existing is not null)
                {
                    return BuildResult(receipt, order, commandId);
                }

                if (receipt.Status != "DRAFT" || receipt.QualityStatus != "PENDING_INSPECTION")
                {
                    throw new BusinessRuleException("Chỉ phiếu nhập DRAFT đang chờ kiểm tra mới được xác nhận chất lượng.");
                }
                if (receipt.CreatedBy.SequenceEqual(actorId))
                {
                    throw new BusinessRuleException("Người tạo phiếu nhập không được tự kiểm tra chất lượng.");
                }
                if (receipt.ConcurrencyVersion != request.ExpectedVersion)
                {
                    throw new BusinessRuleException("Phiếu nhập đã thay đổi; hãy tải lại trước khi xác nhận chất lượng.");
                }

                var inputByLine = request.Lines.ToDictionary(item => item.ReceiptLineId, StringComparer.OrdinalIgnoreCase);
                if (inputByLine.Count != request.Lines.Count ||
                    inputByLine.Count != receipt.Inventoryreceiptlines.Count ||
                    receipt.Inventoryreceiptlines.Any(line =>
                        !inputByLine.ContainsKey(GuidHelper.ToGuidString(line.ReceiptLineId))))
                {
                    throw new ArgumentException("Kết quả kiểm tra phải bao phủ chính xác từng dòng phiếu nhập.");
                }

                var acceptedAny = false;
                var rejectedAny = false;
                foreach (var line in receipt.Inventoryreceiptlines)
                {
                    var input = inputByLine[GuidHelper.ToGuidString(line.ReceiptLineId)];
                    var accepted = DecimalPolicy.RoundQuantity(input.AcceptedQuantity);
                    var rejected = DecimalPolicy.RoundQuantity(input.RejectedQuantity);
                    if (accepted < 0 ||
                        rejected < 0 ||
                        DecimalPolicy.RoundQuantity(accepted + rejected) != DecimalPolicy.RoundQuantity(line.Quantity))
                    {
                        throw new BusinessRuleException("Số lượng đạt và không đạt phải không âm và bằng đúng số lượng dòng nhập.");
                    }
                    if (rejected > 0 && string.IsNullOrWhiteSpace(input.Reason))
                    {
                        throw new ArgumentException("Dòng bị từ chối chất lượng phải có lý do.");
                    }

                    line.AcceptedQuantity = accepted;
                    line.RejectedQuantity = rejected;
                    line.QualityReason = string.IsNullOrWhiteSpace(input.Reason) ? null : input.Reason.Trim();
                    acceptedAny |= accepted > 0;
                    rejectedAny |= rejected > 0;
                }

                var fromState = receipt.Status;
                receipt.QualityStatus = acceptedAny
                    ? rejectedAny ? "PARTIALLY_ACCEPTED" : "ACCEPTED"
                    : "REJECTED";
                receipt.Status = acceptedAny ? "PENDING_APPROVAL" : "REJECTED";
                receipt.QualityCheckedBy = actorId;
                receipt.QualityCheckedAt = DateTime.UtcNow;
                receipt.RejectedBy = acceptedAny ? null : actorId;
                receipt.RejectedAt = acceptedAny ? null : DateTime.UtcNow;
                receipt.RejectionReason = acceptedAny
                    ? null
                    : string.Join("; ", receipt.Inventoryreceiptlines
                        .Where(line => !string.IsNullOrWhiteSpace(line.QualityReason))
                        .Select(line => line.QualityReason));
                receipt.ConcurrencyVersion++;
                lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                    "Receipt", receipt.ReceiptId, commandId, checked((int)receipt.ConcurrencyVersion),
                    fromState, receipt.Status, actorId, request.ExpectedVersion,
                    receipt.RejectionReason ?? "Đã xác nhận chất lượng phiếu nhập.", commandId, null,
                    $"{{\"qualityStatus\":\"{receipt.QualityStatus}\"}}",
                    $"{{\"receiptId\":\"{GuidHelper.ToGuidString(receipt.ReceiptId)}\",\"status\":\"{receipt.Status}\"}}"));
                await context.SaveChangesAsync(token);
                return BuildResult(receipt, order, commandId);
            },
            token => context.Lifecyclecommandreceipts.AnyAsync(item => item.CommandId == commandId, token),
            IsolationLevel.Serializable,
            cancellationToken);
    }

    public async Task<WarehousePurchaseReceiptResultDto> PostAsync(
        string receiptId,
        ReceiptPostRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        PurchaseReceivingValidator.ValidateDataAnnotations(request);
        var receiptIdBytes = GuidHelper.ParseGuidString(receiptId)
            ?? throw new ArgumentException("Phiếu nhập không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(userId)
            ?? throw new ArgumentException("Không xác định được người thực thi posting.");
        var commandId = request.CommandId.Trim();

        return await transactionRunner.ExecuteAsync(
            async token =>
            {
                var receipt = await queries.LoadReceiptAsync(receiptIdBytes, token)
                    ?? throw new KeyNotFoundException("Không tìm thấy phiếu nhập kho.");
                var order = await queries.LoadOrderForReceiptAsync(receipt, token)
                    ?? throw new BusinessRuleException("Không xác định được đơn mua nguồn của phiếu nhập.");
                var existing = await lifecycleRecorder.FindExistingCommandAsync(commandId, "Receipt", receiptIdBytes, token);
                if (existing is not null)
                {
                    return BuildResult(receipt, order, commandId);
                }

                if (receipt.Status != "APPROVED" || receipt.QualityStatus is not ("ACCEPTED" or "PARTIALLY_ACCEPTED"))
                {
                    throw new BusinessRuleException("Chỉ phiếu nhập đã duyệt và có kết quả chất lượng hợp lệ mới được POSTED.");
                }
                if (receipt.ConcurrencyVersion != request.ExpectedVersion)
                {
                    throw new BusinessRuleException("Phiếu nhập đã thay đổi; hãy tải lại trước khi POSTED.");
                }
                if (receipt.CreatedBy.SequenceEqual(actorId) ||
                    receipt.QualityCheckedBy is not null && receipt.QualityCheckedBy.SequenceEqual(actorId) ||
                    receipt.ManagerApprovedBy is not null && receipt.ManagerApprovedBy.SequenceEqual(actorId))
                {
                    throw new BusinessRuleException("Người tạo, người kiểm tra hoặc người duyệt không được tự POSTED phiếu nhập.");
                }

                var orderLines = order.Purchaseorderlines.ToDictionary(
                    line => GuidHelper.ToGuidString(line.PurchaseRequestLineId),
                    StringComparer.OrdinalIgnoreCase);
                foreach (var line in receipt.Inventoryreceiptlines)
                {
                    var accepted = line.AcceptedQuantity ?? 0m;
                    if (accepted <= 0)
                    {
                        continue;
                    }
                    if (line.PurchaseRequestLineId is null ||
                        !orderLines.TryGetValue(GuidHelper.ToGuidString(line.PurchaseRequestLineId), out var orderLine))
                    {
                        throw new BusinessRuleException("Dòng phiếu nhập không còn khớp đơn mua nguồn.");
                    }
                    if (DecimalPolicy.GreaterThanQuantity(
                        DecimalPolicy.RoundQuantity(orderLine.ReceivedQty + accepted),
                        orderLine.OrderedQty))
                    {
                        throw new BusinessRuleException("POSTED vượt số lượng còn lại của dòng đơn mua.");
                    }
                }

                var now = DateTime.UtcNow;
                foreach (var line in receipt.Inventoryreceiptlines.Where(line => (line.AcceptedQuantity ?? 0m) > 0m))
                {
                    await stockLedgerService.AddStockAsync(
                        receipt.WarehouseId,
                        line.IngredientId,
                        line.UnitId,
                        line.AcceptedQuantity!.Value,
                        "RECEIPT",
                        "inventoryreceipts",
                        receipt.ReceiptId,
                        actorId,
                        "POSTED phiếu nhập từ đơn mua hàng",
                        $"Phiếu nhập {receipt.ReceiptCode} từ {order.PurchaseOrderCode}",
                        line.LotNumber,
                        line.ManufactureDate,
                        line.ExpiredDate);
                    orderLines[GuidHelper.ToGuidString(line.PurchaseRequestLineId!)].ReceivedQty = DecimalPolicy.RoundQuantity(
                        orderLines[GuidHelper.ToGuidString(line.PurchaseRequestLineId!)].ReceivedQty + line.AcceptedQuantity.Value);
                }

                var oldOrderStatus = order.Status;
                order.Status = PurchaseReceivingMapper.ComputeOrderStatus(order.Purchaseorderlines);
                order.UpdatedAt = now;
                var fromState = receipt.Status;
                receipt.Status = "POSTED";
                receipt.PostedBy = actorId;
                receipt.PostedAt = now;
                receipt.ConcurrencyVersion++;
                lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                    "Receipt", receipt.ReceiptId, commandId, checked((int)receipt.ConcurrencyVersion),
                    fromState, "POSTED", actorId, request.ExpectedVersion,
                    "Admin POSTED phiếu nhập và ghi nhận tồn kho.", commandId, null,
                    $"{{\"purchaseOrderId\":\"{GuidHelper.ToGuidString(order.PurchaseOrderId)}\"}}",
                    $"{{\"receiptId\":\"{GuidHelper.ToGuidString(receipt.ReceiptId)}\",\"status\":\"POSTED\"}}"));
                context.Auditlogs.Add(new AuditLog
                {
                    AuditId = PurchaseReceivingMapper.BuildAuditId(receipt.ReceiptId),
                    ChangedAt = now,
                    ChangedBy = actorId,
                    BusinessArea = "Receipt",
                    EntityName = nameof(PurchaseOrder),
                    EntityId = order.PurchaseOrderId,
                    FieldName = nameof(PurchaseOrder.Status),
                    OldValue = oldOrderStatus,
                    NewValue = order.Status,
                    Reason = $"POSTED phiếu {receipt.ReceiptCode} cho {order.PurchaseOrderCode}."
                });
                await context.SaveChangesAsync(token);
                return BuildResult(receipt, order, commandId);
            },
            token => context.Lifecyclecommandreceipts.AnyAsync(item => item.CommandId == commandId, token),
            IsolationLevel.Serializable,
            cancellationToken);
    }

    public async Task<WarehousePurchaseReceiptResultDto> ReworkAsync(
        string receiptId,
        ReceiptReworkRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        PurchaseReceivingValidator.ValidateDataAnnotations(request);
        var receiptIdBytes = GuidHelper.ParseGuidString(receiptId)
            ?? throw new ArgumentException("Phiếu nhập không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(userId)
            ?? throw new ArgumentException("Không xác định được người xử lý lại phiếu nhập.");
        var commandId = request.CommandId.Trim();
        var reason = request.Reason.Trim();

        return await transactionRunner.ExecuteAsync(
            async token =>
            {
                var receipt = await queries.LoadReceiptAsync(receiptIdBytes, token)
                    ?? throw new KeyNotFoundException("Không tìm thấy phiếu nhập kho.");
                var order = await queries.LoadOrderForReceiptAsync(receipt, token)
                    ?? throw new BusinessRuleException("Không xác định được đơn mua nguồn của phiếu nhập.");
                var existing = await lifecycleRecorder.FindExistingCommandAsync(commandId, "Receipt", receiptIdBytes, token);
                if (existing is not null)
                {
                    return BuildResult(receipt, order, commandId);
                }

                if (receipt.ConcurrencyVersion != request.ExpectedVersion)
                {
                    throw new BusinessRuleException("Phiếu nhập đã thay đổi; hãy tải lại trước khi xử lý lại.");
                }
                if (receipt.Status != "REJECTED")
                {
                    throw new BusinessRuleException("Chỉ phiếu nhập bị từ chối trước POSTED mới được xử lý lại.");
                }
                if (!receipt.CreatedBy.SequenceEqual(actorId))
                {
                    throw new BusinessRuleException("Chỉ người tạo phiếu nhập được yêu cầu xử lý lại.");
                }

                var previousQuality = receipt.QualityStatus;
                var previousRejectedLines = receipt.Inventoryreceiptlines
                    .Where(line => (line.RejectedQuantity ?? 0m) > 0m || !string.IsNullOrWhiteSpace(line.QualityReason))
                    .Select(line => new
                    {
                        receiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
                        rejectedQuantity = line.RejectedQuantity ?? 0m,
                        reason = line.QualityReason
                    })
                    .ToArray();
                var now = DateTime.UtcNow;
                var fromState = receipt.Status;
                receipt.Status = "DRAFT";
                receipt.QualityStatus = "PENDING_INSPECTION";
                receipt.QualityCheckedBy = null;
                receipt.QualityCheckedAt = null;
                receipt.ManagerApprovedBy = null;
                receipt.ManagerApprovedAt = null;
                receipt.ManagerApprovalReason = null;
                receipt.RejectedBy = null;
                receipt.RejectedAt = null;
                receipt.RejectionReason = null;
                foreach (var line in receipt.Inventoryreceiptlines)
                {
                    line.AcceptedQuantity = null;
                    line.RejectedQuantity = null;
                    line.QualityReason = null;
                }
                receipt.ConcurrencyVersion++;

                lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                    "Receipt", receipt.ReceiptId, commandId, checked((int)receipt.ConcurrencyVersion),
                    fromState, receipt.Status, actorId, request.ExpectedVersion, reason, commandId, null,
                    $"{{\"previousQualityStatus\":\"{previousQuality}\",\"previousRejectedLines\":{JsonSerializer.Serialize(previousRejectedLines)}}}",
                    $"{{\"receiptId\":\"{GuidHelper.ToGuidString(receipt.ReceiptId)}\",\"status\":\"{receipt.Status}\",\"qualityStatus\":\"{receipt.QualityStatus}\"}}"));
                context.Auditlogs.Add(new AuditLog
                {
                    AuditId = PurchaseReceivingMapper.BuildAuditId(receipt.ReceiptId, "rework"),
                    ChangedAt = now,
                    ChangedBy = actorId,
                    BusinessArea = "Receipt",
                    EntityName = nameof(InventoryReceipt),
                    EntityId = receipt.ReceiptId,
                    FieldName = nameof(InventoryReceipt.Status),
                    OldValue = fromState,
                    NewValue = receipt.Status,
                    Reason = reason
                });
                await context.SaveChangesAsync(token);
                return BuildResult(receipt, order, commandId);
            },
            token => context.Lifecyclecommandreceipts.AnyAsync(item => item.CommandId == commandId, token),
            IsolationLevel.Serializable,
            cancellationToken);
    }

    public async Task<ReceiptCorrectionResultDto> CreateCorrectionAsync(
        string receiptId,
        CreateReceiptCorrectionRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        PurchaseReceivingValidator.ValidateDataAnnotations(request);
        foreach (var line in request.Lines)
        {
            PurchaseReceivingValidator.ValidateDataAnnotations(line);
            if (!DecimalPolicy.GreaterThanQuantity(line.Quantity, 0m))
            {
                throw new ArgumentException("Số lượng correction phải lớn hơn 0.", nameof(request.Lines));
            }
        }

        if (request.ExpectedVersion != 0)
        {
            throw new BusinessRuleException("Correction mới phải dùng phiên bản ban đầu 0.");
        }

        var receiptIdBytes = GuidHelper.ParseGuidString(receiptId)
            ?? throw new ArgumentException("Phiếu nhập không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(userId)
            ?? throw new ArgumentException("Không xác định được người tạo correction.");
        var commandId = request.CommandId.Trim();
        var reason = request.Reason.Trim();
        var correctionId = PurchaseReceivingMapper.BuildReceiptCorrectionId(receiptIdBytes, commandId);

        return await transactionRunner.ExecuteAsync(
            async token =>
            {
                var receipt = await queries.LoadReceiptAsync(receiptIdBytes, token)
                    ?? throw new KeyNotFoundException("Không tìm thấy phiếu nhập kho.");
                var existing = await lifecycleRecorder.FindExistingCommandAsync(
                    commandId,
                    "ReceiptCorrection",
                    correctionId,
                    token);
                if (existing is not null)
                {
                    var prior = await queries.LoadReceiptCorrectionAsync(correctionId, token)
                        ?? throw new BusinessRuleException("Không tìm thấy chứng từ correction đã ghi nhận.");
                    return PurchaseReceivingMapper.BuildCorrectionResult(prior);
                }

                if (receipt.Status != "POSTED")
                {
                    throw new BusinessRuleException("Chỉ phiếu nhập đã POSTED mới được tạo correction hậu nhập.");
                }

                var requestLines = request.Lines
                    .Select(line => new
                    {
                        SourceId = GuidHelper.ParseGuidString(line.ReceiptLineId)
                            ?? throw new ArgumentException("Dòng phiếu nhập correction không hợp lệ."),
                        Quantity = DecimalPolicy.RoundQuantity(line.Quantity)
                    })
                    .ToList();
                if (requestLines
                    .Select(line => Convert.ToHexString(line.SourceId))
                    .Distinct(StringComparer.Ordinal)
                    .Count() != requestLines.Count)
                {
                    throw new BusinessRuleException("Một dòng phiếu nhập chỉ được correction một lần trong cùng chứng từ.");
                }

                var sourceLines = receipt.Inventoryreceiptlines.ToDictionary(
                    line => Convert.ToHexString(line.ReceiptLineId),
                    StringComparer.Ordinal);
                var correctedBySourceLine = await queries.LoadCorrectedQuantitiesAsync(receipt.ReceiptId, token);
                var correction = new ReceiptCorrection
                {
                    CorrectionId = correctionId,
                    ReceiptId = receipt.ReceiptId,
                    CorrectionCode = $"RCPT-COR-{GuidHelper.ToGuidString(correctionId).ToUpperInvariant()}",
                    CommandId = commandId,
                    Status = "POSTED",
                    Reason = reason,
                    CreatedBy = actorId,
                    CreatedAt = DateTime.UtcNow,
                    ConcurrencyVersion = 1
                };

                foreach (var requestedLine in requestLines)
                {
                    if (!sourceLines.TryGetValue(Convert.ToHexString(requestedLine.SourceId), out var sourceLine))
                    {
                        throw new BusinessRuleException("Dòng correction không thuộc phiếu nhập nguồn.");
                    }

                    var acceptedQuantity = sourceLine.AcceptedQuantity ?? 0m;
                    var alreadyCorrected = correctedBySourceLine.GetValueOrDefault(
                        Convert.ToHexString(sourceLine.ReceiptLineId));
                    if (DecimalPolicy.GreaterThanQuantity(alreadyCorrected + requestedLine.Quantity, acceptedQuantity))
                    {
                        throw new BusinessRuleException("Correction vượt số lượng đã được chấp nhận của dòng phiếu nhập.");
                    }

                    correction.Lines.Add(new ReceiptCorrectionLine
                    {
                        CorrectionLineId = PurchaseReceivingMapper.BuildReceiptCorrectionLineId(
                            correctionId,
                            sourceLine.ReceiptLineId),
                        CorrectionId = correctionId,
                        ReceiptLineId = sourceLine.ReceiptLineId,
                        IngredientId = sourceLine.IngredientId,
                        UnitId = sourceLine.UnitId,
                        Quantity = requestedLine.Quantity,
                        SourceLotNumber = sourceLine.LotNumber,
                        SourceManufactureDate = sourceLine.ManufactureDate,
                        SourceExpiredDate = sourceLine.ExpiredDate
                    });
                }

                context.Receiptcorrections.Add(correction);
                foreach (var line in correction.Lines)
                {
                    await stockLedgerService.RemoveStockWithCheckAsync(
                        receipt.WarehouseId,
                        line.IngredientId,
                        line.UnitId,
                        line.Quantity,
                        "RECEIPT_CORRECTION",
                        "receiptcorrections",
                        correction.CorrectionId,
                        actorId,
                        reason,
                        $"Correction {correction.CorrectionCode} cho phiếu {receipt.ReceiptCode}, dòng nguồn {GuidHelper.ToGuidString(line.ReceiptLineId)}");
                }

                var result = PurchaseReceivingMapper.BuildCorrectionResult(correction);
                lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                    "ReceiptCorrection", correction.CorrectionId, commandId, 1, null, "POSTED", actorId,
                    request.ExpectedVersion, reason, GuidHelper.ToGuidString(receipt.ReceiptId), null,
                    JsonSerializer.Serialize(new
                    {
                        receiptId = GuidHelper.ToGuidString(receipt.ReceiptId),
                        correctionCode = correction.CorrectionCode,
                        lines = result.Lines
                    }),
                    JsonSerializer.Serialize(result)));
                context.Auditlogs.Add(new AuditLog
                {
                    AuditId = PurchaseReceivingMapper.BuildAuditId(correction.CorrectionId, "post-correction"),
                    ChangedAt = correction.CreatedAt,
                    ChangedBy = actorId,
                    BusinessArea = "Receipt",
                    EntityName = nameof(ReceiptCorrection),
                    EntityId = correction.CorrectionId,
                    FieldName = "POSTED",
                    OldValue = null,
                    NewValue = correction.Status,
                    Reason = reason,
                    CorrelationId = GuidHelper.ToGuidString(receipt.ReceiptId)
                });
                await context.SaveChangesAsync(token);
                return result;
            },
            token => context.Lifecyclecommandreceipts.AnyAsync(item =>
                item.CommandId == commandId &&
                item.AggregateType == "ReceiptCorrection" &&
                item.AggregateId == correctionId,
                token),
            IsolationLevel.Serializable,
            cancellationToken);
    }

    private static WarehousePurchaseReceiptResultDto BuildResult(
        InventoryReceipt receipt,
        PurchaseOrder order,
        string commandId)
        => PurchaseReceivingMapper.BuildResult(
            receipt,
            order,
            commandId,
            PurchaseReceivingMapper.BuildEvidenceRequirements(order));
}
