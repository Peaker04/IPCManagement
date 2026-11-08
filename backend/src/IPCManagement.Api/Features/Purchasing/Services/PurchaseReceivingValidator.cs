using System.ComponentModel.DataAnnotations;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal sealed class PurchaseReceivingValidator(PurchaseReceivingQueries queries)
{
    public static void ValidateDataAnnotations(object value)
    {
        var validationResults = new List<ValidationResult>();
        if (!Validator.TryValidateObject(value, new ValidationContext(value), validationResults, validateAllProperties: true))
        {
            throw new ArgumentException(string.Join(" ", validationResults.Select(result => result.ErrorMessage)));
        }
    }

    public async Task<IReadOnlyList<ValidatedReceiptLine>> ValidateActualReceiptAsync(
        PurchaseOrder order,
        IReadOnlyList<PurchaseReceiptEvidenceRequirementsDto> requirements,
        RecordWarehousePurchaseReceiptRequest request,
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
                throw new BusinessRuleException("Đơn vị thực nhận không khớp đơn vị đã đặt.");
            }

            var newTotal = DecimalPolicy.RoundQuantity(orderLine.ReceivedQty + input.ActualQuantity);
            if (DecimalPolicy.GreaterThanQuantity(newTotal, orderLine.OrderedQty))
            {
                throw new BusinessRuleException(
                    $"Số lượng thực nhận cho '{orderLine.Ingredient.IngredientName}' vượt số lượng còn lại.");
            }

            var requirement = requirementsByLine[GuidHelper.ToGuidString(orderLine.PurchaseOrderLineId)];
            if (!string.IsNullOrWhiteSpace(requirement.BlockerReason))
            {
                throw new BusinessRuleException(requirement.BlockerReason);
            }

            ValidateRequiredEvidence(requirement, input);
            if (input.PackageBaseUnitId is not null)
            {
                var packageBaseUnitId = GuidHelper.ParseGuidString(input.PackageBaseUnitId)
                    ?? throw new ArgumentException("Đơn vị cơ sở của quy cách không hợp lệ.");
                var packageUnitExists = await queries.UnitExistsAsync(packageBaseUnitId, cancellationToken);
                if (!packageUnitExists)
                {
                    throw new BusinessRuleException("Không tìm thấy đơn vị cơ sở của quy cách đóng gói.");
                }
            }

            validated.Add(new ValidatedReceiptLine(orderLine, input));
        }

        return validated;
    }

    public static void ValidateIdempotentReplay(
        InventoryReceipt existingReceipt,
        PurchaseOrder order,
        RecordWarehousePurchaseReceiptRequest request,
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
                    string.Equals(stored.LotNumber, PurchaseReceivingMapper.NormalizeOptional(input.LotNumber), StringComparison.Ordinal) &&
                    stored.ManufactureDate == input.ManufactureDate &&
                    stored.ExpiredDate == input.ExpiryDate &&
                    stored.PackageQuantitySnapshot == input.PackageQuantity &&
                    PurchaseReceivingMapper.ByteArraysEqual(stored.PackageBaseUnitIdSnapshot, GuidHelper.ParseGuidString(input.PackageBaseUnitId)) &&
                    string.Equals(stored.PackagePolicyVersionSnapshot, PurchaseReceivingMapper.NormalizeOptional(input.PackagePolicyVersion), StringComparison.Ordinal);
            });

        if (!matches)
        {
            throw new BusinessRuleException("Idempotency key đã được dùng với nội dung phiếu nhập khác.");
        }
    }

    private static void ValidateRequiredEvidence(
        PurchaseReceiptEvidenceRequirementsDto requirement,
        WarehousePurchaseReceiptLineRequest input)
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

    internal sealed record ValidatedReceiptLine(
        PurchaseOrderLine OrderLine,
        WarehousePurchaseReceiptLineRequest Input);
}
