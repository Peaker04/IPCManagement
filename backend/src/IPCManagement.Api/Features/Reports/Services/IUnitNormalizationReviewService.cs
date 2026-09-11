using IPCManagement.Api.Features.Reports.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IUnitNormalizationReviewService
{
    Task<UnitNormalizationReviewDecisionDto> DecideAsync(
        string reviewId,
        UnitNormalizationReviewDecisionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default);
}
