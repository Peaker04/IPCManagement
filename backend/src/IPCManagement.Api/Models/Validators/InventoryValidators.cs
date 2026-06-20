using FluentValidation;
using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Models.Validators;

public class CreateInventoryReceiptDtoValidator : AbstractValidator<CreateInventoryReceiptDto>
{
    public CreateInventoryReceiptDtoValidator()
    {
        RuleFor(x => x.ReceiptDate)
            .NotEmpty().WithMessage("Ngày nhập kho không được để trống.")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.Today.AddDays(1)))
            .WithMessage("Ngày nhập kho không được là ngày tương lai xa.");

        RuleFor(x => x.SupplierId)
            .NotEmpty().WithMessage("Nhà cung cấp không được để trống.")
            .Must(BeValidGuid).WithMessage("SupplierId phải là GUID hợp lệ.");

        RuleFor(x => x.WarehouseId)
            .NotEmpty().WithMessage("Kho không được để trống.")
            .Must(BeValidGuid).WithMessage("WarehouseId phải là GUID hợp lệ.");

        RuleFor(x => x.Lines)
            .NotEmpty().WithMessage("Phiếu nhập phải có ít nhất 1 dòng chi tiết.");

        RuleForEach(x => x.Lines).SetValidator(new CreateInventoryReceiptLineDtoValidator());
    }

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);
}

public class CreateInventoryReceiptLineDtoValidator : AbstractValidator<CreateInventoryReceiptLineDto>
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

public class CreateInventoryIssueDtoValidator : AbstractValidator<CreateInventoryIssueDto>
{
    public CreateInventoryIssueDtoValidator()
    {
        RuleFor(x => x.IssueDate)
            .NotEmpty().WithMessage("Ngày xuất kho không được để trống.");

        RuleFor(x => x.WarehouseId)
            .NotEmpty().WithMessage("Kho không được để trống.")
            .Must(BeValidGuid).WithMessage("WarehouseId phải là GUID hợp lệ.");

        RuleFor(x => x.MaterialRequestId)
            .NotEmpty().WithMessage("Yêu cầu vật tư không được để trống.")
            .Must(BeValidGuid).WithMessage("MaterialRequestId phải là GUID hợp lệ.");

        RuleFor(x => x.Lines)
            .NotEmpty().WithMessage("Phiếu xuất phải có ít nhất 1 dòng chi tiết.");

        RuleForEach(x => x.Lines).SetValidator(new CreateInventoryIssueLineDtoValidator());
    }

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);
}

public class CreateInventoryIssueLineDtoValidator : AbstractValidator<CreateInventoryIssueLineDto>
{
    public CreateInventoryIssueLineDtoValidator()
    {
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

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);
}

public class CreateInventoryReturnDtoValidator : AbstractValidator<CreateInventoryReturnDto>
{
    public CreateInventoryReturnDtoValidator()
    {
        RuleFor(x => x.ReturnDate)
            .NotEmpty().WithMessage("Ngày trả nguyên liệu không được để trống.");

        RuleFor(x => x.WarehouseId)
            .NotEmpty().WithMessage("Kho không được để trống.")
            .Must(BeValidGuid).WithMessage("WarehouseId phải là GUID hợp lệ.");

        RuleFor(x => x.IssueId)
            .NotEmpty().WithMessage("Phiếu xuất gốc không được để trống.")
            .Must(BeValidGuid).WithMessage("IssueId phải là GUID hợp lệ.");

        RuleFor(x => x.Lines)
            .NotEmpty().WithMessage("Phiếu trả phải có ít nhất 1 dòng chi tiết.");

        RuleForEach(x => x.Lines).SetValidator(new CreateInventoryReturnLineDtoValidator());
    }

    private static bool BeValidGuid(string value) => Guid.TryParse(value, out _);
}

public class CreateInventoryReturnLineDtoValidator : AbstractValidator<CreateInventoryReturnLineDto>
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
