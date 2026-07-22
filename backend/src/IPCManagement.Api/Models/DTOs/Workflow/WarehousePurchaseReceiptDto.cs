using System.ComponentModel.DataAnnotations;

namespace IPCManagement.Api.Models.DTOs.Workflow;

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

public sealed class RecordWarehousePurchaseReceiptDto : IValidatableObject
{
    [Required, MaxLength(36)]
    public string PurchaseOrderId { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string IdempotencyKey { get; set; } = string.Empty;

    [Required, MaxLength(36)]
    public string WarehouseId { get; set; } = string.Empty;

    public DateOnly ReceiptDate { get; set; }

    [Required, MinLength(1)]
    public IReadOnlyList<WarehousePurchaseReceiptLineDto> Lines { get; set; } = [];

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

public sealed class WarehousePurchaseReceiptLineDto : IValidatableObject
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
    public IReadOnlyList<PurchaseReceiptEvidenceRequirementsDto> EvidenceRequirements { get; set; } = [];
}
