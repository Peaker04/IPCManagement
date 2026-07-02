using System.Text;
using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Helpers;
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
                Arg.Any<CancellationToken>())
            .Returns(Task.FromException<WeeklyMenuImportResultDto>(new InvalidOperationException("File Excel không có bảng thực đơn tuần hợp lệ.")));

        var controller = new CoordinationController(
            Substitute.For<ICoordinationService>(),
            Substitute.For<ICurrentUserService>(),
            sampleDataImportService);

        var file = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("test")), 0, 4, "file", "menu.xlsx");

        var result = await controller.PreviewWeeklyMenuImport(file, "customer-id", null, CancellationToken.None);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var response = badRequest.Value.Should().BeOfType<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Be("File Excel không có bảng thực đơn tuần hợp lệ.");
    }
}
