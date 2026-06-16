using FluentValidation;
using IPCManagement.Api.Models.DTOs.Ingredient;

namespace IPCManagement.Api.Models.Validators;

public class CreateIngredientDtoValidator : AbstractValidator<CreateIngredientDto>
{
    public CreateIngredientDtoValidator()
    {
        RuleFor(x => x.IngredientCode)
            .NotEmpty().WithMessage("Mã nguyên liệu không được để trống.")
            .MaximumLength(50).WithMessage("Mã nguyên liệu không vượt quá 50 ký tự.");

        RuleFor(x => x.IngredientName)
            .NotEmpty().WithMessage("Tên nguyên liệu không được để trống.")
            .MaximumLength(200).WithMessage("Tên nguyên liệu không vượt quá 200 ký tự.");

        RuleFor(x => x.ReferencePrice)
            .GreaterThanOrEqualTo(0).WithMessage("Giá tham chiếu phải >= 0.");

        RuleFor(x => x.UnitId)
            .NotEmpty().WithMessage("Đơn vị tính không được để trống.")
            .Must(BeValidGuid).WithMessage("UnitId phải là GUID hợp lệ.");

        RuleFor(x => x.WarehouseId)
            .NotEmpty().WithMessage("Kho không được để trống.")
            .Must(BeValidGuid).WithMessage("WarehouseId phải là GUID hợp lệ.");
    }

    private static bool BeValidGuid(string value)
        => Guid.TryParse(value, out _);
}

public class UpdateIngredientDtoValidator : AbstractValidator<UpdateIngredientDto>
{
    public UpdateIngredientDtoValidator()
    {
        RuleFor(x => x.IngredientName)
            .MaximumLength(200).WithMessage("Tên nguyên liệu không vượt quá 200 ký tự.")
            .When(x => x.IngredientName is not null);

        RuleFor(x => x.ReferencePrice)
            .GreaterThanOrEqualTo(0).WithMessage("Giá tham chiếu phải >= 0.")
            .When(x => x.ReferencePrice.HasValue);

        RuleFor(x => x.UnitId)
            .Must(BeValidGuid!).WithMessage("UnitId phải là GUID hợp lệ.")
            .When(x => x.UnitId is not null);

        RuleFor(x => x.WarehouseId)
            .Must(BeValidGuid!).WithMessage("WarehouseId phải là GUID hợp lệ.")
            .When(x => x.WarehouseId is not null);
    }

    private static bool BeValidGuid(string value)
        => Guid.TryParse(value, out _);
}
