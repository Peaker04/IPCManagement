using FluentValidation;
using IPCManagement.Api.Models.DTOs.Admin;

namespace IPCManagement.Api.Models.Validators;

public class CreateEmployeeDtoValidator : AbstractValidator<CreateEmployeeDto>
{
    public CreateEmployeeDtoValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Họ và tên không được để trống.")
            .MaximumLength(100).WithMessage("Họ và tên tối đa 100 ký tự.");

        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Tên đăng nhập không được để trống.")
            .MaximumLength(50).WithMessage("Tên đăng nhập tối đa 50 ký tự.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Mật khẩu không được để trống.")
            .MinimumLength(6).WithMessage("Mật khẩu tối thiểu 6 ký tự.");

        RuleFor(x => x.RoleId)
            .NotEmpty().WithMessage("Vui lòng chọn vai trò.");
    }
}

public class UpdateEmployeeDtoValidator : AbstractValidator<UpdateEmployeeDto>
{
    public UpdateEmployeeDtoValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Họ và tên không được để trống.")
            .MaximumLength(100).WithMessage("Họ và tên tối đa 100 ký tự.");

        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Tên đăng nhập không được để trống.")
            .MaximumLength(50).WithMessage("Tên đăng nhập tối đa 50 ký tự.");

        RuleFor(x => x.Password)
            .MinimumLength(6).WithMessage("Mật khẩu tối thiểu 6 ký tự.")
            .When(x => !string.IsNullOrWhiteSpace(x.Password));

        RuleFor(x => x.RoleId)
            .NotEmpty().WithMessage("Vui lòng chọn vai trò.");
    }
}
