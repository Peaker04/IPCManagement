using FluentAssertions;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Controllers;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
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
        var dataQualityService = Substitute.For<IDataQualityReportService>();
        var commandService = Substitute.For<IDataQualityCommandService>();
        var kpiService = Substitute.For<IOperationalKpiReportService>();
        dataQualityService.GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>())
            .Returns(new DataQualityReportDto { ErrorCount = 6 });
        kpiService.GetOperationalKpisAsync(Arg.Any<int?>())
            .Returns(new OperationalKpiSummaryDto { ShortageCount = 12 });
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var aggregateCache = new WorkflowReportAggregateCache(memoryCache);
        var controller = CreateController(dataQualityService, commandService, kpiService, aggregateCache);

        await controller.GetOperationalKpisAsync();
        var second = await controller.GetOperationalKpisAsync();

        await kpiService.Received(1).GetOperationalKpisAsync(6);
        var response = second.Should().BeOfType<OkObjectResult>().Subject;
        response.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task DataQualityPage_RemediationInvalidatesCachedAggregateAcrossControllers()
    {
        var dataQualityService = Substitute.For<IDataQualityReportService>();
        var commandService = Substitute.For<IDataQualityCommandService>();
        var kpiService = Substitute.For<IOperationalKpiReportService>();
        dataQualityService.GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>())
            .Returns(new DataQualityReportDto { TotalIssues = 6 });
        commandService.UpdateDataQualityIssueRemediationAsync(Arg.Any<DataQualityIssueRemediationRequest>(), "admin-user")
            .Returns(new DataQualityIssueRemediationDto { IssueId = "issue-1" });
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var aggregateCache = new WorkflowReportAggregateCache(memoryCache);
        var firstController = CreateController(dataQualityService, commandService, kpiService, aggregateCache);
        var secondController = CreateController(dataQualityService, commandService, kpiService, aggregateCache);
        var query = new DataQualityPageQueryDto { PageNumber = 1, PageSize = 8 };

        await firstController.GetDataQualityPageAsync(query);
        await firstController.GetDataQualityPageAsync(query);
        await secondController.UpdateDataQualityIssueRemediationAsync(new DataQualityIssueRemediationRequest
        {
            IssueId = "issue-1",
            Action = "resolve"
        });
        await firstController.GetDataQualityPageAsync(query);

        await dataQualityService.Received(2).GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>());
    }

    [Fact]
    public async Task DataQualityPage_ConcurrentColdRequestsComputeSnapshotOnce()
    {
        var dataQualityService = Substitute.For<IDataQualityReportService>();
        var commandService = Substitute.For<IDataQualityCommandService>();
        var kpiService = Substitute.For<IOperationalKpiReportService>();
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        dataQualityService.GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>()).Returns(async _ =>
        {
            started.TrySetResult();
            await release.Task;
            return new DataQualityReportDto { TotalIssues = 6 };
        });
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var aggregateCache = new WorkflowReportAggregateCache(memoryCache);
        var controller = CreateController(dataQualityService, commandService, kpiService, aggregateCache);
        var query = new DataQualityPageQueryDto { PageNumber = 1, PageSize = 8 };

        var requests = Enumerable.Range(0, 5)
            .Select(_ => controller.GetDataQualityPageAsync(query))
            .ToArray();
        await started.Task.WaitAsync(TimeSpan.FromSeconds(2));
        release.SetResult();
        await Task.WhenAll(requests);

        await dataQualityService.Received(1).GetDataQualityAsync(Arg.Any<WorkflowReportQueryDto>());
    }

    private static WorkflowReportsController CreateController(
        IDataQualityReportService dataQualityService,
        IDataQualityCommandService commandService,
        IOperationalKpiReportService kpiService,
        IWorkflowReportAggregateCache aggregateCache)
    {
        var currentUser = Substitute.For<ICurrentUserService>();
        currentUser.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>()).Returns("admin-user");
        return new WorkflowReportsController(
            dataQualityService,
            commandService,
            kpiService,
            aggregateCache,
            currentUser)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }
}
