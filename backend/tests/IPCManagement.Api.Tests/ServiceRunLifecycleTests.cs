using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Metadata;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;
using System.Data.Common;
using System.Text.Json;

namespace IPCManagement.Api.Tests;

public sealed class ServiceRunLifecycleTests
{
    [Fact]
    public void ServiceRun_Should_UseOneExecutionScopePerCustomerDateShiftAndTier()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"service-run-model-{Guid.NewGuid():N}")
            .Options;
        using var context = new IpcManagementContext(options);

        var entityType = context.Model.FindEntityType(typeof(ServiceRun));
        entityType.Should().NotBeNull();
        entityType!.FindProperty(nameof(ServiceRun.CloseSnapshotJson)).Should().NotBeNull();
        entityType.FindProperty(nameof(ServiceRun.CustomerId)).Should().NotBeNull();
        entityType.FindProperty(nameof(ServiceRun.ServiceDate)).Should().NotBeNull();
        entityType.FindProperty(nameof(ServiceRun.PriceTierAmount)).Should().NotBeNull();
        entityType.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual(new[]
                {
                    nameof(ServiceRun.CustomerId),
                    nameof(ServiceRun.ServiceDate),
                    nameof(ServiceRun.ShiftName),
                    nameof(ServiceRun.PriceTierAmount),
                }));

        context.Model.FindEntityType(typeof(ServiceRunSourceLine)).Should().NotBeNull();
    }

    [Fact]
    public void ScopedProjection_Should_ExposeRequiredScopeFourTracksAndServerOwnedActions()
    {
        var projection = new ServiceRunLifecycleProjectionDto();

        projection.CustomerId.Should().NotBeNull();
        projection.PriceTierAmount.Should().BeGreaterThanOrEqualTo(0m);
        projection.CurrentVersion.Should().BeGreaterThanOrEqualTo(0);
        projection.Tracks.Should().HaveCount(4);
        projection.AllowedActions.Should().NotBeNull();
        projection.CloseSnapshot.Should().NotBeNull();
        projection.CorrectionOverlay.Should().NotBeNull();
    }

    [Fact]
    public async Task OpenAndVarianceCommands_Should_BeIdempotent_AndRecordCompleteLifecycleEvidence()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"service-run-open-{Guid.NewGuid():N}")
            .Options;
        var actorId = GuidHelper.NewId();
        var planId = GuidHelper.NewId();
        var customerId = GuidHelper.NewId();
        var quantityPlanId = GuidHelper.NewId();
        var quantityPlanLineId = GuidHelper.NewId();
        var scheduleId = GuidHelper.NewId();
        var requestId = GuidHelper.NewId();
        var requestLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        await using (var context = new IpcManagementContext(options))
        {
            var quantityPlan = new MealQuantityPlan
            {
                QuantityPlanId = quantityPlanId, PlanCode = "QTY-SERVICE-RUN", ServiceDate = new DateOnly(2026, 8, 5),
                Status = "COMPLETED", ConfirmationTime = TimeOnly.MinValue,
            };
            var schedule = new MenuSchedule
            {
                MenuScheduleId = scheduleId, CustomerId = customerId, MenuId = GuidHelper.NewId(), ServiceDate = new DateOnly(2026, 8, 5),
                WeekStartDate = new DateOnly(2026, 8, 3), ShiftName = "MORNING", MenuPrice = 25000m, BomRatePercent = 100m, Status = "ACTIVE",
            };
            var quantityPlanLine = new MealQuantityPlanLine
            {
                QuantityPlanLineId = quantityPlanLineId, QuantityPlanId = quantityPlanId, MenuScheduleId = scheduleId,
                CustomerId = schedule.CustomerId, MenuId = schedule.MenuId, ShiftName = "MORNING", FinalServings = 120,
                QuantityPlan = quantityPlan, MenuSchedule = schedule,
            };
            context.AddRange(quantityPlan, schedule, quantityPlanLine);
            var productionPlanLine = new ProductionPlanLine
            {
                PlanLineId = GuidHelper.NewId(), PlanId = planId, QuantityPlanLineId = quantityPlanLineId,
                CustomerId = schedule.CustomerId, MenuId = schedule.MenuId, DishId = GuidHelper.NewId(), ShiftName = "MORNING", TotalServings = 120,
                QuantityPlanLine = quantityPlanLine,
            };
            context.Productionplans.Add(new ProductionPlan
            {
                PlanId = planId, PlanCode = "KHSX-SERVICE-RUN", PlanDate = new DateOnly(2026, 8, 5), Status = "CREATED",
                CreatedBy = actorId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, SentToKitchenAt = DateTime.UtcNow, SentToKitchenBy = actorId,
                Productionplanlines = [productionPlanLine],
            });
            context.Materialrequests.Add(new MaterialRequest
            {
                RequestId = requestId, PlanId = planId, RequestCode = "YC-SERVICE-RUN", RequestDate = new DateOnly(2026, 8, 5),
                RequestScope = "SERVICE_RUN", Status = "PENDING", CreatedBy = actorId,
                Materialrequestlines =
                [
                    new MaterialRequestLine
                    {
                        RequestLineId = requestLineId, RequestId = requestId, PlanLineId = productionPlanLine.PlanLineId,
                        IngredientId = ingredientId, UnitId = unitId, PriceTierAmount = 25000m,
                        TotalServings = 120, GrossQtyPerServing = 1m, BomRatePercent = 100m, TotalRequiredQty = 120m,
                        PlanLine = productionPlanLine,
                    },
                ],
            });
            var defaultIssueId = GuidHelper.NewId();
            var reconciliationIssueId = GuidHelper.NewId();
            var legacyIssueId = GuidHelper.NewId();
            context.Inventoryissues.AddRange(
                new InventoryIssue { IssueId = defaultIssueId, IssueCode = "ISS-SERVICE-DEFAULT", IssueDate = new DateOnly(2026, 8, 5), WarehouseId = GuidHelper.NewId(), MaterialRequestId = requestId, ShiftName = "MORNING", IssuedBy = actorId, CreatedAt = DateTime.UtcNow,
                    Inventoryissuelines = [new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IssueId = defaultIssueId, MaterialRequestLineId = requestLineId, IngredientId = ingredientId, UnitId = unitId, RequestedQty = 120, IssuedQty = 120 }] },
                new InventoryIssue { IssueId = reconciliationIssueId, IssueCode = "ISS-SERVICE-RECON", IssueDate = new DateOnly(2026, 8, 5), WarehouseId = GuidHelper.NewId(), MaterialRequestId = requestId, ReconciliationBatchId = GuidHelper.NewId(), ShiftName = "MORNING", IssuedBy = actorId, CreatedAt = DateTime.UtcNow,
                    Inventoryissuelines = [new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IssueId = reconciliationIssueId, ReconciliationBatchLineId = GuidHelper.NewId(), IngredientId = ingredientId, UnitId = unitId, RequestedQty = 999, IssuedQty = 999 }] },
                new InventoryIssue { IssueId = legacyIssueId, IssueCode = "ISS-SERVICE-LEGACY", IssueDate = new DateOnly(2026, 8, 5), WarehouseId = GuidHelper.NewId(), MaterialRequestId = requestId, ReconciliationBatchId = GuidHelper.NewId(), ShiftName = "MORNING", IssuedBy = actorId, CreatedAt = DateTime.UtcNow,
                    Inventoryissuelines = [new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IssueId = legacyIssueId, IngredientId = ingredientId, UnitId = unitId, RequestedQty = 777, IssuedQty = 777 }] });
            await context.SaveChangesAsync();
        }

        await using var verificationContext = new IpcManagementContext(options);
        var service = new ServiceRunService(verificationContext);
        var first = await service.OpenAsync(new OpenServiceRunRequest { PlanId = GuidHelper.ToGuidString(planId), ShiftName = "MORNING", CustomerId = GuidHelper.ToGuidString(customerId), PriceTierAmount = 25000m }, GuidHelper.ToGuidString(actorId));
        var second = await service.OpenAsync(new OpenServiceRunRequest { PlanId = GuidHelper.ToGuidString(planId), ShiftName = "MORNING", CustomerId = GuidHelper.ToGuidString(customerId), PriceTierAmount = 25000m }, GuidHelper.ToGuidString(actorId));

        first.Should().NotBeNull();
        first!.Blockers.Should().Contain(ServiceRunBlocker.DemandNotGenerated);
        second!.ServiceRunId.Should().Be(first.ServiceRunId);
        first.IssueCount.Should().Be(0, "non-DEFAULT collision rows must not leak into the public projection");
        first.UnreceivedIssueCount.Should().Be(0);
        var page = await service.GetPageAsync(new ServiceRunPageQuery { AllCustomers = true, ServiceDate = new DateOnly(2026, 8, 5), PageNumber = 1, PageSize = 20 });
        page.Items.SelectMany(item => item.IssueCodes).Should().NotContain(["ISS-SERVICE-RECON", "ISS-SERVICE-LEGACY"]);
        page.Items.SelectMany(item => item.IssueLineIds).Should().BeEmpty();
        (await verificationContext.Inventoryissues.AsNoTracking().CountAsync()).Should().Be(3);
        verificationContext.Serviceruns.Should().ContainSingle();
        verificationContext.Servicerunsourcelines.Should().ContainSingle();
        verificationContext.Lifecycletransitions.Should().ContainSingle(item => item.AggregateType == nameof(ServiceRun) && item.ToState == ServiceRunStatus.Planned);
        verificationContext.Lifecyclecommandreceipts.Should().ContainSingle();
        verificationContext.Lifecycleoutboxmessages.Should().ContainSingle();

        var declarationRequest = new DeclareServiceRunVarianceRequest
        {
            CommandId = "service-run-variance-declare-1",
            ExpectedVersion = first.CurrentVersion,
            Track = "SERVICE_EXECUTION",
            SourceLineIds = [GuidHelper.ToGuidString(requestLineId)],
            Reason = "Bếp ghi nhận chênh lệch đúng dòng nguyên liệu nguồn.",
        };
        var declared = await service.DeclareVarianceAsync(first.ServiceRunId, declarationRequest, GuidHelper.ToGuidString(actorId));
        var declarationId = GuidHelper.ToGuidString(verificationContext.Servicerunvariancedeclarations.Single().ServiceRunVarianceDeclarationId);
        var replayedDeclaration = await service.DeclareVarianceAsync(first.ServiceRunId, declarationRequest, GuidHelper.ToGuidString(actorId));

        replayedDeclaration!.CurrentVersion.Should().Be(declared!.CurrentVersion);
        verificationContext.Servicerunvariancedeclarations.Should().ContainSingle();
        verificationContext.Lifecycletransitions.Should().HaveCount(2);
        verificationContext.Lifecyclecommandreceipts.Should().HaveCount(2);
        verificationContext.Lifecycleoutboxmessages.Should().HaveCount(2);
        verificationContext.Auditlogs.Should().HaveCount(2);

        var waiverActorId = GuidHelper.NewId();
        var waiverRequest = new ApproveServiceRunVarianceWaiverRequest
        {
            CommandId = "service-run-variance-waiver-1",
            ExpectedVersion = declared.CurrentVersion,
            Reason = "Admin khác người khai báo đã kiểm tra bằng chứng nguồn.",
        };
        var waived = await service.ApproveVarianceWaiverAsync(first.ServiceRunId, declarationId, waiverRequest, GuidHelper.ToGuidString(waiverActorId));
        var replayedWaiver = await service.ApproveVarianceWaiverAsync(first.ServiceRunId, declarationId, waiverRequest, GuidHelper.ToGuidString(waiverActorId));

        replayedWaiver!.CurrentVersion.Should().Be(waived!.CurrentVersion);
        verificationContext.Servicerunvariancewaivers.Should().ContainSingle();
        verificationContext.Lifecycletransitions.Should().HaveCount(3);
        verificationContext.Lifecyclecommandreceipts.Should().HaveCount(3);
        verificationContext.Lifecycleoutboxmessages.Should().HaveCount(3);
        verificationContext.Auditlogs.Should().HaveCount(3);
    }

    [Fact]
    public void ScopedDemandSelection_Should_NotLeakSiblingCustomerOrTierLines()
    {
        var sourceA = GuidHelper.NewId();
        var sourceB = GuidHelper.NewId();
        var demandA = new MaterialRequestLine { RequestLineId = sourceA, TotalRequiredQty = 10m, TotalServings = 100 };
        var demandB = new MaterialRequestLine { RequestLineId = sourceB, TotalRequiredQty = 999m, TotalServings = 999 };

        var scoped = ServiceRunService.SelectScopedDemandLines([demandA, demandB], [sourceA]);

        scoped.Should().ContainSingle().Which.Should().BeSameAs(demandA);
        scoped.Should().NotContain(demandB);
    }

    [Fact]
    public async Task ServiceRunPage_SelectCount_Should_NotGrowFromOneToTwentyRows()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var counter = new SelectCommandCounter();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .AddInterceptors(counter)
            .Options;
        await using var context = new SqliteServiceRunContext(options);
        await context.Database.EnsureCreatedAsync();
        await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
        var actorId = GuidHelper.NewId();
        var now = DateTime.UtcNow;
        byte[]? latestRunId = null;
        for (var index = 0; index < 20; index++)
        {
            var planId = GuidHelper.NewId();
            context.Productionplans.Add(new ProductionPlan
            {
                PlanId = planId,
                PlanCode = $"KHSX-PERF-{index:00}",
                PlanDate = new DateOnly(2026, 8, 5),
                Status = "CREATED",
                CreatedBy = actorId,
                CreatedAt = now,
                UpdatedAt = now.AddMinutes(index),
            });
            latestRunId = GuidHelper.NewId();
            context.Serviceruns.Add(new ServiceRun
            {
                ServiceRunId = latestRunId,
                PlanId = planId,
                CustomerId = GuidHelper.NewId(),
                ServiceDate = new DateOnly(2026, 8, 5),
                ShiftName = "MORNING",
                PriceTierAmount = 25000m,
                OpenedBy = actorId,
                CreatedAt = now,
                UpdatedAt = now.AddMinutes(index),
            });
        }
        context.Users.Add(new User
        {
            UserId = actorId,
            RoleId = GuidHelper.NewId(),
            Username = "service-run-perf",
            FullName = "Service Run Performance",
            PasswordHash = "test-only",
            IsActive = true,
            CreatedAt = now,
        });
        context.Servicerunvariancedeclarations.Add(new ServiceRunVarianceDeclaration
        {
            ServiceRunVarianceDeclarationId = GuidHelper.NewId(),
            ServiceRunId = latestRunId!,
            Track = "SERVICE_EXECUTION",
            SourceLineEvidenceJson = "[]",
            Reason = "Exercise the fixed declaration and waiver query phases.",
            DeclaredBy = actorId,
            DeclaredAt = now.AddMinutes(20),
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = new ServiceRunService(context);

        counter.Reset();
        var oneRow = await service.GetPageAsync(new ServiceRunPageQuery { AllCustomers = true, PageNumber = 1, PageSize = 1 });
        var oneRowSelectCount = counter.SelectCount;
        counter.Reset();
        var twentyRows = await service.GetPageAsync(new ServiceRunPageQuery { AllCustomers = true, PageNumber = 1, PageSize = 20 });
        var twentyRowSelectCount = counter.SelectCount;

        oneRow.Items.Should().HaveCount(1);
        twentyRows.Items.Should().HaveCount(20);
        twentyRowSelectCount.Should().Be(oneRowSelectCount);
        twentyRowSelectCount.Should().BeGreaterThan(10, "the fixture must execute the fixed batch phases, not pass through an empty fast path");
        twentyRowSelectCount.Should().BeLessThanOrEqualTo(18);
        counter.Commands.Should().Contain(command => command.Contains("LIMIT", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task StatusFilteredServiceRunPage_Should_PreserveCanonicalMembershipCountOrderAndHydrateOnlyPagePlans()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var counter = new SelectCommandCounter();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .AddInterceptors(counter)
            .Options;
        await using var context = new SqliteServiceRunContext(options);
        await context.Database.EnsureCreatedAsync();
        await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
        var actorId = GuidHelper.NewId();
        var now = DateTime.UtcNow;
        var blockedRuns = new List<(byte[] RunId, byte[] PlanId, DateTime UpdatedAt)>();
        var closedRunIds = new List<byte[]>();
        for (var index = 0; index < 24; index++)
        {
            var planId = GuidHelper.NewId();
            var runId = GuidHelper.NewId();
            var customerId = GuidHelper.NewId();
            var updatedAt = now.AddMinutes(index >= 22 ? 23 : index);
            context.Productionplans.Add(new ProductionPlan
            {
                PlanId = planId,
                PlanCode = $"KHSX-STATUS-{index:00}",
                PlanDate = new DateOnly(2026, 8, 5),
                Status = "CREATED",
                CreatedBy = actorId,
                CreatedAt = now,
                UpdatedAt = updatedAt,
            });
            var isClosed = index % 3 == 0;
            var run = new ServiceRun
            {
                ServiceRunId = runId,
                PlanId = planId,
                CustomerId = customerId,
                ServiceDate = new DateOnly(2026, 8, 5),
                ShiftName = "MORNING",
                PriceTierAmount = 25000m,
                Status = isClosed ? "OPEN" : "CLOSE",
                ClosedAt = isClosed ? updatedAt : null,
                OpenedBy = actorId,
                CreatedAt = now,
                UpdatedAt = updatedAt,
            };
            if (isClosed)
            {
                run.CloseSnapshotJson = JsonSerializer.Serialize(new ServiceRunCloseSnapshotDto
                {
                    OperationalRow = new ServiceRunOperationalRowDto
                    {
                        Lifecycle = new ServiceRunLifecycleProjectionDto
                        {
                            ServiceRunId = GuidHelper.ToGuidString(runId),
                            Status = ServiceRunStatus.Planned,
                        },
                    },
                });
                closedRunIds.Add(runId);
            }
            else
            {
                blockedRuns.Add((runId, planId, updatedAt));
            }
            context.Serviceruns.Add(run);
        }
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = new ServiceRunService(context);
        var byteOrder = Comparer<byte[]>.Create((left, right) => left.AsSpan().SequenceCompareTo(right));
        var expectedBlocked = blockedRuns.OrderByDescending(item => item.UpdatedAt).ThenBy(item => item.RunId, byteOrder).ToList();

        counter.Reset();
        var page = await service.GetPageAsync(new ServiceRunPageQuery
        {
            AllCustomers = true,
            Status = ServiceRunStatus.Blocked,
            PageNumber = 2,
            PageSize = 5,
        });

        page.TotalCount.Should().Be(expectedBlocked.Count);
        page.Items.Select(item => item.Lifecycle.ServiceRunId).Should().Equal(
            expectedBlocked.Skip(5).Take(5).Select(item => GuidHelper.ToGuidString(item.RunId)));
        page.Items.Should().OnlyContain(item => item.Lifecycle.Status == ServiceRunStatus.Blocked);
        var purchaseHydration = counter.CommandRecords.Single(record =>
            record.Text.Contains("PurchaseRequestLines", StringComparison.OrdinalIgnoreCase) &&
            record.Text.Contains("EstimatedUnitPrice", StringComparison.OrdinalIgnoreCase));
        var pagePlanIds = expectedBlocked.Skip(5).Take(5).Select(item => Convert.ToHexString(item.PlanId)).ToList();
        var offPagePlanId = Convert.ToHexString(expectedBlocked.Skip(10).First().PlanId);
        purchaseHydration.ParameterValues.Should().Contain(value => pagePlanIds.Any(id => value.Contains(id, StringComparison.Ordinal)));
        purchaseHydration.ParameterValues.Should().NotContain(value => value.Contains(offPagePlanId, StringComparison.Ordinal));

        var closedPage = await service.GetPageAsync(new ServiceRunPageQuery
        {
            AllCustomers = true,
            Status = ServiceRunStatus.Closed,
            PageNumber = 1,
            PageSize = 20,
        });
        closedPage.TotalCount.Should().Be(closedRunIds.Count);
        closedPage.Items.Should().OnlyContain(item => item.Lifecycle.Status == ServiceRunStatus.Closed && item.IsCloseSnapshot);

        counter.Reset();
        var beyondLastPage = await service.GetPageAsync(new ServiceRunPageQuery
        {
            AllCustomers = true,
            Status = ServiceRunStatus.Blocked,
            PageNumber = 99,
            PageSize = 5,
        });
        beyondLastPage.TotalCount.Should().Be(expectedBlocked.Count);
        beyondLastPage.Items.Should().BeEmpty();
        counter.CommandRecords.Should().NotContain(record =>
            record.Text.Contains("PurchaseRequestLines", StringComparison.OrdinalIgnoreCase) &&
            record.Text.Contains("EstimatedUnitPrice", StringComparison.OrdinalIgnoreCase));
        counter.CommandRecords.Should().NotContain(record =>
            record.Text.Contains("InventoryReceiptLines", StringComparison.OrdinalIgnoreCase) &&
            record.Text.Contains("UnitPrice", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task StatusFilteredServiceRunPage_SelectCount_Should_NotGrowWithCandidatePopulation()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var counter = new SelectCommandCounter();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .AddInterceptors(counter)
            .Options;
        await using var context = new SqliteServiceRunContext(options);
        await context.Database.EnsureCreatedAsync();
        await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
        var actorId = GuidHelper.NewId();
        var now = DateTime.UtcNow;
        byte[]? oneCustomerId = null;
        for (var index = 0; index < 20; index++)
        {
            var planId = GuidHelper.NewId();
            var customerId = GuidHelper.NewId();
            oneCustomerId ??= customerId;
            context.Productionplans.Add(new ProductionPlan
            {
                PlanId = planId, PlanCode = $"KHSX-STATUS-COUNT-{index:00}", PlanDate = new DateOnly(2026, 8, 5),
                Status = "CREATED", CreatedBy = actorId, CreatedAt = now, UpdatedAt = now.AddMinutes(index),
            });
            context.Serviceruns.Add(new ServiceRun
            {
                ServiceRunId = GuidHelper.NewId(), PlanId = planId, CustomerId = customerId, ServiceDate = new DateOnly(2026, 8, 5),
                ShiftName = "MORNING", PriceTierAmount = 25000m, Status = "CLOSE", OpenedBy = actorId,
                CreatedAt = now, UpdatedAt = now.AddMinutes(index),
            });
        }
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = new ServiceRunService(context);

        counter.Reset();
        var oneCandidate = await service.GetPageAsync(new ServiceRunPageQuery
        {
            CustomerId = GuidHelper.ToGuidString(oneCustomerId!), Status = ServiceRunStatus.Blocked, PageNumber = 1, PageSize = 1,
        });
        var oneCandidateSelectCount = counter.SelectCount;
        counter.Reset();
        var manyCandidates = await service.GetPageAsync(new ServiceRunPageQuery
        {
            AllCustomers = true, Status = ServiceRunStatus.Blocked, PageNumber = 1, PageSize = 1,
        });
        var manyCandidateSelectCount = counter.SelectCount;

        oneCandidate.TotalCount.Should().Be(1);
        manyCandidates.TotalCount.Should().Be(20);
        manyCandidateSelectCount.Should().Be(oneCandidateSelectCount);
        manyCandidateSelectCount.Should().Be(20);
    }

    [Fact]
    public async Task PlanSourceLineQuery_SelectCount_Should_NotGrowFromOneToTwentyRequests()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var counter = new SelectCommandCounter();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .AddInterceptors(counter)
            .Options;
        await using var context = new SqliteServiceRunContext(options);
        await context.Database.EnsureCreatedAsync();
        await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
        var planId = GuidHelper.NewId();
        var actorId = GuidHelper.NewId();
        for (var index = 0; index < 20; index++)
        {
            var requestId = GuidHelper.NewId();
            context.Materialrequests.Add(new MaterialRequest
            {
                RequestId = requestId,
                RequestCode = $"MR-BATCH-{index:00}",
                PlanId = planId,
                RequestDate = new DateOnly(2026, 8, 5),
                RequestScope = "SERVICE_RUN",
                Status = "GENERATED",
                CreatedBy = actorId,
            });
            context.Materialrequestlines.Add(new MaterialRequestLine
            {
                RequestLineId = GuidHelper.NewId(),
                RequestId = requestId,
                PlanLineId = GuidHelper.NewId(),
                IngredientId = GuidHelper.NewId(),
                UnitId = GuidHelper.NewId(),
                TotalRequiredQty = 1,
            });
        }
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        counter.Reset();
        var oneRequestLines = await ServiceRunService.SelectPlanSourceLines(
                context.Materialrequestlines,
                context.Materialrequests.Where(request => request.RequestCode == "MR-BATCH-00"),
                planId)
            .ToListAsync();
        var oneRequestSelectCount = counter.SelectCount;
        counter.Reset();
        var twentyRequestLines = await ServiceRunService.SelectPlanSourceLines(context.Materialrequestlines, context.Materialrequests, planId)
            .ToListAsync();
        var twentyRequestSelectCount = counter.SelectCount;

        oneRequestLines.Should().ContainSingle();
        twentyRequestLines.Should().HaveCount(20);
        oneRequestSelectCount.Should().Be(1);
        twentyRequestSelectCount.Should().Be(oneRequestSelectCount);
    }

    [Fact]
    public void ScopedSourceLineQuery_Should_TranslateForMySqlWithoutClientSideBase64Keys()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql(
                "Server=localhost;Database=translation_only;User=root;Password=unused",
                new MySqlServerVersion(new Version(8, 0, 0)))
            .Options;
        using var context = new IpcManagementContext(options);

        var sql = ServiceRunService.SelectRequestSourceLines(
                context.Materialrequestlines,
                GuidHelper.NewId())
            .ToQueryString();

        sql.Should().Contain("requestId");
        sql.Should().NotContain("Base64");
    }

    [Fact]
    public void Evaluate_Should_BlockAnUnsignedPlanOrIncompleteBom()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: false, HasGeneratedMaterialDemand: false, HasBomBlocker: true, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: false, HasUnresolvedVariance: false,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.Blocked);
        result.Blockers.Should().Contain([ServiceRunBlocker.PlanNotSignedOff, ServiceRunBlocker.BomIncomplete]);
        result.CanStartService.Should().BeFalse();
    }

    [Fact]
    public async Task OpenAsync_Should_RejectAPlanThatWasNotSentToKitchen()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseInMemoryDatabase($"service-run-unsent-{Guid.NewGuid():N}").Options;
        var actorId = GuidHelper.NewId();
        var planId = GuidHelper.NewId();
        await using (var context = new IpcManagementContext(options))
        {
            context.Productionplans.Add(new ProductionPlan
            {
                PlanId = planId, PlanCode = "KHSX-UNSENT", PlanDate = new DateOnly(2026, 8, 5), Status = "CREATED", CreatedBy = actorId,
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Productionplanlines = [new ProductionPlanLine { PlanLineId = GuidHelper.NewId(), PlanId = planId, QuantityPlanLineId = GuidHelper.NewId(), CustomerId = GuidHelper.NewId(), MenuId = GuidHelper.NewId(), DishId = GuidHelper.NewId(), ShiftName = "MORNING" }],
            });
            await context.SaveChangesAsync();
        }
        await using var verificationContext = new IpcManagementContext(options);
        var service = new ServiceRunService(verificationContext);
        var action = () => service.OpenAsync(new OpenServiceRunRequest { PlanId = GuidHelper.ToGuidString(planId), ShiftName = "MORNING" }, GuidHelper.ToGuidString(actorId));
        await action.Should().ThrowAsync<BusinessRuleException>().WithMessage("*chưa gửi Bếp*");
    }

    [Fact]
    public void SelectRelevantIssueLines_Should_IncludeFullDayIssueByMaterialRequestLineInsteadOfHeaderShift()
    {
        var morningRequestLineId = GuidHelper.NewId();
        var afternoonRequestLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var fullDayIssue = new InventoryIssue
        {
            ShiftName = null,
            Inventoryissuelines =
            [
                new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IngredientId = ingredientId, UnitId = unitId, MaterialRequestLineId = morningRequestLineId, IssuedQty = 10m },
                new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IngredientId = ingredientId, UnitId = unitId, MaterialRequestLineId = afternoonRequestLineId, IssuedQty = 10m },
            ],
        };

        var relevant = ServiceRunService.SelectRelevantIssueLines(
            [fullDayIssue],
            [new MaterialRequestLine { RequestLineId = morningRequestLineId, IngredientId = ingredientId, UnitId = unitId }],
            "MORNING");

        relevant.Should().ContainSingle().Which.MaterialRequestLineId.Should().Equal(morningRequestLineId);
    }

    [Fact]
    public void Evaluate_Should_KeepSupplyExceptionsOpenBeforeProduction()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: true, HasUnreceivedIssue: true,
            HasOpenSupplemental: true, HasRecordedActualServings: false, HasUnresolvedVariance: false,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.MaterialsInProgress);
        result.Blockers.Should().Contain([
            ServiceRunBlocker.OpenSupply,
            ServiceRunBlocker.UnreceivedIssue,
            ServiceRunBlocker.OpenSupplemental,
        ]);
    }

    [Fact]
    public void Evaluate_Should_AllowProductionOnlyWhenMaterialsAreTerminal()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: false, HasUnresolvedVariance: false,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.ReadyToProduce);
        result.CanStartService.Should().BeTrue();
        result.Blockers.Should().Contain(ServiceRunBlocker.ActualServingsNotRecorded);
    }

    [Fact]
    public void Evaluate_Should_RequireVarianceResolutionBeforeServiceConfirmation()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: true, HasUnresolvedVariance: true,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.ReconciliationRequired);
        result.Blockers.Should().Contain(ServiceRunBlocker.UnresolvedVariance);
    }

    [Fact]
    public void Evaluate_Should_PrioritizeADeclaredKitchenDiscrepancyBeforeProductionStarts()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: false, HasUnresolvedVariance: true,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.ReconciliationRequired);
        result.Blockers.Should().Contain(ServiceRunBlocker.UnresolvedVariance);
        result.CanStartService.Should().BeFalse();
    }

    [Fact]
    public void Evaluate_Should_RequireServingVarianceDecision_AndRejectConflictingConfirmationOutcomes()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: true, HasUnresolvedVariance: false,
            HasServiceConfirmation: true, IsServiceConfirmationWaived: true, IsClosed: false,
            HasUnresolvedServingVariance: true));

        result.Status.Should().Be(ServiceRunStatus.ReconciliationRequired);
        result.Blockers.Should().Contain([ServiceRunBlocker.UnresolvedServingVariance, ServiceRunBlocker.ConfirmationOutcomeConflict]);
        result.CanClose.Should().BeFalse();
    }

    [Fact]
    public void Evaluate_Should_AllowClosingOnlyAfterConfirmationOrApprovedWaiver()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: true, HasUnresolvedVariance: false,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: true, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.ReadyToClose);
        result.Blockers.Should().BeEmpty();
        result.CanClose.Should().BeTrue();
    }

    [Fact]
    public void Evaluate_Should_KeepADeclaredExceptionBlockedUntilAnAdminWaiverCoversItsSourceLine()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: true, HasUnresolvedVariance: true,
            HasServiceConfirmation: true, IsServiceConfirmationWaived: false, IsClosed: false,
            HasUnresolvedServingVariance: false, HasApprovedVarianceWaiver: true));

        result.Blockers.Should().NotContain(ServiceRunBlocker.UnresolvedVariance);
        result.CanClose.Should().BeTrue();
    }

    private sealed class SqliteServiceRunContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entity.GetProperties())
                {
                    if (property.GetColumnType()?.StartsWith("enum(", StringComparison.OrdinalIgnoreCase) == true)
                        property.SetColumnType("TEXT");
                    if (property.GetDefaultValueSql()?.Equals("CURRENT_TIMESTAMP(6)", StringComparison.OrdinalIgnoreCase) == true)
                        property.SetDefaultValueSql("CURRENT_TIMESTAMP");
                    property.SetCollation(null);
                }
                foreach (var index in entity.GetIndexes().ToList())
                    entity.RemoveIndex(index);
            }
        }
    }

    private sealed record CommandRecord(string Text, List<string> ParameterValues);

    private sealed class SelectCommandCounter : DbCommandInterceptor
    {
        public int SelectCount { get; private set; }
        public List<string> Commands { get; } = [];
        public List<CommandRecord> CommandRecords { get; } = [];

        public void Reset()
        {
            SelectCount = 0;
            Commands.Clear();
            CommandRecords.Clear();
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                SelectCount++;
                Commands.Add(command.CommandText);
                CommandRecords.Add(new CommandRecord(command.CommandText, command.Parameters.Cast<DbParameter>()
                    .Select(parameter => parameter.Value is byte[] bytes
                        ? Convert.ToBase64String(bytes)
                        : Convert.ToString(parameter.Value) ?? string.Empty)
                    .ToList()));
            }
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    [Fact]
    public async Task CreateAdjustmentAsync_Should_AppendCorrectionWithoutMutatingClosedSnapshot()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"service-run-adjustment-{Guid.NewGuid():N}")
            .Options;
        var actorId = GuidHelper.NewId();
        var runId = GuidHelper.NewId();
        const string snapshot = "{\"actualServings\":120}";
        await using (var context = new IpcManagementContext(options))
        {
            context.Serviceruns.Add(new ServiceRun
            {
                ServiceRunId = runId, PlanId = GuidHelper.NewId(), CustomerId = GuidHelper.NewId(), ServiceDate = new DateOnly(2026, 8, 5),
                ShiftName = "MORNING", PriceTierAmount = 25000m, Status = ServiceRunStatus.Closed,
                ActualServings = 120, ClosedAt = DateTime.UtcNow, CloseSnapshotJson = snapshot,
                OpenedBy = actorId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            });
            await context.SaveChangesAsync();
        }

        await using var verificationContext = new IpcManagementContext(options);
        var service = new ServiceRunService(verificationContext);
        var adjustment = await service.CreateAdjustmentAsync(GuidHelper.ToGuidString(runId), new CreateServiceRunAdjustmentRequest
        {
            CorrectedActualServings = 118,
            Reason = "Khách vắng có xác nhận hậu kiểm.",
        }, GuidHelper.ToGuidString(actorId));

        adjustment!.CorrectedActualServings.Should().Be(118);
        verificationContext.Serviceruns.Single().ActualServings.Should().Be(120);
        verificationContext.Serviceruns.Single().CloseSnapshotJson.Should().Be(snapshot);
        verificationContext.Servicerunadjustments.Should().ContainSingle(item => item.Reason == "Khách vắng có xác nhận hậu kiểm.");
        verificationContext.Auditlogs.Should().ContainSingle(item => item.EntityName == nameof(ServiceRunAdjustment) && item.FieldName == "ActualServingsCorrection");
    }
}
