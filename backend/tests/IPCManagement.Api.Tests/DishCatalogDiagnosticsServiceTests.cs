using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class DishCatalogDiagnosticsServiceTests
{
    [Fact]
    public async Task DishService_DiagnosticsMethods_Should_DelegateToFocusedService()
    {
        var repository = Substitute.For<IDishRepository>();
        var catalogService = Substitute.For<IDishCatalogService>();
        var diagnosticsService = Substitute.For<IDishCatalogDiagnosticsService>();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new DishService(repository, null!, cache, catalogService, diagnosticsService);

        diagnosticsService.GetBomCoverageAsync().Returns(new BomCoverageReportDto());
        diagnosticsService.GetBomValidationAsync().Returns(new BomValidationReportDto());
        diagnosticsService.GetMenuImportHistoryAsync().Returns(new MenuImportHistoryDto());
        diagnosticsService.GetSampleImportStatusAsync().Returns(new SampleImportStatusDto());

        await service.GetBomCoverageAsync();
        await service.GetBomValidationAsync();
        await service.GetMenuImportHistoryAsync();
        await service.GetSampleImportStatusAsync();

        await diagnosticsService.Received(1).GetBomCoverageAsync();
        await diagnosticsService.Received(1).GetBomValidationAsync();
        await diagnosticsService.Received(1).GetMenuImportHistoryAsync();
        await diagnosticsService.Received(1).GetSampleImportStatusAsync();
    }

    [Fact]
    public async Task EmptyCatalog_Should_PreserveImportWarningsAndIncompleteDomainStatuses()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"dish-diagnostics-{Guid.NewGuid():N}")
            .Options;
        await using var context = new IpcManagementContext(options);
        var service = new DishCatalogDiagnosticsService(context);

        var history = await service.GetMenuImportHistoryAsync();
        var status = await service.GetSampleImportStatusAsync();

        history.DishCount.Should().Be(0);
        history.BomCreatedOrUpdatedCount.Should().Be(0);
        history.Warnings.Should().Equal(
            "Chưa tìm thấy batch import định lượng có thông tin source/file.",
            "Chưa có lịch thực đơn được seed/import.",
            "Chưa có dòng BOM nào trong catalog.",
            "Chưa có lịch sử cập nhật BOM; số BOM tạo/cập nhật đang là snapshot dòng hiện tại.");
        status.OverallStatus.Should().Be("incomplete");
        status.Domains.Should().HaveCount(7);
        status.Domains.Should().OnlyContain(domain =>
            !domain.IsReady &&
            domain.RowCount == 0 &&
            domain.Status == "missing" &&
            domain.Notes == "Chưa có dữ liệu hoặc dữ liệu chưa được import/seed.");
    }
}
