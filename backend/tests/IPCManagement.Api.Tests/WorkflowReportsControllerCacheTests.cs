using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Workflow;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class WorkflowReportsControllerCacheTests
{
    [Fact]
    public async Task OperationalKpis_ReusesShortLivedAggregateCache()
    {
        var service = Substitute.For<IWorkflowReportService>();
        service.GetOperationalKpisAsync().Returns(new OperationalKpiSummaryDto { ShortageCount = 12 });
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = CreateController(service, cache);

        await controller.GetOperationalKpis();
        var second = await controller.GetOperationalKpis();

        await service.Received(1).GetOperationalKpisAsync();
        var response = second.Should().BeOfType<OkObjectResult>().Subject;
        response.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task DataQualityPage_RemediationInvalidatesCachedAggregate()
    {
        var service = Substitute.For<IWorkflowReportService>();
        service.GetDataQualityPageAsync(Arg.Any<DataQualityPageQueryDto>())
            .Returns(new DataQualityPageDto { TotalIssues = 6 });
        service.UpdateDataQualityIssueRemediationAsync(Arg.Any<DataQualityIssueRemediationRequestDto>(), "admin-user")
            .Returns(new DataQualityIssueRemediationDto { IssueId = "issue-1" });
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = CreateController(service, cache);
        var query = new DataQualityPageQueryDto { PageNumber = 1, PageSize = 8 };

        await controller.GetDataQualityPage(query);
        await controller.GetDataQualityPage(query);
        await controller.UpdateDataQualityIssueRemediation(new DataQualityIssueRemediationRequestDto
        {
            IssueId = "issue-1",
            Action = "resolve"
        });
        await controller.GetDataQualityPage(query);

        await service.Received(2).GetDataQualityPageAsync(Arg.Any<DataQualityPageQueryDto>());
    }

    private static WorkflowReportsController CreateController(
        IWorkflowReportService service,
        IMemoryCache cache)
    {
        var currentUser = Substitute.For<ICurrentUserService>();
        currentUser.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>()).Returns("admin-user");
        return new WorkflowReportsController(service, currentUser, cache)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }
}
