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
