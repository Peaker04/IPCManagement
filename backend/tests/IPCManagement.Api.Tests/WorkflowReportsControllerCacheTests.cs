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
        service.GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>())
            .Returns(new DataQualityReportDto { ErrorCount = 6 });
        service.GetOperationalKpisAsync(Arg.Any<int?>())
            .Returns(new OperationalKpiSummaryDto { ShortageCount = 12 });
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = CreateController(service, cache);

        await controller.GetOperationalKpisAsync();
        var second = await controller.GetOperationalKpisAsync();

        await service.Received(1).GetOperationalKpisAsync(6);
        var response = second.Should().BeOfType<OkObjectResult>().Subject;
        response.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task DataQualityPage_RemediationInvalidatesCachedAggregate()
    {
        var service = Substitute.For<IWorkflowReportService>();
        service.GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>())
            .Returns(new DataQualityReportDto { TotalIssues = 6 });
        service.UpdateDataQualityIssueRemediationAsync(Arg.Any<DataQualityIssueRemediationRequestDto>(), "admin-user")
            .Returns(new DataQualityIssueRemediationDto { IssueId = "issue-1" });
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = CreateController(service, cache);
        var query = new DataQualityPageQueryDto { PageNumber = 1, PageSize = 8 };

        await controller.GetDataQualityPageAsync(query);
        await controller.GetDataQualityPageAsync(query);
        await controller.UpdateDataQualityIssueRemediationAsync(new DataQualityIssueRemediationRequestDto
        {
            IssueId = "issue-1",
            Action = "resolve"
        });
        await controller.GetDataQualityPageAsync(query);

        await service.Received(2).GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>());
    }

    [Fact]
    public async Task DataQualityPage_ConcurrentColdRequestsComputeSnapshotOnce()
    {
        var service = Substitute.For<IWorkflowReportService>();
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        service.GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>()).Returns(async _ =>
        {
            started.TrySetResult();
            await release.Task;
            return new DataQualityReportDto { TotalIssues = 6 };
        });
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = CreateController(service, cache);
        var query = new DataQualityPageQueryDto { PageNumber = 1, PageSize = 8 };

        var requests = Enumerable.Range(0, 5)
            .Select(_ => controller.GetDataQualityPageAsync(query))
            .ToArray();
        await started.Task.WaitAsync(TimeSpan.FromSeconds(2));
        release.SetResult();
        await Task.WhenAll(requests);

        await service.Received(1).GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>());
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
