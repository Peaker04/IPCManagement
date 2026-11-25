using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationSourceHistoryTests
{
    [Fact]
    public async Task History_lists_each_request_once_and_keeps_pending_separate_from_applied_revision()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection).Options;
        await using var context = new IpcManagementContext(options);
        var schema = System.Text.RegularExpressions.Regex.Replace(context.Database.GenerateCreateScript(),
            @"enum\([^)]*\)", "TEXT", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        var tableNames = new[] { typeof(Customer), typeof(User), typeof(MenuVersion), typeof(ReconciliationBatch),
            typeof(MenuAmendment), typeof(MenuAmendmentLine), typeof(ReconciliationSourceRevision),
            typeof(ReconciliationSourceDelta), typeof(Ingredient), typeof(Unit) }
            .Select(type => context.Model.FindEntityType(type)!.GetTableName()).ToArray();
        await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
        foreach (var statement in schema.Split(';', StringSplitOptions.RemoveEmptyEntries))
            if (tableNames.Any(name => statement.Contains($"CREATE TABLE \"{name}\"", StringComparison.OrdinalIgnoreCase)))
                await context.Database.ExecuteSqlRawAsync(statement + ";");
        var customerId = GuidHelper.NewId();
        var versionId = GuidHelper.NewId();
        var batchId = GuidHelper.NewId();
        var secondBatchId = GuidHelper.NewId();
        var pendingId = GuidHelper.NewId();
        var appliedId = GuidHelper.NewId();
        var revisionId = GuidHelper.NewId();
        var secondRevisionId = GuidHelper.NewId();
        var standaloneRevisionId = GuidHelper.NewId();
        var actorId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var week = new DateOnly(2027, 1, 18);
        context.Users.Add(new User { UserId = actorId, Username = "mrx-admin", FullName = "MRX Admin", PasswordHash = "test-only", RoleId = GuidHelper.NewId(), IsActive = true, CreatedAt = new DateTime(2027, 1, 18) });
        context.Units.Add(new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Ingredients.Add(new Ingredient { IngredientId = ingredientId, IngredientCode = "ING-GAO", IngredientName = "Gạo", UnitId = unitId, WarehouseId = GuidHelper.NewId(), IsActive = true });
        context.Customers.Add(new Customer { CustomerId = customerId, CustomerCode = "ANV", CustomerName = "AMANN", IsActive = true });
        context.Menuversions.Add(new MenuVersion { MenuVersionId = versionId, CustomerId = customerId, WeekStartDate = week, VersionNo = 1, Status = "ACTIVE" });
        context.Reconciliationbatches.Add(new ReconciliationBatch { BatchId = batchId, MenuVersionId = versionId, QuantityImportBatchId = GuidHelper.NewId(), CreatedBy = actorId, Status = "READY", CreatedAt = new DateTime(2027, 1, 18), Version = 1 });
        context.Reconciliationbatches.Add(new ReconciliationBatch { BatchId = secondBatchId, MenuVersionId = versionId, QuantityImportBatchId = GuidHelper.NewId(), CreatedBy = actorId, Status = "READY", CreatedAt = new DateTime(2027, 1, 18), Version = 1 });
        context.Menuamendments.AddRange(
            new MenuAmendment { MenuAmendmentId = pendingId, CustomerId = customerId, WeekStartDate = week, BaseMenuVersionId = versionId, Status = "PENDING_REVIEW", Reason = "Chờ duyệt", ImpactSnapshotJson = "{\"MaterialImpact\":[{\"ServiceDate\":\"2027-01-19\",\"IngredientCode\":\"ING-GAO\",\"IngredientName\":\"Gạo\",\"UnitName\":\"Kilogram\",\"PreviousQuantity\":2,\"NewQuantity\":3}]}", CreatedBy = actorId, CreatedAt = new DateTime(2027, 1, 20) },
            new MenuAmendment { MenuAmendmentId = appliedId, CustomerId = customerId, WeekStartDate = week, BaseMenuVersionId = versionId, Status = "EXECUTED", Reason = "Đã duyệt", ImpactSnapshotJson = "{}", CreatedBy = actorId, CreatedAt = new DateTime(2027, 1, 19), ReviewedBy = actorId, ReviewedAt = new DateTime(2027, 1, 19, 1, 0, 0) },
            new MenuAmendment { MenuAmendmentId = GuidHelper.NewId(), CustomerId = customerId, WeekStartDate = week, BaseMenuVersionId = versionId, Status = "PENDING_REVIEW", Reason = "DEFAULT không có ảnh hưởng MRX", ImpactSnapshotJson = "{\"MaterialImpact\":[]}", CreatedBy = actorId, CreatedAt = new DateTime(2027, 1, 21) });
        context.Reconciliationsourcerevisions.Add(new ReconciliationSourceRevision { SourceRevisionId = revisionId, MenuAmendmentId = appliedId, BatchId = batchId, PreviousMenuVersionId = versionId, AppliedMenuVersionId = versionId, RevisionNumber = 1, Reason = "Đã duyệt", AppliedBy = actorId, AppliedAt = new DateTime(2027, 1, 19, 2, 0, 0), ApplyMode = "APPROVED" });
        context.Reconciliationsourcerevisions.Add(new ReconciliationSourceRevision { SourceRevisionId = secondRevisionId, MenuAmendmentId = appliedId, BatchId = secondBatchId, PreviousMenuVersionId = versionId, AppliedMenuVersionId = versionId, RevisionNumber = 1, Reason = "Đã duyệt", AppliedBy = actorId, AppliedAt = new DateTime(2027, 1, 19, 2, 0, 1), ApplyMode = "APPROVED" });
        context.Reconciliationsourcerevisions.Add(new ReconciliationSourceRevision { SourceRevisionId = standaloneRevisionId, BatchId = secondBatchId, PreviousMenuVersionId = versionId, AppliedMenuVersionId = versionId, RevisionNumber = 2, Reason = "Nhập lại", AppliedBy = actorId, AppliedAt = new DateTime(2027, 1, 18, 2, 0, 0), ApplyMode = "REIMPORT" });
        context.Reconciliationsourcedeltas.Add(new ReconciliationSourceDelta { SourceDeltaId = GuidHelper.NewId(), SourceRevisionId = revisionId, BatchId = batchId, ServiceDate = new DateOnly(2027, 1, 19), IngredientId = ingredientId, CanonicalUnitId = unitId, PreviousRequiredQuantity = 2, NewRequiredQuantity = 3, DeltaQuantity = 1, WorkKind = "SOURCE_CHANGE", Status = "APPLIED", CreatedAt = new DateTime(2027, 1, 19, 2, 0, 0) });
        context.Reconciliationsourcedeltas.Add(new ReconciliationSourceDelta { SourceDeltaId = GuidHelper.NewId(), SourceRevisionId = secondRevisionId, BatchId = secondBatchId, ServiceDate = new DateOnly(2027, 1, 19), IngredientId = ingredientId, CanonicalUnitId = unitId, PreviousRequiredQuantity = 3, NewRequiredQuantity = 4, DeltaQuantity = 1, WorkKind = "SOURCE_CHANGE", Status = "APPLIED", CreatedAt = new DateTime(2027, 1, 19, 2, 0, 1) });
        await context.SaveChangesAsync();

        Assert.Equal(3, await context.Menuamendments.CountAsync());
        Assert.Equal(2, await context.Reconciliationbatches.CountAsync());
        Assert.Equal(2, await (from batch in context.Reconciliationbatches join version in context.Menuversions on batch.MenuVersionId equals version.MenuVersionId select batch).CountAsync());

        var page = await new ReconciliationSourceHistoryService(context).GetPageAsync(new ReconciliationSourceHistoryPageQuery { CustomerCode = "ANV" });

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(new[] { "PENDING_REVIEW", "APPLIED", "APPLIED" }, page.Items.Select(item => item.Status));
        Assert.Equal($"amendment:{GuidHelper.ToGuidString(appliedId)}", page.Items.ElementAt(1).EventId);
        Assert.Equal(2, page.Items.ElementAt(1).AffectedLineCount);
        var service = new ReconciliationSourceHistoryService(context);
        var pending = await service.GetDetailAsync($"amendment:{GuidHelper.ToGuidString(pendingId)}");
        Assert.NotNull(pending);
        Assert.Equal("PENDING", pending.Event.ApprovalStatus);
        Assert.Equal("REQUEST", pending.Event.ChangeRoute);
        Assert.All(pending.Materials.Items, item => Assert.False(item.IsApplied));
        Assert.Equal("ING-GAO", pending.Materials.Items.Single().IngredientCode);
        var applied = await service.GetDetailAsync($"amendment:{GuidHelper.ToGuidString(appliedId)}");
        Assert.NotNull(applied);
        Assert.Equal("APPROVED", applied.Event.ApprovalStatus);
        Assert.Equal("APPLIED", applied.Event.Status);
        Assert.All(applied.Materials.Items, item => Assert.True(item.IsApplied));
        Assert.Equal(2, applied.Revisions.Count);
        Assert.Equal(2, applied.Materials.TotalCount);
        const int farPage = 1_073_741_825;
        var pastHistory = await service.GetPageAsync(new ReconciliationSourceHistoryPageQuery { PageNumber = farPage, PageSize = 2 });
        var pastApplied = await service.GetDetailAsync(applied.Event.EventId, farPage, 2);
        var pastPending = await service.GetDetailAsync(pending.Event.EventId, farPage, 2);
        Assert.Empty(pastHistory.Items);
        Assert.Equal(3, pastHistory.TotalCount);
        Assert.Empty(pastApplied!.Materials.Items);
        Assert.Equal(2, pastApplied.Materials.TotalCount);
        Assert.Empty(pastPending!.Materials.Items);
        Assert.Equal(1, pastPending.Materials.TotalCount);
        var scoped = await service.GetPageAsync(new ReconciliationSourceHistoryPageQuery { BatchId = GuidHelper.ToGuidString(secondBatchId), PageSize = 1 });
        Assert.Equal(3, scoped.TotalCount);
        Assert.Single(scoped.Items);
        Assert.True(scoped.HasNext);
        var secondPage = await service.GetPageAsync(new ReconciliationSourceHistoryPageQuery { BatchId = GuidHelper.ToGuidString(secondBatchId), PageSize = 1, PageNumber = 2 });
        Assert.Equal($"amendment:{GuidHelper.ToGuidString(appliedId)}", secondPage.Items.Single().EventId);
        var standalone = await service.GetDetailAsync($"revision:{GuidHelper.ToGuidString(standaloneRevisionId)}");
        Assert.NotNull(standalone);
        Assert.Equal("NOT_REQUIRED", standalone.Event.ApprovalStatus);
        Assert.Equal("REIMPORT", standalone.Event.ChangeRoute);
        var byDate = await service.GetPageAsync(new ReconciliationSourceHistoryPageQuery { ServiceDate = new DateOnly(2027, 1, 19) });
        Assert.Equal(2, byDate.TotalCount);
        Assert.Contains(byDate.Items, item => item.EventId == $"amendment:{GuidHelper.ToGuidString(pendingId)}");
        var rejectedId = GuidHelper.NewId();
        var directId = GuidHelper.NewId();
        context.Menuamendments.AddRange(
            new MenuAmendment { MenuAmendmentId = rejectedId, CustomerId = customerId, WeekStartDate = week, BaseMenuVersionId = versionId, Status = "REJECTED", Reason = "Không hợp lệ", ImpactSnapshotJson = "{\"MaterialImpact\":[{\"ServiceDate\":\"2027-01-20\",\"IngredientCode\":\"ING-GAO\",\"IngredientName\":\"Gạo\",\"UnitName\":\"Kilogram\",\"PreviousQuantity\":3,\"NewQuantity\":4}]}", CreatedBy = actorId, CreatedAt = new DateTime(2027, 1, 20), ReviewedBy = actorId, ReviewedAt = new DateTime(2027, 1, 20, 1, 0, 0) },
            new MenuAmendment { MenuAmendmentId = directId, CustomerId = customerId, WeekStartDate = week, BaseMenuVersionId = versionId, Status = "EXECUTED", Reason = "Sửa trực tiếp", ImpactSnapshotJson = "{}", CreatedBy = actorId, CreatedAt = new DateTime(2027, 1, 20), ExecutedBy = actorId, ExecutedAt = new DateTime(2027, 1, 20, 2, 0, 0) });
        context.Reconciliationsourcerevisions.Add(new ReconciliationSourceRevision { SourceRevisionId = GuidHelper.NewId(), MenuAmendmentId = directId, BatchId = batchId, PreviousMenuVersionId = versionId, AppliedMenuVersionId = versionId, RevisionNumber = 3, Reason = "Sửa trực tiếp", AppliedBy = actorId, AppliedAt = new DateTime(2027, 1, 20, 2, 0, 0), ApplyMode = "DIRECT" });
        await context.SaveChangesAsync();
        var updated = await service.GetPageAsync(new ReconciliationSourceHistoryPageQuery());
        Assert.Equal("REJECTED", updated.Items.Single(item => item.EventId == $"amendment:{GuidHelper.ToGuidString(rejectedId)}").ApprovalStatus);
        var direct = updated.Items.Single(item => item.EventId == $"amendment:{GuidHelper.ToGuidString(directId)}");
        Assert.Equal("NOT_REQUIRED", direct.ApprovalStatus);
        Assert.Equal("DIRECT", direct.ChangeRoute);
        context.Menuamendments.Single(item => item.MenuAmendmentId == pendingId).Status = "EXECUTED";
        await context.SaveChangesAsync();
        var executedWithoutRevision = await service.GetPageAsync(new ReconciliationSourceHistoryPageQuery());
        Assert.Equal("EXECUTED", executedWithoutRevision.Items.Single(item => item.EventId == $"amendment:{GuidHelper.ToGuidString(pendingId)}").Status);
        var previewOnly = await service.GetDetailAsync($"amendment:{GuidHelper.ToGuidString(pendingId)}");
        Assert.NotNull(previewOnly);
        Assert.Equal("EXECUTED", previewOnly.Event.Status);
        Assert.Empty(previewOnly.Revisions);
        Assert.All(previewOnly.Materials.Items, item => Assert.False(item.IsApplied));
    }
}
