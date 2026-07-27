using FluentValidation;
using IPCManagement.Api.Features.Approvals.Contracts;

namespace IPCManagement.Api.Features.Approvals.Validators;

public class ApprovalRequestDtoValidator : AbstractValidator<ApprovalRequest>
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