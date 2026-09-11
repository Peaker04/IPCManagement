using System.Text;
using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Controllers;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class DishBomImportsControllerTests
{
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
