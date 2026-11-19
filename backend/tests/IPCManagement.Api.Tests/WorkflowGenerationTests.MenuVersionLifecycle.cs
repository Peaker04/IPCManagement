using FluentAssertions;
using IPCManagement.Api.Exceptions;
using NSubstitute;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Diagnostics;
using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Controllers;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Shared.Contracts;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Fact]
    public async Task MenuScheduleEffectiveRangeAudit_Should_JoinApiWeekTransitionActorAndCorrelation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var firstSchedule = await context.Menuschedules.SingleAsync();
        context.Menuschedules.Add(new MenuSchedule
        {
            MenuScheduleId = GuidHelper.NewId(),
            CustomerId = firstSchedule.CustomerId,
            MenuId = firstSchedule.MenuId,
            ServiceDate = firstSchedule.ServiceDate.AddDays(1),
            WeekStartDate = firstSchedule.WeekStartDate,
            ShiftName = "AFTERNOON",
            MenuPrice = firstSchedule.MenuPrice,
            BomRatePercent = firstSchedule.BomRatePercent,
            Status = "ACTIVE"
        });
        await context.SaveChangesAsync();
        const string correlationId = "menu-range-20260803";
        var currentUser = Substitute.For<ICurrentUserService>();
        currentUser.GetUserId(Arg.Any<ClaimsPrincipal>()).Returns(fixture.UserIdString);
        var controller = new MenuSchedulesController(
            new MenuScheduleService(context, new EfTransactionRunner(context)),
            currentUser)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.TraceIdentifier = correlationId;

        var action = await controller.UpdateMenuScheduleVersionAsync(
            GuidHelper.ToGuidString(firstSchedule.MenuScheduleId),
            new UpdateMenuScheduleVersionRequest
            {
                Status = "SUPERSEDED",
                Reason = "Thay đổi version cho toàn tuần"
            });

        var response = action.Should().BeOfType<OkObjectResult>().Subject.Value
            .Should().BeOfType<ApiResponse<MenuScheduleDto>>().Subject;
        response.Data!.Status.Should().Be("SUPERSEDED");
        (await context.Menuschedules.AsNoTracking().Select(item => item.Status).ToListAsync())
            .Should().AllBeEquivalentTo("SUPERSEDED");
        var rangeAudit = await context.Auditlogs.AsNoTracking().SingleAsync(item =>
            item.EntityName == nameof(MenuVersion) && item.FieldName == "EffectiveRange");
        rangeAudit.OldValue.Should().Be("2026-06-15..2026-06-21|DRAFT");
        rangeAudit.NewValue.Should().Be("2026-06-15..2026-06-21|SUPERSEDED");
        rangeAudit.ChangedBy.Should().Equal(fixture.UserId);
        rangeAudit.CorrelationId.Should().Be(correlationId);
        var scheduleAudits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.EntityName == nameof(MenuSchedule) && item.FieldName == nameof(MenuSchedule.Status))
            .ToListAsync();
        scheduleAudits.Should().HaveCount(2);
        scheduleAudits.Should().OnlyContain(item => item.CorrelationId == correlationId);
    }

    [Fact]
    public async Task MenuVersionRollback_Should_PublishPreviousVersion_AndInvalidateDemand()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using (var schemaContext = fixture.CreateContext())
            await EnsureMrxRevisionSchemaAsync(schemaContext);
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        byte[] customerId;
        byte[] versionOneId;
        byte[] versionTwoId;
        await using (var setupContext = fixture.CreateContext())
        {
            customerId = await setupContext.Customers.Select(item => item.CustomerId).SingleAsync();
            versionOneId = GuidHelper.NewId();
            versionTwoId = GuidHelper.NewId();
            setupContext.Menuversions.AddRange(
                new MenuVersion
                {
                    MenuVersionId = versionOneId,
                    CustomerId = customerId,
                    WeekStartDate = new DateOnly(2026, 6, 15),
                    VersionNo = 1,
                    Status = "SUPERSEDED",
                    SourceImportBatch = "MENU-CUS-20260615-V01",
                    CreatedBy = fixture.UserId,
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    PublishedBy = fixture.UserId,
                    PublishedAt = DateTime.UtcNow.AddHours(-2),
                    UpdatedAt = DateTime.UtcNow.AddHours(-2)
                },
                new MenuVersion
                {
                    MenuVersionId = versionTwoId,
                    CustomerId = customerId,
                    WeekStartDate = new DateOnly(2026, 6, 15),
                    VersionNo = 2,
                    Status = "PUBLISHED",
                    SourceImportBatch = "MENU-CUS-20260615-V02",
                    CreatedBy = fixture.UserId,
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    PublishedBy = fixture.UserId,
                    PublishedAt = DateTime.UtcNow.AddHours(-1),
                    UpdatedAt = DateTime.UtcNow.AddHours(-1)
                });
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest
            {
                ServiceDate = "2026-06-15",
                CustomerId = GuidHelper.ToGuidString(customerId),
                Scope = "FULLDAY"
            },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        await ApproveDemandAsync(context, demand!.MaterialRequestId);
        var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
            fixture.UserIdString);
        purchase.Should().NotBeNull();

        var service = new CoordinationConfigurationTestHarness(context);
        var result = await service.RollbackMenuVersionAsync(
            new RollbackMenuVersionRequest
            {
                CustomerId = GuidHelper.ToGuidString(customerId),
                WeekStartDate = "2026-06-15",
                Reason = "Excel published bị sai món chính"
            },
            fixture.UserIdString);

        result.ActiveVersionNo.Should().Be(1);
        result.RolledBackFromVersionNo.Should().Be(2);
        result.CancelledDemandCount.Should().Be(1);
        result.CancelledPurchaseCount.Should().Be(1);

        var versions = await context.Menuversions.AsNoTracking().ToListAsync();
        versions.Single(item => item.MenuVersionId.SequenceEqual(versionOneId)).Status.Should().Be("PUBLISHED");
        versions.Single(item => item.MenuVersionId.SequenceEqual(versionTwoId)).Status.Should().Be("SUPERSEDED");
        (await context.Materialrequests.AsNoTracking().Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");
        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");

        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.Reason != null && item.Reason.Contains("Excel published bị sai món chính"))
            .Select(item => new { item.BusinessArea, item.FieldName })
            .ToListAsync();
        audits.Should().Contain(item => item.BusinessArea == "MenuVersion" && item.FieldName == "Rollback");
        audits.Should().Contain(item => item.BusinessArea == "Demand" && item.FieldName == nameof(MaterialRequest.Status));
        audits.Should().Contain(item => item.BusinessArea == "Purchase" && item.FieldName == nameof(PurchaseRequest.Status));
    }

}
