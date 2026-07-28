using System.Text;
using FluentAssertions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Controllers;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;

namespace IPCManagement.Api.Tests;

public class CoordinationControllerTests
{
    [Fact]
    public async Task PreviewWeeklyMenuImport_Should_Return_BadRequest_When_Parsing_Fails()
    {
        var sampleDataImportService = Substitute.For<ISampleDataImportService>();
        sampleDataImportService.PreviewWeeklyMenuImportAsync(
                Arg.Any<Stream>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<DateOnly?>(),
                Arg.Any<decimal?>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromException<WeeklyMenuImportResultDto>(new InvalidOperationException("File Excel không có bảng thực đơn tuần hợp lệ.")));

        var controller = new WeeklyMenuImportsController(
            sampleDataImportService,
            Substitute.For<ICurrentUserService>());

        var file = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("test")), 0, 4, "file", "menu.xlsx");

        var result = await controller.PreviewWeeklyMenuImportAsync(file, "customer-id", null, null, CancellationToken.None);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var response = badRequest.Value.Should().BeOfType<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Be("File Excel không có bảng thực đơn tuần hợp lệ.");
    }

    [Fact]
    public async Task CommitWeeklyMenuImport_Should_Return_BadRequest_When_Parsing_Fails()
    {
        var sampleDataImportService = Substitute.For<ISampleDataImportService>();
        sampleDataImportService.CommitWeeklyMenuImportAsync(
                Arg.Any<Stream>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<DateOnly?>(),
                Arg.Any<decimal?>(),
                Arg.Any<string?>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromException<WeeklyMenuImportResultDto>(new InvalidOperationException("File Excel không đọc được. Vui lòng chọn đúng file Excel theo mẫu thực đơn rồi thử lại.")));
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>()).Returns(GuidHelper.ToGuidString(GuidHelper.NewId()));

        var controller = new WeeklyMenuImportsController(
            sampleDataImportService,
            currentUserService);

        var file = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("test")), 0, 4, "file", "broken.xlsx");

        var result = await controller.CommitWeeklyMenuImportAsync(file, "customer-id", null, null, CancellationToken.None);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var response = badRequest.Value.Should().BeOfType<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Be("File Excel không đọc được. Vui lòng chọn đúng file Excel theo mẫu thực đơn rồi thử lại.");
    }

    [Fact]
    public async Task UpdateForecastServings_Should_Return_BadRequest_WhenForecastIsNegative()
    {
        var adjustmentService = Substitute.For<IOrderAdjustmentService>();
        adjustmentService.UpdateForecastServingsAsync(
                Arg.Any<string>(),
                Arg.Any<UpdateForecastServingsRequest>(),
                Arg.Any<string?>())
            .Returns(Task.FromException<AdjustServingsResultDto?>(new ArgumentException("Số suất dự kiến phải lớn hơn hoặc bằng 0.")));
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>()).Returns(GuidHelper.ToGuidString(GuidHelper.NewId()));

        var controller = new CoordinationOrdersController(
            Substitute.For<IOrderPlanService>(),
            adjustmentService,
            Substitute.For<IOrderSignoffService>(),
            currentUserService);

        var result = await controller.UpdateForecastServingsAsync(
            Guid.NewGuid().ToString(),
            new UpdateForecastServingsRequest
            {
                ServingsQuantity = -1,
                Reason = "Nhập sai"
            });

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var response = badRequest.Value.Should().BeOfType<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Be("Số suất dự kiến phải lớn hơn hoặc bằng 0.");
    }
}
