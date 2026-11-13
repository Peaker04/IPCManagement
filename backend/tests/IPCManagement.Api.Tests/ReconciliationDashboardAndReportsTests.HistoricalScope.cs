using FluentAssertions;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed partial class ReconciliationDashboardAndReportsTests
{
    [Fact]
    public async Task Completed_history_filters_before_count_paging_and_full_export()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);
        for (var year = 2023; year <= 2025; year++)
        {
            var version = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = fixture.CustomerId,
                WeekStartDate = new DateOnly(year, 11, 20), VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            context.Menuversions.Add(version);
            context.Reconciliationbatches.Add(new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = version.MenuVersionId,
                QuantityImportBatchId = GuidHelper.NewId(), Status = "COMPLETED", Version = 1, CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-2), CompletedAt = DateTime.UtcNow.AddMinutes(-1), CompletedBy = fixture.UserId });
        }
        await context.SaveChangesAsync();
        var request = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation };
        var service = new ReconciliationReportsService(context, new ReconciliationBatchService(context, new ImmediateTransactionRunner(), request), request);
        var scope = new MrxHistoricalScopeQuery { CustomerId = GuidHelper.ToGuidString(fixture.CustomerId), WeekFrom = new(2024, 1, 1), WeekTo = new(2025, 12, 31) };
        var first = await service.GetCompletedRegisterAsync(new PagedRequestDto { PageSize = 1 }, scope);
        var second = await service.GetCompletedRegisterAsync(new PagedRequestDto { PageSize = 1, PageNumber = 2 }, scope);
        first.TotalCount.Should().Be(2);
        first.Rows.Should().HaveCount(1);
        second.Rows.Single().BatchId.Should().NotBe(first.Rows.Single().BatchId);
        var exported = await CollectAsync(service.StreamCompletedRegisterExportAsync(scope));
        exported.Select(row => row.BatchId).Should().BeEquivalentTo(first.Rows.Concat(second.Rows).Select(row => row.BatchId));
        scope.CustomerId = GuidHelper.ToGuidString(GuidHelper.NewId());
        (await service.GetCompletedRegisterAsync(new(), scope)).TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Source_history_pages_and_searches_relational_history_beyond_first_page()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);
        var versionId = GuidHelper.NewId();
        context.Menuversions.Add(new MenuVersion { MenuVersionId = versionId, CustomerId = fixture.CustomerId, WeekStartDate = new(2024, 11, 18),
            VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        var batch = new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = versionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "IN_PROGRESS", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow };
        context.Reconciliationbatches.Add(batch);
        var now = DateTime.UtcNow;
        for (var index = 0; index < 105; index++) context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedBy = fixture.UserId,
            ChangedAt = now.AddMinutes(-index), BusinessArea = "Coordination", EntityName = nameof(MenuVersion), EntityId = versionId,
            FieldName = "Status", OldValue = "DRAFT", NewValue = "PUBLISHED", Reason = index == 104 ? "Older searchable item" : "Source publication" });
        await context.SaveChangesAsync();
        var request = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation };
        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), request);
        var id = GuidHelper.ToGuidString(batch.BatchId);
        var first = await service.GetSourceChangesPageAsync(id, new() { PageSize = 50 });
        var third = await service.GetSourceChangesPageAsync(id, new() { PageSize = 50, PageNumber = 3 });
        first.TotalCount.Should().Be(105);
        first.Items.Should().HaveCount(50);
        third.Items.Should().HaveCount(5).And.Contain(row => row.Reason == "Older searchable item");
        var search = await service.GetSourceChangesPageAsync(id, new() { SearchKeyword = "Older searchable" });
        search.TotalCount.Should().Be(1);
        search.Items.Single().Reason.Should().Be("Older searchable item");
        var labels = await service.GetSourceChangesPageAsync(id, new() { SearchKeyword = "phiên bản thực đơn" });
        labels.TotalCount.Should().Be(105);
    }
}
