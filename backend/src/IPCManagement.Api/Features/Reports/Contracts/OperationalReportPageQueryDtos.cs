
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Contracts;

public sealed class KitchenIssuePageQueryDto : WorkflowReportPageQueryDto
{
}

public sealed class IssueVsReturnPageQueryDto : WorkflowReportPageQueryDto
{
}

public sealed class DataQualityPageQueryDto : WorkflowReportPageQueryDto
{
}

public sealed class DataQualityPageDto : DataQualityReportDto
{
    public PagedResponseDto<DataQualityIssueDto> Page { get; set; } = new();
}
