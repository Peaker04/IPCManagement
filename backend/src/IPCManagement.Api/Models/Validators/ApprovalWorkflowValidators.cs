using FluentValidation;
using IPCManagement.Api.Models.DTOs.Approvals;

namespace IPCManagement.Api.Models.Validators;

public class ApprovalRequestDtoValidator : AbstractValidator<ApprovalRequestDto>
{
    public ApprovalRequestDtoValidator()
    {
        RuleFor(x => x.Status)
            .IsInEnum();

        RuleFor(x => x.Reason)
            .NotEmpty()
            .When(x => x.Status == ApprovalDecision.Reject)
            .WithMessage("Lý do từ chối không được để trống.");
    }
}