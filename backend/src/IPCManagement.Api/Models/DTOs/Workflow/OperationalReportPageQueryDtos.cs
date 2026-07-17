using IPCManagement.Api.Models.DTOs.Common;

namespace IPCManagement.Api.Models.DTOs.Workflow;

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
