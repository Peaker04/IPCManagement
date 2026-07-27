using IPCManagement.Api.Features.Reports.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IDataQualityCommandService
{
    Task<DataQualityIssueRemediationDto> UpdateDataQualityIssueRemediationAsync(
        DataQualityIssueRemediationRequest request,
        string actorUserId);

    Task<DataQualityCleanupResultDto> CleanupDataQualityAsync(
        DataQualityCleanupRequest request,
        string actorUserId);
}
