using FluentValidation;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Features.Inventory.Contracts;

namespace IPCManagement.Api.Features.Inventory.Validators;

public class CreateInventoryReceiptDtoValidator : AbstractValidator<CreateInventoryReceiptRequest>
{
    public CreateInventoryReceiptDtoValidator()
    {
        RuleFor(x => x.ReceiptDate)
            .NotEmpty().WithMessage("Ngày nhập kho không được để trống.")
            .LessThanOrEqualTo(ServiceCalendar.Today().AddDays(1))
            .WithMessage("Ngày nhập kho không được là ngày tương lai xa.");

        RuleFor(x => x.SupplierId)
            .NotEmpty().WithMessage("Nhà cung cấp không được để trống.")
            .Must(BeValidGuid).WithMessage("SupplierId phải là GUID hợp lệ.");

        RuleFor(x => x.WarehouseId)
            .Must(BeValidGuid!).WithMessage("WarehouseId phải là GUID hợp lệ.")
            .When(x => x.WarehouseId is not null);

        RuleFor(x => x.Lines)
            .NotEmpty().WithMessage("Phiếu nhập phải có ít nhất 1 dòng chi tiết.");

        RuleForEach(x => x.Lines).SetValidator(new CreateInventoryReceiptLineDtoValidator());
    }

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);
}

public class CreateInventoryReceiptLineDtoValidator : AbstractValidator<CreateInventoryReceiptLineRequest>
{
    public CreateInventoryReceiptLineDtoValidator()
    {
        RuleFor(x => x.IngredientId)
            .NotEmpty().WithMessage("Nguyên liệu không được để trống.")
            .Must(BeValidGuid).WithMessage("IngredientId phải là GUID hợp lệ.");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("Số lượng phải lớn hơn 0.");

        RuleFor(x => x.UnitId)
            .NotEmpty().WithMessage("Đơn vị tính không được để trống.")
            .Must(BeValidGuid).WithMessage("UnitId phải là GUID hợp lệ.");

        RuleFor(x => x.UnitPrice)
            .GreaterThanOrEqualTo(0).WithMessage("Đơn giá phải >= 0.");

        RuleFor(x => x.ExpiredDate)
            .GreaterThan(x => x.ManufactureDate)
            .When(x => x.ExpiredDate.HasValue && x.ManufactureDate.HasValue)
            .WithMessage("Ngày hết hạn phải sau ngày sản xuất.");
    }

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);
}

public class CreateInventoryIssueDtoValidator : AbstractValidator<CreateInventoryIssueRequest>
{
    public CreateInventoryIssueDtoValidator()
    {
        RuleFor(x => x.CommandId).NotEmpty().MaximumLength(128);
        RuleFor(x => x.ExpectedVersion).GreaterThanOrEqualTo(0);
        RuleFor(x => x.IssueDate)
            .NotEmpty().WithMessage("Ngày xuất kho không được để trống.");

        RuleFor(x => x.WarehouseId)
            .Must(BeValidGuid!).WithMessage("WarehouseId phải là GUID hợp lệ.")
            .When(x => x.WarehouseId is not null);

        RuleFor(x => x).Must(x =>
                !string.IsNullOrWhiteSpace(x.MaterialRequestId) ^ !string.IsNullOrWhiteSpace(x.ReconciliationBatchId))
            .WithMessage("Phiếu xuất phải có đúng một nguồn nhu cầu hoặc lô đối chiếu.");
        RuleFor(x => x.MaterialRequestId).Must(BeValidGuid).When(x => !string.IsNullOrWhiteSpace(x.MaterialRequestId))
            .WithMessage("MaterialRequestId phải là GUID hợp lệ.");
        RuleFor(x => x.ReconciliationBatchId).Must(BeValidGuid).When(x => !string.IsNullOrWhiteSpace(x.ReconciliationBatchId))
            .WithMessage("ReconciliationBatchId phải là GUID hợp lệ.");

        RuleForEach(x => x.Lines).SetValidator(new CreateInventoryIssueLineDtoValidator());
        RuleFor(x => x).Custom((request, context) =>
        {
            var headerIsMaterial = !string.IsNullOrWhiteSpace(request.MaterialRequestId);
            foreach (var line in request.Lines)
            {
                var lineIsMaterial = !string.IsNullOrWhiteSpace(line.MaterialRequestLineId);
                var lineIsReconciliation = !string.IsNullOrWhiteSpace(line.ReconciliationBatchLineId);
                if (lineIsMaterial == lineIsReconciliation || lineIsMaterial != headerIsMaterial)
                {
                    context.AddFailure(nameof(request.Lines), "Mỗi dòng xuất phải có đúng một nguồn và cùng loại với nguồn phiếu xuất.");
                    break;
                }
            }
        });
    }

    private static bool BeValidGuid(string? value) => Guid.TryParse(value, out _);
}

public class CreateInventoryIssueLineDtoValidator : AbstractValidator<CreateInventoryIssueLineRequest>
{
    public CreateInventoryIssueLineDtoValidator()
    {
        RuleFor(x => x).Must(x =>
                !string.IsNullOrWhiteSpace(x.MaterialRequestLineId) ^ !string.IsNullOrWhiteSpace(x.ReconciliationBatchLineId))
            .WithMessage("Dòng xuất phải có đúng một loại dòng nguồn.");
        When(x => !string.IsNullOrWhiteSpace(x.MaterialRequestLineId), () =>
            RuleFor(x => x.MaterialRequestLineId).Must(BeValidGuid).WithMessage("MaterialRequestLineId phải là GUID hợp lệ."));
        When(x => !string.IsNullOrWhiteSpace(x.ReconciliationBatchLineId), () =>
            RuleFor(x => x.ReconciliationBatchLineId).Must(BeValidGuid).WithMessage("ReconciliationBatchLineId phải là GUID hợp lệ."));

        RuleFor(x => x.IngredientId)
            .NotEmpty().WithMessage("Nguyên liệu không được để trống.")
            .Must(BeValidGuid).WithMessage("IngredientId phải là GUID hợp lệ.");

        RuleFor(x => x.RequestedQty)
            .GreaterThan(0).WithMessage("Số lượng yêu cầu phải lớn hơn 0.");

        RuleFor(x => x.IssuedQty)
            .GreaterThan(0).WithMessage("Số lượng xuất phải lớn hơn 0.")
            .LessThanOrEqualTo(x => x.RequestedQty)
            .WithMessage("Số lượng xuất không được vượt quá số lượng yêu cầu.");

        RuleFor(x => x.UnitId)
            .NotEmpty().WithMessage("Đơn vị tính không được để trống.")
            .Must(BeValidGuid).WithMessage("UnitId phải là GUID hợp lệ.");
    }

    private static bool BeValidGuid(string? value) => Guid.TryParse(value, out _);
}

public class CreateInventoryReturnDtoValidator : AbstractValidator<CreateInventoryReturnRequest>
{
    public CreateInventoryReturnDtoValidator()
    {
        RuleFor(x => x.ReturnDate)
            .NotEmpty().WithMessage("Ngày trả nguyên liệu không được để trống.");

        RuleFor(x => x.WarehouseId)
            .Must(BeValidGuid!).WithMessage("WarehouseId phải là GUID hợp lệ.")
            .When(x => x.WarehouseId is not null);

        RuleFor(x => x.IssueId)
            .NotEmpty().WithMessage("Phiếu xuất gốc không được để trống.")
            .Must(BeValidGuid).WithMessage("IssueId phải là GUID hợp lệ.");

        RuleFor(x => x.ReturnType)
            .Must(BeValidReturnType).WithMessage("Loại ghi nhận phải là RETURN hoặc WASTE.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Cần ghi lý do trả kho hoặc hao hụt thực tế.");

        RuleFor(x => x.Lines)
            .NotEmpty().WithMessage("Phiếu trả phải có ít nhất 1 dòng chi tiết.");

        RuleForEach(x => x.Lines).SetValidator(new CreateInventoryReturnLineDtoValidator());
    }

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);

    private static bool BeValidReturnType(string value)
        => string.Equals(value, "RETURN", StringComparison.OrdinalIgnoreCase) ||
           string.Equals(value, "WASTE", StringComparison.OrdinalIgnoreCase);
}

public class CreateInventoryReturnLineDtoValidator : AbstractValidator<CreateInventoryReturnLineRequest>
{
    public CreateInventoryReturnLineDtoValidator()
    {
        RuleFor(x => x.IngredientId)
            .NotEmpty().WithMessage("Nguyên liệu không được để trống.")
            .Must(BeValidGuid).WithMessage("IngredientId phải là GUID hợp lệ.");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("Số lượng trả phải lớn hơn 0.");

        RuleFor(x => x.UnitId)
            .NotEmpty().WithMessage("Đơn vị tính không được để trống.")
            .Must(BeValidGuid).WithMessage("UnitId phải là GUID hợp lệ.");
    }

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);
}

public class CreateInventoryReceiptFromPurchaseDtoValidator : AbstractValidator<CreateInventoryReceiptFromPurchaseRequest>
{
    public CreateInventoryReceiptFromPurchaseDtoValidator()
    {
        RuleFor(x => x.PurchaseRequestId)
            .NotEmpty().WithMessage("PurchaseRequestId không được để trống.")
            .Must(BeValidGuid).WithMessage("PurchaseRequestId phải là GUID hợp lệ.");

        RuleFor(x => x.ReceiptDate)
            .NotEmpty().WithMessage("Ngày nhập kho không được để trống.")
            .LessThanOrEqualTo(ServiceCalendar.Today().AddDays(1))
            .WithMessage("Ngày nhập kho không được là ngày tương lai xa.");

        RuleFor(x => x.SupplierId)
            .NotEmpty().WithMessage("Nhà cung cấp không được để trống.")
            .Must(BeValidGuid).WithMessage("SupplierId phải là GUID hợp lệ.");

        RuleFor(x => x.WarehouseId)
            .Must(BeValidGuid!).WithMessage("WarehouseId phải là GUID hợp lệ.")
            .When(x => x.WarehouseId is not null);

        RuleFor(x => x.Lines)
            .NotEmpty().WithMessage("Phiếu nhập phải có ít nhất 1 dòng chi tiết.");

        RuleForEach(x => x.Lines).SetValidator(new CreateInventoryReceiptFromPurchaseLineDtoValidator());
    }

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);
}

public class CreateInventoryReceiptFromPurchaseLineDtoValidator : AbstractValidator<CreateInventoryReceiptFromPurchaseLineRequest>
{
    public CreateInventoryReceiptFromPurchaseLineDtoValidator()
    {
        RuleFor(x => x.PurchaseRequestLineId)
            .NotEmpty().WithMessage("PurchaseRequestLineId không được để trống.")
            .Must(BeValidGuid).WithMessage("PurchaseRequestLineId phải là GUID hợp lệ.");

        RuleFor(x => x.ReceivedQty)
            .GreaterThan(0).WithMessage("Số lượng nhận phải lớn hơn 0.");

        RuleFor(x => x.UnitId)
            .NotEmpty().WithMessage("Đơn vị tính không được để trống.")
            .Must(BeValidGuid).WithMessage("UnitId phải là GUID hợp lệ.");

        RuleFor(x => x.UnitPrice)
            .GreaterThanOrEqualTo(0).When(x => x.UnitPrice.HasValue).WithMessage("Đơn giá phải >= 0.");

        RuleFor(x => x.ExpiredDate)
            .GreaterThan(x => x.ManufactureDate)
            .When(x => x.ExpiredDate.HasValue && x.ManufactureDate.HasValue)
            .WithMessage("Ngày hết hạn phải sau ngày sản xuất.");
    }

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);
}
