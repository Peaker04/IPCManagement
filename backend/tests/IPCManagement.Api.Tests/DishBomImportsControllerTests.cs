using System.Text;
using System.Reflection;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Controllers;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class DishBomImportsControllerTests
{
    [Fact]
    public async Task LegacyDownload_RestrictsWeeklyMissingTemplateToMrx()
    {
        var templates = Substitute.For<IDishBomTemplateService>();
        var controller = new DishBomImportsController(templates, Substitute.For<IDishBomImportService>(),
            Substitute.For<ICurrentUserService>());
        var query = new BomTemplateQueryDto { TemplateType = " MRX-MISSING " };
        var operation = new SystemOperationRequestContext { Mode = SystemOperationEligibility.Default };
        (await controller.DownloadBomTemplateAsync(query, operation, default)).Should().BeOfType<ConflictObjectResult>();
        await templates.DidNotReceiveWithAnyArgs().BuildAsync(default!, default);
        templates.BuildAsync(query, default).Returns((new byte[] { 1 }, "bom.xlsx"));
        operation.Mode = SystemOperationEligibility.MaterialReconciliation;
        (await controller.DownloadBomTemplateAsync(query, operation, default)).Should().BeOfType<FileContentResult>();
    }

    [Theory]
    [InlineData(typeof(DishBomImportsController), "DownloadMrxBomTemplateAsync")]
    [InlineData(typeof(DishBomImportsController), "PreviewMrxBomImportAsync")]
    [InlineData(typeof(DishBomImportsController), "CommitMrxBomImportAsync")]
    [InlineData(typeof(MrxWeeklyBomCoverageController), "GetAsync")]
    public async Task MrxExcelActions_RequireMrxMode(Type controller, string action)
    {
        await using var database = new IpcManagementContext(new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var mode = new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.Default, Version = 1,
            UpdatedBy = GuidHelper.NewId(), UpdatedAt = DateTime.UtcNow };
        database.Systemoperationmodes.Add(mode);
        await database.SaveChangesAsync();
        var descriptor = new ControllerActionDescriptor
        {
            ControllerName = controller.Name[..^"Controller".Length],
            ActionName = action[..^"Async".Length],
            MethodInfo = controller.GetMethod(action)!,
            ControllerTypeInfo = controller.GetTypeInfo(),
        };
        var actionContext = new ActionContext(new DefaultHttpContext(), new RouteData(), descriptor);
        var request = new SystemOperationRequestContext();
        var filter = new SystemOperationModeFilter(new SystemOperationModeGuard(database), request);
        var execution = new ActionExecutingContext(actionContext, [], new Dictionary<string, object?>(), new object());
        var called = false;
        Task<ActionExecutedContext> Next()
        {
            called = true;
            return Task.FromResult(new ActionExecutedContext(actionContext, [], execution.Controller));
        }

        await filter.OnActionExecutionAsync(execution, Next);
        execution.Result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        called.Should().BeFalse();

        mode.Mode = SystemOperationEligibility.MaterialReconciliation;
        mode.Version++;
        await database.SaveChangesAsync();
        execution.Result = null;
        await filter.OnActionExecutionAsync(execution, Next);
        execution.Result.Should().BeNull();
        called.Should().BeTrue();
        request.Disposition.Should().Be(OperationDisposition.ReconciliationOnly);
    }

    [Fact]
    public async Task PreviewBomImportAsync_Should_MapDomainWorkbookErrorToBadRequest()
    {
        var importService = Substitute.For<IDishBomImportService>();
        importService.PreviewAsync(
                Arg.Any<Stream>(),
                Arg.Any<BomImportPreviewRequestDto>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromException<BomImportPreviewDto>(new BusinessRuleException(
                "File BOM không đọc được. Vui lòng chọn đúng file Excel/CSV theo mẫu BOM rồi thử lại.")));
        var controller = new DishBomImportsController(
            Substitute.For<IDishBomTemplateService>(),
            importService,
            Substitute.For<ICurrentUserService>());
        var bytes = Encoding.UTF8.GetBytes("PK-broken");
        var request = new BomImportPreviewRequestDto
        {
            File = new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "broken.xlsx"),
            PriceTier = 25000m
        };

        var result = await controller.PreviewBomImportAsync(request, CancellationToken.None);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var response = badRequest.Value.Should().BeOfType<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Be(
            "File BOM không đọc được. Vui lòng chọn đúng file Excel/CSV theo mẫu BOM rồi thử lại.");
    }
}
