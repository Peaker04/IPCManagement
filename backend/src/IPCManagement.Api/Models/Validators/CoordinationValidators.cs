using FluentValidation;
using IPCManagement.Api.Models.DTOs.Coordination;

namespace IPCManagement.Api.Models.Validators;

public class AdjustServingsRequestDtoValidator : AbstractValidator<AdjustServingsRequestDto>
{
    public AdjustServingsRequestDtoValidator()
    {
        RuleFor(x => x.ServingsQuantity)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Số suất ăn phải lớn hơn hoặc bằng 0.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Lý do điều chỉnh không được để trống.")
            .MaximumLength(500).WithMessage("Lý do điều chỉnh không được vượt quá 500 ký tự.");
    }
}

public class UpdateForecastServingsRequestDtoValidator : AbstractValidator<UpdateForecastServingsRequestDto>
{
    public UpdateForecastServingsRequestDtoValidator()
    {
        RuleFor(x => x.ServingsQuantity)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Số suất ăn phải lớn hơn hoặc bằng 0.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Lý do cập nhật không được để trống.")
            .MaximumLength(500).WithMessage("Lý do cập nhật không được vượt quá 500 ký tự.");
    }
}
