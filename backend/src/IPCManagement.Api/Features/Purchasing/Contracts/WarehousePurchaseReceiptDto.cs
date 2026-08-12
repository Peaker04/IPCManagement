using System.ComponentModel.DataAnnotations;

namespace IPCManagement.Api.Features.Purchasing.Contracts;

public sealed class PurchaseReceiptEvidenceRequirementsDto
{
    public string PurchaseOrderLineId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public bool LotNumberRequired { get; set; }
    public bool ManufactureDateRequired { get; set; }
    public bool ExpiryDateRequired { get; set; }
    public string? BlockerReason { get; set; }
}

public sealed class RecordWarehousePurchaseReceiptRequest : IValidatableObject
{
    [Required, MaxLength(36)]
    public string PurchaseOrderId { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string IdempotencyKey { get; set; } = string.Empty;

    [Required, MaxLength(36)]
    public string WarehouseId { get; set; } = string.Empty;

    public DateOnly ReceiptDate { get; set; }

    [Required, MinLength(1)]
    public IReadOnlyList<WarehousePurchaseReceiptLineRequest> Lines { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ReceiptDate == default)
        {
            yield return new ValidationResult(
                "Ngày nhập kho không được để trống.",
                [nameof(ReceiptDate)]);
        }
    }
}

public sealed class WarehousePurchaseReceiptLineRequest : IValidatableObject
{
    [Required, MaxLength(36)]
    public string PurchaseOrderLineId { get; set; } = string.Empty;

    public decimal ActualQuantity { get; set; }

    [Required, MaxLength(36)]
    public string ActualUnitId { get; set; } = string.Empty;

    public decimal ActualUnitPrice { get; set; }

    [MaxLength(100)]
    public string? LotNumber { get; set; }

    public DateOnly? ManufactureDate { get; set; }

    public DateOnly? ExpiryDate { get; set; }

    public decimal? PackageQuantity { get; set; }

    [MaxLength(36)]
    public string? PackageBaseUnitId { get; set; }

    [MaxLength(100)]
    public string? PackagePolicyVersion { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ActualQuantity <= 0m)
        {
            yield return new ValidationResult(
                "Số lượng thực nhận phải lớn hơn 0.",
                [nameof(ActualQuantity)]);
        }

        if (ActualUnitPrice <= 0m)
        {
            yield return new ValidationResult(
                "Đơn giá thực nhận phải lớn hơn 0.",
                [nameof(ActualUnitPrice)]);
        }

        if (ManufactureDate.HasValue && ExpiryDate.HasValue && ExpiryDate <= ManufactureDate)
        {
            yield return new ValidationResult(
                "Ngày hết hạn phải sau ngày sản xuất.",
                [nameof(ExpiryDate)]);
        }

        var packageFields = new object?[]
        {
            PackageQuantity,
            PackageBaseUnitId,
            PackagePolicyVersion
        };
        var populatedPackageFieldCount = packageFields.Count(value => value switch
        {
            string text => !string.IsNullOrWhiteSpace(text),
            null => false,
            _ => true
        });

        if (populatedPackageFieldCount is > 0 and < 3)
        {
            yield return new ValidationResult(
                "Bằng chứng quy cách đóng gói phải đủ số lượng, đơn vị cơ sở và phiên bản chính sách.",
                [nameof(PackageQuantity), nameof(PackageBaseUnitId), nameof(PackagePolicyVersion)]);
        }
        else if (populatedPackageFieldCount == 3 && PackageQuantity <= 0m)
        {
            yield return new ValidationResult(
                "Số lượng quy cách đóng gói phải lớn hơn 0.",
                [nameof(PackageQuantity)]);
        }
    }
}

public sealed class WarehousePurchaseReceiptResultDto
{
    public string ReceiptId { get; set; } = string.Empty;
    public string PurchaseOrderId { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public string PurchaseOrderStatus { get; set; } = string.Empty;
    public string ReceiptStatus { get; set; } = "DRAFT";
    public string QualityStatus { get; set; } = "PENDING_INSPECTION";
    public long ConcurrencyVersion { get; set; }
    public IReadOnlyList<PurchaseReceiptEvidenceRequirementsDto> EvidenceRequirements { get; set; } = [];
}

public sealed class ReceiptQualityDecisionRequest : IValidatableObject
{
    [Required, MaxLength(100)]
    public string CommandId { get; set; } = string.Empty;

    public long ExpectedVersion { get; set; }

    [Required, MinLength(1)]
    public IReadOnlyList<ReceiptQualityDecisionLineRequest> Lines { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ExpectedVersion < 0)
        {
            yield return new ValidationResult("Phiên bản chứng từ không hợp lệ.", [nameof(ExpectedVersion)]);
        }
    }
}

public sealed class ReceiptQualityDecisionLineRequest
{
    [Required, MaxLength(36)]
    public string ReceiptLineId { get; set; } = string.Empty;

    public decimal AcceptedQuantity { get; set; }
    public decimal RejectedQuantity { get; set; }

    [MaxLength(1000)]
    public string? Reason { get; set; }
}

public sealed class ReceiptPostRequest : IValidatableObject
{
    [Required, MaxLength(100)]
    public string CommandId { get; set; } = string.Empty;

    public long ExpectedVersion { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ExpectedVersion < 0)
        {
            yield return new ValidationResult("Phiên bản chứng từ không hợp lệ.", [nameof(ExpectedVersion)]);
        }
    }
}

public sealed class ReceiptReworkRequest : IValidatableObject
{
    [Required, MaxLength(100)]
    public string CommandId { get; set; } = string.Empty;

    public long ExpectedVersion { get; set; }

    [Required, MaxLength(1000)]
    public string Reason { get; set; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ExpectedVersion < 0)
        {
            yield return new ValidationResult("Phiên bản chứng từ không hợp lệ.", [nameof(ExpectedVersion)]);
        }

        if (string.IsNullOrWhiteSpace(Reason))
        {
            yield return new ValidationResult("Lý do xử lý lại không được để trống.", [nameof(Reason)]);
        }
    }
}

public sealed class ReceiptVoidRequest : IValidatableObject
{
    [Required, MaxLength(100)]
    public string CommandId { get; set; } = string.Empty;

    public long ExpectedVersion { get; set; }

    [Required, MaxLength(1000)]
    public string Reason { get; set; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ExpectedVersion < 0)
        {
            yield return new ValidationResult("Phiên bản chứng từ không hợp lệ.", [nameof(ExpectedVersion)]);
        }
        if (string.IsNullOrWhiteSpace(Reason))
        {
            yield return new ValidationResult("Lý do hủy phiếu không được để trống.", [nameof(Reason)]);
        }
    }
}

public sealed class CreateReceiptCorrectionRequest : IValidatableObject
{
    [Required, MaxLength(100)]
    public string CommandId { get; set; } = string.Empty;

    // A correction is a newly-created aggregate, therefore its first transition
    // has version zero. It must not mutate the POSTED receipt just to advance a
    // technical version counter.
    public long ExpectedVersion { get; set; }

    [Required, MaxLength(1000)]
    public string Reason { get; set; } = string.Empty;

    [Required, MinLength(1)]
    public IReadOnlyList<ReceiptCorrectionLineRequest> Lines { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ExpectedVersion < 0)
        {
            yield return new ValidationResult("Phiên bản correction không hợp lệ.", [nameof(ExpectedVersion)]);
        }
        if (string.IsNullOrWhiteSpace(Reason))
        {
            yield return new ValidationResult("Lý do correction không được để trống.", [nameof(Reason)]);
        }
    }
}

public sealed class ReceiptCorrectionLineRequest
{
    [Required, MaxLength(36)]
    public string ReceiptLineId { get; set; } = string.Empty;

    public decimal Quantity { get; set; }
}

public sealed class ReceiptCorrectionResultDto
{
    public string CorrectionId { get; set; } = string.Empty;
    public string CorrectionCode { get; set; } = string.Empty;
    public string ReceiptId { get; set; } = string.Empty;
    public string Status { get; set; } = "POSTED";
    public long ConcurrencyVersion { get; set; }
    public IReadOnlyList<ReceiptCorrectionLineResultDto> Lines { get; set; } = [];
}

public sealed class ReceiptCorrectionLineResultDto
{
    public string ReceiptLineId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
}
