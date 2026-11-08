using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class DishCatalogDiagnosticsServiceTests
{
    [Fact]
    public async Task Diagnostics_Should_BeLineageNotApplicable_WithIdenticalOutputAndZeroEffects()
    {
        static async Task<(MenuImportHistoryDto History, SampleImportStatusDto Status, int IssueCount)> ExecuteAsync(bool seedLineage)
        {
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseInMemoryDatabase($"dish-lineage-not-applicable-{Guid.NewGuid():N}")
                .Options;
            await using var context = new IpcManagementContext(options);
            if (seedLineage)
            {
                var actor = GuidHelper.NewId();
                var warehouse = GuidHelper.NewId();
                context.Inventoryissues.AddRange(
                    new InventoryIssue { IssueId = GuidHelper.NewId(), IssueCode = "DEFAULT", IssueDate = new DateOnly(2026, 1, 1), WarehouseId = warehouse, MaterialRequestId = GuidHelper.NewId(), IssuedBy = actor },
                    new InventoryIssue { IssueId = GuidHelper.NewId(), IssueCode = "MATERIAL_RECONCILIATION", IssueDate = new DateOnly(2026, 1, 1), WarehouseId = warehouse, ReconciliationBatchId = GuidHelper.NewId(), IssuedBy = actor },
                    new InventoryIssue { IssueId = GuidHelper.NewId(), IssueCode = "LEGACY_UNCLASSIFIED", IssueDate = new DateOnly(2026, 1, 1), WarehouseId = warehouse, IssuedBy = actor });
                await context.SaveChangesAsync();
            }

            var before = await context.Inventoryissues.AsNoTracking().CountAsync();
            var service = new DishCatalogDiagnosticsService(context);
            var history = await service.GetMenuImportHistoryAsync();
            var status = await service.GetSampleImportStatusAsync();
            context.ChangeTracker.HasChanges().Should().BeFalse();
            var after = await context.Inventoryissues.AsNoTracking().CountAsync();
            after.Should().Be(before);
            return (history, status, after);
        }

        var empty = await ExecuteAsync(seedLineage: false);
        var colliding = await ExecuteAsync(seedLineage: true);

        colliding.History.Should().BeEquivalentTo(empty.History, options => options.Excluding(history => history.GeneratedAt));
        colliding.Status.Should().BeEquivalentTo(empty.Status, options => options.Excluding(status => status.GeneratedAt));
        colliding.IssueCount.Should().Be(3);
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
