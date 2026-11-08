using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

/// <summary>
/// MXE-03 red oracle. These assertions describe the public filter contract and intentionally
/// remain red until MXE-04 applies every filter to every synthesized audit source before merge/page.
/// </summary>
public partial class WorkflowGenerationTests
{
    [Fact]
    [Trait("MXE", "MXE-03-RED")]
    public async Task Audit_filters_should_apply_to_stored_and_every_synthesized_source_before_merge()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await SeedEveryAuditSourceAsync(context, fixture);

        var service = new AuditReportService(context);
        var unfiltered = await service.GetAuditChangesAsync(new WorkflowReportQueryDto { Limit = 100 });
        unfiltered.Select(row => row.BusinessArea).Should().Contain(
            ["Admin", "Import", "Approval", "Receipt", "Issue", "Số suất", "BOM"],
            "the red fixture must exercise the stored source and all seven synthesized source branches");
        unfiltered.Should().Contain(row => row.EntityName == nameof(MenuVersion) && row.FieldName == "WeeklyMenu");
        unfiltered.Should().Contain(row => row.EntityName == nameof(QuantityImportBatch));

        var filtered = await service.GetAuditChangesAsync(new WorkflowReportQueryDto
        {
            EntityName = nameof(User),
            FieldName = nameof(User.PasswordHash),
            Limit = 100
        });

        filtered.Should().ContainSingle(
            "combined entity+field filtering must remove every synthesized row before the merged result is paged");
        filtered.Should().OnlyContain(row =>
            row.BusinessArea == "Admin" &&
            row.EntityName == nameof(User) &&
            row.FieldName == nameof(User.PasswordHash));
    }

    [Theory]
    [Trait("MXE", "MXE-03-RED")]
    [InlineData("actor")]
    [InlineData("businessArea")]
    [InlineData("entityName")]
    [InlineData("fieldName")]
    public async Task Audit_negative_filters_should_return_zero_across_merged_sources(string filter)
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await SeedEveryAuditSourceAsync(context, fixture);

        var query = new WorkflowReportQueryDto { Limit = 100 };
        const string noMatch = "MXE03-NO-MATCH";
        switch (filter)
        {
            case "actor": query.Actor = noMatch; break;
            case "businessArea": query.BusinessArea = noMatch; break;
            case "entityName": query.EntityName = noMatch; break;
            case "fieldName": query.FieldName = noMatch; break;
        }

        var rows = await new AuditReportService(context).GetAuditChangesAsync(query);

        rows.Should().BeEmpty($"{filter} must constrain stored and synthesized audit rows alike");
    }

    [Theory]
    [Trait("MXE", "MXE-04")]
    [InlineData("Import", "QuantityImportBatch")]
    [InlineData("Import", "MenuVersion")]
    [InlineData("Approval", null)]
    [InlineData("Receipt", "InventoryReceipt")]
    [InlineData("Issue", "InventoryIssue")]
    [InlineData("Số suất", "MealQuantityPlanLine")]
    [InlineData("BOM", null)]
    public async Task Audit_positive_filters_should_keep_representative_synthesized_rows(string businessArea, string? entityName)
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await SeedEveryAuditSourceAsync(context, fixture);

        var rows = await new AuditReportService(context).GetAuditChangesAsync(new WorkflowReportQueryDto
        {
            Actor = "Workflow Test",
            BusinessArea = businessArea,
            EntityName = entityName,
            Limit = 100
        });

        rows.Should().NotBeEmpty();
        rows.Should().OnlyContain(row =>
            row.BusinessArea.Contains(businessArea, StringComparison.OrdinalIgnoreCase) &&
            (entityName == null || row.EntityName.Contains(entityName, StringComparison.OrdinalIgnoreCase)) &&
            row.ChangedByName!.Contains("Workflow Test", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    [Trait("MXE", "MXE-04")]
    public async Task Audit_actor_filter_should_match_the_presented_importer_fallback()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        context.Menuversions.Add(new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = fixture.CustomerId,
            WeekStartDate = new DateOnly(2026, 7, 6),
            VersionNo = 1,
            Status = "DRAFT",
            SourceFileName = "MXE04-fallback.xlsx",
            SourceImportBatch = "MXE04-FALLBACK",
            CreatedBy = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var rows = await new AuditReportService(context).GetAuditChangesAsync(new WorkflowReportQueryDto
        {
            Actor = "Sample Data Importer",
            BusinessArea = "Import",
            EntityName = nameof(MenuVersion),
            Limit = 100
        });

        rows.Should().ContainSingle(row => row.NewValue!.Contains("MXE04-FALLBACK"));
        rows.Should().OnlyContain(row => row.ChangedByName == "Sample Data Importer");
    }

    [Fact]
    [Trait("MXE", "MXE-04")]
    public async Task Audit_business_area_filter_should_use_the_presented_signoff_area()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = fixture.UserId,
            BusinessArea = "Coordination",
            EntityName = nameof(MealQuantityPlan),
            FieldName = nameof(MealQuantityPlan.Status),
            OldValue = "FORECASTED",
            NewValue = "COMPLETED"
        });
        await context.SaveChangesAsync();
        var service = new AuditReportService(context);

        var signoff = await service.GetAuditChangesAsync(new WorkflowReportQueryDto { BusinessArea = "Signoff", Limit = 100 });
        var coordination = await service.GetAuditChangesAsync(new WorkflowReportQueryDto { BusinessArea = "Coordination", Limit = 100 });

        signoff.Should().ContainSingle(row => row.EntityName == nameof(MealQuantityPlan) && row.BusinessArea == "Signoff");
        coordination.Should().NotContain(row => row.EntityName == nameof(MealQuantityPlan) && row.BusinessArea == "Signoff");
    }

    [Fact]
    [Trait("MXE", "MXE-04")]
    public async Task Audit_list_page_and_csv_should_share_the_exact_filtered_row_set()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await SeedEveryAuditSourceAsync(context, fixture);
        var service = new AuditReportService(context);
        var query = new WorkflowReportQueryDto
        {
            EntityName = nameof(User),
            FieldName = nameof(User.PasswordHash),
            Limit = 100
        };

        var list = await service.GetAuditChangesAsync(query);
        var page = await service.GetAuditChangePageAsync(new WorkflowReportQueryDto
        {
            EntityName = query.EntityName,
            FieldName = query.FieldName,
            Limit = 8
        });
        var csv = System.Text.Encoding.UTF8.GetString((await service.ExportAuditChangesCsvAsync(new WorkflowReportQueryDto
        {
            EntityName = query.EntityName,
            FieldName = query.FieldName
        })).Content);

        list.Should().ContainSingle();
        page.Items.Select(row => row.AuditId).Should().Equal(list.Select(row => row.AuditId));
        csv.Should().Contain(list.Single().AuditId);
        csv.Should().NotContain("InventoryIssue");
        csv.Should().NotContain("QuantityImportBatch");
    }

    [Fact]
    [Trait("MXE", "MXE-04")]
    public async Task Audit_cursor_should_preserve_tied_timestamp_identity_without_duplicates_or_omissions()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var timestamp = new DateTime(2026, 9, 5, 8, 0, 0, DateTimeKind.Utc);
        for (var index = 0; index < 5; index++)
        {
            context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = timestamp,
                ChangedBy = fixture.UserId,
                BusinessArea = "MXE04-TIE",
                EntityName = "CursorProbe",
                FieldName = $"Row-{index}",
                NewValue = index.ToString()
            });
        }
        await context.SaveChangesAsync();
        var service = new AuditReportService(context);
        var baseQuery = new WorkflowReportQueryDto { BusinessArea = "MXE04-TIE", Limit = 2 };
        var expected = await service.GetAuditChangesAsync(new WorkflowReportQueryDto { BusinessArea = "MXE04-TIE", Limit = 100 });
        var first = await service.GetAuditChangePageAsync(baseQuery);
        var second = await service.GetAuditChangePageAsync(new WorkflowReportQueryDto
        {
            BusinessArea = "MXE04-TIE", Limit = 2, CursorDate = first.NextCursorDate,
            CursorId = first.NextCursorId, CursorOffset = first.NextCursorOffset
        });
        var third = await service.GetAuditChangePageAsync(new WorkflowReportQueryDto
        {
            BusinessArea = "MXE04-TIE", Limit = 2, CursorDate = second.NextCursorDate,
            CursorId = second.NextCursorId, CursorOffset = second.NextCursorOffset
        });
        var firstAgain = await service.GetAuditChangePageAsync(baseQuery);
        var pagedIds = first.Items.Concat(second.Items).Concat(third.Items).Select(row => row.AuditId).ToList();

        pagedIds.Should().Equal(expected.Select(row => row.AuditId));
        pagedIds.Should().OnlyHaveUniqueItems();
        firstAgain.Items.Select(row => row.AuditId).Should().Equal(first.Items.Select(row => row.AuditId));
        second.Items.Should().HaveCount(2);
        third.Items.Should().ContainSingle();
    }

    [Fact]
    [Trait("MXE", "MXE-03")]
    public async Task Audit_date_filter_already_constrains_every_merged_source()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await SeedEveryAuditSourceAsync(context, fixture);

        var rows = await new AuditReportService(context).GetAuditChangesAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2099-01-01",
            DateTo = "2099-01-02",
            Limit = 100
        });

        rows.Should().BeEmpty("date boundaries are already applied independently to all eight source queries");
    }

    private static async Task SeedEveryAuditSourceAsync(IpcManagementContext context, WorkflowFixture fixture)
    {
        await SeedReportDocumentsAsync(context, fixture);
        var now = DateTime.UtcNow;
        var quantityLineId = await context.Mealquantityplanlines.Select(row => row.QuantityPlanLineId).SingleAsync();
        var bomId = await context.Dishboms.Select(row => row.BomId).SingleAsync();

        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = now,
            ChangedBy = fixture.UserId,
            BusinessArea = "Admin",
            EntityName = nameof(User),
            EntityId = fixture.UserId,
            FieldName = nameof(User.PasswordHash),
            OldValue = "[HIDDEN]",
            NewValue = "[CHANGED]",
            Reason = "Synthetic password-change marker without credentials"
        });
        context.Menuversions.Add(new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = fixture.CustomerId,
            WeekStartDate = new DateOnly(2026, 6, 15),
            VersionNo = 2,
            Status = "DRAFT",
            SourceFileName = "MXE03-menu.xlsx",
            SourceChecksum = "MXE03-checksum-marker",
            SourceImportBatch = "MXE03-MENU",
            CreatedBy = fixture.UserId,
            CreatedAt = now.AddMinutes(-2),
            UpdatedAt = now.AddMinutes(-2)
        });
        context.Quantityadjustments.Add(new QuantityAdjustment
        {
            AdjustmentId = GuidHelper.NewId(),
            QuantityPlanLineId = quantityLineId,
            OldServings = 100,
            NewServings = 101,
            Reason = "MXE03 fixture",
            AdjustedBy = fixture.UserId,
            AdjustedAt = now.AddMinutes(-1)
        });
        context.Bomadjustments.Add(new BomAdjustment
        {
            BomAdjustmentId = GuidHelper.NewId(),
            BomId = bomId,
            OldGrossQtyPerServing = 1,
            NewGrossQtyPerServing = 2,
            OldWasteRatePercent = 0,
            NewWasteRatePercent = 1,
            Reason = "MXE03 fixture",
            AdjustedBy = fixture.UserId,
            AdjustedAt = now.AddMinutes(-1)
        });
        await context.SaveChangesAsync();
    }
}
