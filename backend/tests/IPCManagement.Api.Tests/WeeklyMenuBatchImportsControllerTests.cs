using System.Text;
using FluentAssertions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class WeeklyMenuBatchImportsControllerTests
{
    [Fact]
    public async Task CommitAsync_Should_RejectAnyWorkbookAboveThePerFileLimit()
    {
        var importService = Substitute.For<IWeeklyMenuImportService>();
        var controller = new WeeklyMenuBatchImportsController(
            importService,
            Substitute.For<ICurrentUserService>());
        var oversized = new FormFile(
            new MemoryStream([1]),
            0,
            XlsxSecurityLimits.MaxUploadBytes + 1,
            "files",
            "oversized.xlsx");

        var result = await controller.CommitAsync(
            [oversized, File("two.xlsx")],
            ["customer-1", "customer-2"],
            ["2026-08-03", "2026-08-03"],
            [25000m, 30000m],
            ["token-1", "token-2"],
            CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
        await importService.DidNotReceiveWithAnyArgs()
            .CommitWeeklyMenuImportBatchAsync(default!, default, default);
    }

    [Fact]
    public async Task CommitAsync_Should_RejectMisalignedMultipartFields()
    {
        var importService = Substitute.For<IWeeklyMenuImportService>();
        var controller = new WeeklyMenuBatchImportsController(
            importService,
            Substitute.For<ICurrentUserService>());

        var result = await controller.CommitAsync(
            [File("one.xlsx"), File("two.xlsx")],
            ["customer-1"],
            ["2026-08-03", "2026-08-03"],
            [25000m, 30000m],
            ["token-1", "token-2"],
            CancellationToken.None);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().BeOfType<ApiResponse>().Which.Message
            .Should().Be("Thông tin batch import không khớp số file. Vui lòng kiểm tra lại toàn bộ file.");
        await importService.DidNotReceiveWithAnyArgs()
            .CommitWeeklyMenuImportBatchAsync(default!, default, default);
    }

    [Fact]
    public async Task CommitAsync_Should_PreservePositionalScopeAndReturnAtomicResults()
    {
        var importService = Substitute.For<IWeeklyMenuImportService>();
        importService.CommitWeeklyMenuImportBatchAsync(
                Arg.Is<IReadOnlyList<WeeklyMenuImportBatchItem>>(items =>
                    items.Count == 2 &&
                    items[0].FileName == "one.xlsx" &&
                    items[0].CustomerId == "customer-1" &&
                    items[0].WeekStartDate == new DateOnly(2026, 8, 3) &&
                    items[0].PriceTierAmount == 25000m &&
                    items[0].PreviewToken == "token-1" &&
                    items[1].FileName == "two.xlsx" &&
                    items[1].CustomerId == "customer-2" &&
                    items[1].PriceTierAmount == 30000m &&
                    items[1].PreviewToken == "token-2"),
                Arg.Any<string?>(),
                Arg.Any<CancellationToken>())
            .Returns([
                new WeeklyMenuImportResultDto { CustomerId = "customer-1", Committed = true },
                new WeeklyMenuImportResultDto { CustomerId = "customer-2", Committed = true }
            ]);
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns(GuidHelper.ToGuidString(GuidHelper.NewId()));
        var controller = new WeeklyMenuBatchImportsController(importService, currentUserService);

        var result = await controller.CommitAsync(
            [File("one.xlsx"), File("two.xlsx")],
            ["customer-1", "customer-2"],
            ["2026-08-03", "2026-08-10"],
            [25000m, 30000m],
            ["token-1", "token-2"],
            CancellationToken.None);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should()
            .BeOfType<ApiResponse<IReadOnlyList<WeeklyMenuImportResultDto>>>().Subject;
        response.Success.Should().BeTrue();
        response.Data.Should().HaveCount(2);
        response.Message.Should().Be("Đã lưu atomic 2 file thực đơn.");
    }

    private static FormFile File(string name)
    {
        var bytes = Encoding.UTF8.GetBytes(name);
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "files", name);
    }
}
