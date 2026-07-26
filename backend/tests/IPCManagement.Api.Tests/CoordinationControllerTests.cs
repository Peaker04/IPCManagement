using System.Text;
using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Models.DTOs.SampleData;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.SampleData;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

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

        var controller = new CoordinationController(
            Substitute.For<ICoordinationService>(),
            Substitute.For<ICurrentUserService>(),
            sampleDataImportService);

        var file = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("test")), 0, 4, "file", "menu.xlsx");

        var result = await controller.PreviewWeeklyMenuImport(file, "customer-id", null, null, CancellationToken.None);

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

        var controller = new CoordinationController(
            Substitute.For<ICoordinationService>(),
            currentUserService,
            sampleDataImportService);

        var file = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("test")), 0, 4, "file", "broken.xlsx");

        var result = await controller.CommitWeeklyMenuImport(file, "customer-id", null, null, CancellationToken.None);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var response = badRequest.Value.Should().BeOfType<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Be("File Excel không đọc được. Vui lòng chọn đúng file Excel theo mẫu thực đơn rồi thử lại.");
    }

    [Fact]
    public async Task UpdateForecastServings_Should_Return_BadRequest_WhenForecastIsNegative()
    {
        var coordinationService = Substitute.For<ICoordinationService>();
        coordinationService.UpdateForecastServingsAsync(
                Arg.Any<string>(),
                Arg.Any<UpdateForecastServingsRequestDto>(),
                Arg.Any<string?>())
            .Returns(Task.FromException<AdjustServingsResultDto?>(new ArgumentException("Số suất dự kiến phải lớn hơn hoặc bằng 0.")));
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>()).Returns(GuidHelper.ToGuidString(GuidHelper.NewId()));

        var controller = new CoordinationController(
            coordinationService,
            currentUserService,
            Substitute.For<ISampleDataImportService>());

        var result = await controller.UpdateForecastServings(
            Guid.NewGuid().ToString(),
            new UpdateForecastServingsRequestDto
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
