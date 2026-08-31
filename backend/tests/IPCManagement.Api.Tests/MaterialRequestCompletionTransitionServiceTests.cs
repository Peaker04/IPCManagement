using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class MaterialRequestCompletionTransitionServiceTests
{
    [Fact]
    public void Stage_WhenDemandRemainsIncomplete_IsNoOp()
    {
        using var context = CreateInMemoryContext();
        var fixture = CreateRequest(totalRequiredQty: 10m);
        var service = new MaterialRequestCompletionTransitionService(context);

        var result = service.Stage(Input(fixture, currentQty: 9m));

        result.Outcome.Should().Be(MaterialRequestCompletionTransitionOutcome.Incomplete);
        fixture.Request.Status.Should().Be("SENTTOWAREHOUSE");
        context.ChangeTracker.Entries<AuditLog>().Should().BeEmpty();
    }

    [Fact]
    public void Stage_WhenExactLineageCompletesDemand_StagesStatusAndExactAudit()
    {
        using var context = CreateInMemoryContext();
        var fixture = CreateRequest(totalRequiredQty: 10m);
        var actor = GuidHelper.NewId();
        var service = new MaterialRequestCompletionTransitionService(context);

        var result = service.Stage(Input(fixture, currentQty: 10m, actor));

        result.Should().Be(new MaterialRequestCompletionTransitionResult(
            MaterialRequestCompletionTransitionOutcome.Transitioned,
            "SENTTOWAREHOUSE",
            "EXPORTED"));
        fixture.Request.Status.Should().Be("EXPORTED");
        var audit = context.ChangeTracker.Entries<AuditLog>().Single().Entity;
        audit.ChangedBy.Should().Equal(actor);
        audit.EntityId.Should().Equal(fixture.Request.RequestId);
        audit.BusinessArea.Should().Be("InventoryIssue");
        audit.EntityName.Should().Be(nameof(MaterialRequest));
        audit.FieldName.Should().Be(nameof(MaterialRequest.Status));
        audit.OldValue.Should().Be("SENTTOWAREHOUSE");
        audit.NewValue.Should().Be("EXPORTED");
    }

    [Fact]
    public void Stage_WhenAlreadyCompleted_IsIdempotent()
    {
        using var context = CreateInMemoryContext();
        var fixture = CreateRequest(totalRequiredQty: 10m);
        fixture.Request.Status = "EXPORTED";
        var service = new MaterialRequestCompletionTransitionService(context);

        var result = service.Stage(Input(fixture, currentQty: 10m));

        result.Outcome.Should().Be(MaterialRequestCompletionTransitionOutcome.AlreadyCompleted);
        context.ChangeTracker.Entries<AuditLog>().Should().BeEmpty();
    }

    [Fact]
    public void Stage_WhenPriorIssueHasForeignOrReconciliationLineage_Rejects()
    {
        using var context = CreateInMemoryContext();
        var fixture = CreateRequest(totalRequiredQty: 10m);
        var foreignRequestId = GuidHelper.NewId();
        var priorLine = new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(),
            IssueId = GuidHelper.NewId(),
            IngredientId = fixture.Line.IngredientId,
            UnitId = fixture.Line.UnitId,
            RequestedQty = 10m,
            IssuedQty = 10m,
            MaterialRequestLineId = fixture.Line.RequestLineId,
            ReconciliationBatchLineId = GuidHelper.NewId(),
            Issue = new InventoryIssue
            {
                IssueId = GuidHelper.NewId(),
                IssueCode = "ISS-FOREIGN",
                IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
                WarehouseId = GuidHelper.NewId(),
                MaterialRequestId = foreignRequestId,
                ReconciliationBatchId = GuidHelper.NewId(),
                IssuedBy = GuidHelper.NewId(),
                CreatedAt = DateTime.UtcNow
            }
        };
        var service = new MaterialRequestCompletionTransitionService(context);

        var action = () => service.Stage(new MaterialRequestCompletionTransitionInput(
            fixture.Request,
            [priorLine],
            [],
            GuidHelper.NewId()));

        action.Should().Throw<BusinessRuleException>()
            .WithMessage("*exact MaterialRequest lineage*");
        fixture.Request.Status.Should().Be("SENTTOWAREHOUSE");
        context.ChangeTracker.Entries<AuditLog>().Should().BeEmpty();
    }

    [Fact]
    public void Stage_WhenLegacyLineCannotMapToOneExactDemandLine_RejectsReconciliationRequirement()
    {
        using var context = CreateInMemoryContext();
        var fixture = CreateRequest(totalRequiredQty: 5m);
        fixture.Request.Materialrequestlines.Add(new MaterialRequestLine
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = fixture.Request.RequestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = fixture.Line.IngredientId,
            UnitId = fixture.Line.UnitId,
            TotalRequiredQty = 5m,
            Ingredient = fixture.Line.Ingredient,
            Unit = fixture.Line.Unit
        });
        var priorIssue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "ISS-LEGACY",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = GuidHelper.NewId(),
            MaterialRequestId = fixture.Request.RequestId,
            IssuedBy = GuidHelper.NewId(),
            CreatedAt = DateTime.UtcNow
        };
        var legacyLine = new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(),
            IssueId = priorIssue.IssueId,
            IngredientId = fixture.Line.IngredientId,
            UnitId = fixture.Line.UnitId,
            RequestedQty = 5m,
            IssuedQty = 5m,
            Issue = priorIssue
        };
        var service = new MaterialRequestCompletionTransitionService(context);

        var action = () => service.Stage(new MaterialRequestCompletionTransitionInput(
            fixture.Request,
            [legacyLine],
            [],
            GuidHelper.NewId()));

        action.Should().Throw<BusinessRuleException>()
            .WithMessage("*cần đối soát*");
        fixture.Request.Status.Should().Be("SENTTOWAREHOUSE");
    }

    [Fact]
    public async Task Stage_WhenCallerTransactionRollsBack_PreservesStatusAndAuditAtomically()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE materialrequests (
                requestId BLOB PRIMARY KEY,
                requestCode TEXT NOT NULL,
                planId BLOB NOT NULL,
                requestDate TEXT NOT NULL,
                requestScope TEXT NOT NULL,
                status TEXT NOT NULL,
                createdBy BLOB NOT NULL,
                approvedBy BLOB NULL,
                approvedAt TEXT NULL
            );
            CREATE TABLE auditlogs (
                auditId BLOB PRIMARY KEY,
                changedAt TEXT NOT NULL,
                changedBy BLOB NOT NULL,
                businessArea TEXT NOT NULL,
                entityName TEXT NOT NULL,
                entityId BLOB NULL,
                fieldName TEXT NULL,
                oldValue TEXT NULL,
                newValue TEXT NULL,
                reason TEXT NULL,
                correlationId TEXT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
        await using var context = new IpcManagementContext(options);
        var fixture = CreateRequest(totalRequiredQty: 10m);
        command.CommandText = """
            INSERT INTO materialrequests
                (requestId, requestCode, planId, requestDate, requestScope, status, createdBy)
            VALUES ($id, $code, $plan, $date, $scope, $status, $actor);
            """;
        command.Parameters.AddWithValue("$id", fixture.Request.RequestId);
        command.Parameters.AddWithValue("$code", fixture.Request.RequestCode);
        command.Parameters.AddWithValue("$plan", fixture.Request.PlanId);
        command.Parameters.AddWithValue("$date", fixture.Request.RequestDate.ToString("yyyy-MM-dd"));
        command.Parameters.AddWithValue("$scope", fixture.Request.RequestScope);
        command.Parameters.AddWithValue("$status", fixture.Request.Status);
        command.Parameters.AddWithValue("$actor", fixture.Request.CreatedBy);
        await command.ExecuteNonQueryAsync();
        context.Attach(fixture.Request);
        var service = new MaterialRequestCompletionTransitionService(context);
        var runner = new EfTransactionRunner(context);

        var action = () => runner.ExecuteAsync(
            async _ =>
            {
                service.Stage(Input(fixture, currentQty: 10m));
                await context.SaveChangesAsync();
                throw new InvalidOperationException("force rollback");
            },
            _ => Task.FromResult(false));

        await action.Should().ThrowAsync<InvalidOperationException>().WithMessage("force rollback");
        context.ChangeTracker.Clear();
        (await context.Materialrequests.AsNoTracking().SingleAsync()).Status.Should().Be("SENTTOWAREHOUSE");
        (await context.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    private static MaterialRequestCompletionTransitionInput Input(
        RequestFixture fixture,
        decimal currentQty,
        byte[]? actor = null)
        => new(
            fixture.Request,
            [],
            [new MaterialRequestCompletionIssueLine(fixture.Line.RequestLineId, currentQty)],
            actor ?? GuidHelper.NewId());

    private static RequestFixture CreateRequest(decimal totalRequiredQty)
    {
        var requestId = GuidHelper.NewId();
        var unit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram" };
        var ingredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = "ING-TRANSITION",
            IngredientName = "Transition Ingredient",
            UnitId = unit.UnitId,
            WarehouseId = GuidHelper.NewId(),
            Unit = unit
        };
        var line = new MaterialRequestLine
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = requestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            TotalRequiredQty = totalRequiredQty,
            Ingredient = ingredient,
            Unit = unit
        };
        var request = new MaterialRequest
        {
            RequestId = requestId,
            RequestCode = "MR-TRANSITION",
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestScope = "FULLDAY",
            Status = "SENTTOWAREHOUSE",
            CreatedBy = GuidHelper.NewId(),
            PlanId = GuidHelper.NewId(),
            Materialrequestlines = [line]
        };
        return new RequestFixture(request, line);
    }

    private static IpcManagementContext CreateInMemoryContext()
        => new(new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"material-request-transition-{Guid.NewGuid():N}")
            .Options);

    private sealed record RequestFixture(MaterialRequest Request, MaterialRequestLine Line);
}
