using FluentValidation;
using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Validators;

public class CreateSupplierQuotationDtoValidator : AbstractValidator<CreateSupplierQuotationRequest>
{
    public CreateSupplierQuotationDtoValidator()
    {
        RuleFor(x => x.SupplierId).NotEmpty().WithMessage("Nhà cung cấp không được để trống.");
        RuleFor(x => x.IngredientId).NotEmpty().WithMessage("Nguyên liệu không được để trống.");
        RuleFor(x => x.UnitPrice).GreaterThan(0).WithMessage("Đơn giá phải lớn hơn 0.");
        RuleFor(x => x.EffectiveFrom).NotEmpty().WithMessage("Ngày bắt đầu hiệu lực không được để trống.");
        RuleFor(x => x.Note).MaximumLength(255).WithMessage("Ghi chú không được vượt quá 255 ký tự.");
    }
}

public class UpdateSupplierQuotationDtoValidator : AbstractValidator<UpdateSupplierQuotationRequest>
{
    public UpdateSupplierQuotationDtoValidator()
    {
        RuleFor(x => x.UnitPrice).GreaterThan(0).WithMessage("Đơn giá phải lớn hơn 0.");
        RuleFor(x => x.EffectiveFrom).NotEmpty().WithMessage("Ngày bắt đầu hiệu lực không được để trống.");
        RuleFor(x => x.Note).MaximumLength(255).WithMessage("Ghi chú không được vượt quá 255 ký tự.");
    }
}
