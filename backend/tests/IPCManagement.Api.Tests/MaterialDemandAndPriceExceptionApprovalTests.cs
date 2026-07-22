using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Approvals;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using System.Security.Claims;

namespace IPCManagement.Api.Tests;

public class MaterialDemandAndPriceExceptionApprovalTests
{
    [Fact]
    public async Task Persistence_price_exception_binds_one_proposal_and_preserves_superseded_decisions()
    {
        await using var context = CreateInboxContext();
        var entity = context.Model.FindEntityType(typeof(Purchasepriceexception));

        entity.Should().NotBeNull();
        entity!.FindProperty(nameof(Purchasepriceexception.ProposalFingerprint))!.IsNullable.Should().BeFalse();
        entity.FindProperty(nameof(Purchasepriceexception.ProposalVersion))!.IsNullable.Should().BeFalse();
        entity.FindProperty(nameof(Purchasepriceexception.ConcurrencyVersion))!.IsConcurrencyToken.Should().BeTrue();
        entity.GetCheckConstraints().Select(constraint => constraint.Name).Should().Contain([
            "ckPurchasePriceExceptionsStrictVariance",
            "ckPurchasePriceExceptionsDecisionComplete",
            "ckPurchasePriceExceptionsStatus",
            "ckPurchasePriceExceptionsSupersession"
        ]);
        entity.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual([
                    nameof(Purchasepriceexception.PurchaseLineSupplierDecisionId),
                    nameof(Purchasepriceexception.ProposalFingerprint),
                    nameof(Purchasepriceexception.ProposalVersion)
                ]));
        var decisionForeignKey = entity.GetForeignKeys().Single(key =>
            key.Properties.Select(property => property.Name)
                .SequenceEqual([nameof(Purchasepriceexception.PurchaseLineSupplierDecisionId)]));
        decisionForeignKey.IsRequired.Should().BeTrue();

        var decisionId = GuidHelper.NewId();
        var firstExceptionId = GuidHelper.NewId();
        var secondExceptionId = GuidHelper.NewId();
        context.Purchasepriceexceptions.AddRange(
            new Purchasepriceexception
            {
                PurchasePriceExceptionId = firstExceptionId,
                PurchaseLineSupplierDecisionId = decisionId,
                ReferencePrice = 100m,
                ProposedPrice = 120m,
                VariancePercent = 20m,
                EvidenceType = "EFFECTIVE_QUOTATION",
                EvidenceId = GuidHelper.NewId(),
                EvidenceDate = new DateOnly(2026, 7, 20),
                Reason = "Giá đề xuất vượt ngưỡng",
                ProposalFingerprint = new string('C', 64),
                ProposalVersion = 1,
                RequestedBy = GuidHelper.NewId(),
                RequestedAt = new DateTime(2026, 7, 20, 9, 0, 0, DateTimeKind.Utc),
                Status = "SUPERSEDED",
                SupersededByExceptionId = secondExceptionId,
                ConcurrencyVersion = 2
            },
            new Purchasepriceexception
            {
                PurchasePriceExceptionId = secondExceptionId,
                PurchaseLineSupplierDecisionId = decisionId,
                ReferencePrice = 100m,
                ProposedPrice = 118m,
                VariancePercent = 18m,
                EvidenceType = "EFFECTIVE_QUOTATION",
                EvidenceId = GuidHelper.NewId(),
                EvidenceDate = new DateOnly(2026, 7, 21),
                Reason = "Cập nhật báo giá",
                ProposalFingerprint = new string('D', 64),
                ProposalVersion = 2,
                RequestedBy = GuidHelper.NewId(),
                RequestedAt = new DateTime(2026, 7, 21, 9, 0, 0, DateTimeKind.Utc),
                Status = "PENDING",
                ConcurrencyVersion = 1
            });

        await context.SaveChangesAsync();

        (await context.Purchasepriceexceptions.AsNoTracking().OrderBy(item => item.ProposalVersion).ToListAsync())
            .Select(item => (item.ProposalVersion, item.Status, item.ProposalFingerprint))
            .Should().Equal(
                (1, "SUPERSEDED", new string('C', 64)),
                (2, "PENDING", new string('D', 64)));
    }

    [Theory]
    [InlineData("Manager", true)]
    [InlineData("Quản lý", true)]
    [InlineData("Admin", true)]
    [InlineData("Purchasing", false)]
    [InlineData("Thu mua", false)]
    [InlineData("WarehouseStaff", false)]
    public void RoleBoundary_DecisionPermissionsAreManagerOwned(string role, bool expected)
    {
        var permissions = AuthorizationPolicies.ResolvePermissions(role);

        permissions.Contains("material-demand.approve").Should().Be(expected);
        permissions.Contains(AuthorizationPolicies.PurchaseRequestApprove).Should().Be(expected);

        if (role is "Purchasing" or "Thu mua")
        {
            permissions.Should().Contain(AuthorizationPolicies.PurchaseRead);
            permissions.Should().Contain(AuthorizationPolicies.PurchaseGenerate);
            permissions.Should().Contain(AuthorizationPolicies.PurchaseQuotationManage);
        }
    }

    [Theory]
    [InlineData("material-demand")]
    [InlineData("materialdemand")]
    [InlineData("demand")]
    public void RoleBoundary_MaterialDemandTargetAliasesAreBounded(string alias)
    {
        ApprovalTargetTypeParser.Parse(alias)?.ToString().Should().Be("MaterialDemand");
    }

    [Theory]
    [InlineData("")]
    [InlineData("material demand")]
    [InlineData("manager-demand")]
    [InlineData("anything")]
    public void RoleBoundary_UnknownTargetAliasesAreRejected(string alias)
    {
        ApprovalTargetTypeParser.Parse(alias).Should().BeNull();
    }

    [Theory]
    [InlineData("Manager", "material-demand", true)]
    [InlineData("Manager", "price-exception", true)]
    [InlineData("Purchasing", "material-demand", false)]
    [InlineData("Purchasing", "price-exception", false)]
    [InlineData("Warehouse", "material-demand", false)]
    [InlineData("Warehouse", "price-exception", false)]
    public void Approval_fixture_role_matrix_is_explicit(string role, string target, bool expected)
    {
        var canApprove = role == "Manager" && target is "material-demand" or "price-exception";

        canApprove.Should().Be(expected);
    }

    [Fact]
    public async Task MaterialDemand_ManagerApprovesPendingSnapshotWithDurableHistory()
    {
        await using var fixture = await MaterialDemandApprovalFixture.CreateAsync();
        var requestId = await fixture.SeedRequestAsync("DRAFT");
        var service = fixture.CreateWorkflowService();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var result = await service.ExecuteAsync(
            "material-demand",
            requestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Approve, Reason = "Nhu cầu hợp lệ" },
            fixture.ActorIdString,
            BuildPrincipal("Manager"));

        var after = DateTime.UtcNow.AddSeconds(1);
        result.Should().NotBeNull();
        result!.TargetType.Should().Be("material-demand");
        result.OldStatus.Should().Be("DRAFT");
        result.NewStatus.Should().Be("MANAGERAPPROVED");
        result.ActionAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);

        await using var context = fixture.CreateContext();
        var request = await context.Materialrequests.AsNoTracking().SingleAsync();
        request.Status.Should().Be("MANAGERAPPROVED");
        request.ApprovedBy.Should().Equal(fixture.ActorId);
        request.ApprovedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);

        var history = await context.Approvalhistories.AsNoTracking().SingleAsync();
        history.TargetType.Should().Be("material-demand");
        history.TargetId.Should().Equal(request.RequestId);
        history.Decision.Should().Be("APPROVE");
        history.ActionBy.Should().Equal(fixture.ActorId);
        history.Reason.Should().Be("Nhu cầu hợp lệ");
    }

    [Fact]
    public async Task MaterialDemand_ManagerRejectsPendingSnapshotWithReason()
    {
        await using var fixture = await MaterialDemandApprovalFixture.CreateAsync();
        var requestId = await fixture.SeedRequestAsync("DRAFT");

        var result = await fixture.CreateWorkflowService().ExecuteAsync(
            "material-demand",
            requestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Reject, Reason = "Thiếu dữ liệu" },
            fixture.ActorIdString,
            BuildPrincipal("Quản lý"));

        result!.NewStatus.Should().Be("CANCELLED");
        await using var context = fixture.CreateContext();
        (await context.Materialrequests.AsNoTracking().SingleAsync()).Status.Should().Be("CANCELLED");
        var history = await context.Approvalhistories.AsNoTracking().SingleAsync();
        history.Decision.Should().Be("REJECT");
        history.Reason.Should().Be("Thiếu dữ liệu");
    }

    [Fact]
    public async Task MaterialDemand_SameDecisionReplayIsIdempotent()
    {
        await using var fixture = await MaterialDemandApprovalFixture.CreateAsync();
        var requestId = await fixture.SeedRequestAsync("DRAFT");
        var service = fixture.CreateWorkflowService();
        var decision = new ApprovalRequestDto { Status = ApprovalDecision.Approve, Reason = "Đồng ý" };

        var first = await service.ExecuteAsync(
            "material-demand", requestId, decision, fixture.ActorIdString, BuildPrincipal("Manager"));
        var replay = await service.ExecuteAsync(
            "material-demand", requestId, decision, fixture.ActorIdString, BuildPrincipal("Manager"));

        replay!.HistoryId.Should().Be(first!.HistoryId);
        replay.Status.Should().Be(first.Status);
        replay.ActionAt.Should().Be(first.ActionAt);
        await using var context = fixture.CreateContext();
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task MaterialDemand_ConflictingTerminalDecisionIsRejected()
    {
        await using var fixture = await MaterialDemandApprovalFixture.CreateAsync();
        var requestId = await fixture.SeedRequestAsync("DRAFT");
        var service = fixture.CreateWorkflowService();
        await service.ExecuteAsync(
            "material-demand",
            requestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Approve, Reason = "Đủ điều kiện" },
            fixture.ActorIdString,
            BuildPrincipal("Manager"));

        var act = async () => await service.ExecuteAsync(
            "material-demand",
            requestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Reject, Reason = "Đổi quyết định" },
            fixture.ActorIdString,
            BuildPrincipal("Manager"));

        await act.Should().ThrowAsync<InvalidOperationException>();
        await using var context = fixture.CreateContext();
        (await context.Materialrequests.AsNoTracking().SingleAsync()).Status.Should().Be("MANAGERAPPROVED");
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task MaterialDemand_StaleTerminalSnapshotWithoutHistoryIsRejected()
    {
        await using var fixture = await MaterialDemandApprovalFixture.CreateAsync();
        var requestId = await fixture.SeedRequestAsync("MANAGERAPPROVED");

        var act = async () => await fixture.CreateWorkflowService().ExecuteAsync(
            "material-demand",
            requestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Approve, Reason = "Replay không có history" },
            fixture.ActorIdString,
            BuildPrincipal("Manager"));

        await act.Should().ThrowAsync<InvalidOperationException>();
        await using var context = fixture.CreateContext();
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Inbox_ManagerSeesPendingMaterialDemandOnceWithOperationalContext()
    {
        await using var context = CreateInboxContext();
        var request = await SeedInboxDemandAsync(context, 1, "DRAFT", twoLines: true);
        var inbox = await new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>())
            .GetPendingAsync(BuildPrincipal("Manager"), new ApprovalInboxQueryDto { Limit = 20 });

        var item = inbox.Should().ContainSingle(candidate => candidate.TargetType == "material-demand").Subject;
        item.TargetId.Should().Be(GuidHelper.ToGuidString(request.RequestId));
        item.TargetCode.Should().Be(request.RequestCode);
        item.DueDate.Should().Be(request.RequestDate);
        item.Status.Should().Be("PENDING");
        item.Route.Should().Contain("targetType=material-demand").And.Contain(item.TargetId);
        ReadProperty<DateOnly?>(item, "WeekStartDate").Should().Be(new DateOnly(2026, 7, 20));
        ReadProperty<DateOnly?>(item, "ServiceDate").Should().Be(request.RequestDate);
        ReadProperty<string>(item, "Scope").Should().Be("FULLDAY");
        ReadProperty<int?>(item, "LineCount").Should().Be(2);
        ReadProperty<decimal?>(item, "TotalQuantity").Should().Be(10m);
        ReadProperty<decimal?>(item, "TotalValue").Should().BeNull();
        ReadProperty<DateTime?>(item, "SubmittedAt").Should().Be(request.Plan.CreatedAt);
        item.Materials.Should().ContainSingle()
            .Which.Quantity.Should().Be(10m);
    }

    [Fact]
    public async Task Inbox_PagingIsStableAndPurchasingCannotMutateDemand()
    {
        await using var context = CreateInboxContext();
        await SeedInboxDemandAsync(context, 1, "DRAFT");
        await SeedInboxDemandAsync(context, 2, "DRAFT");
        await SeedInboxDemandAsync(context, 3, "DRAFT");
        var inboxService = new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>());

        var first = await inboxService.GetPendingPageAsync(
            BuildPrincipal("Manager"), new ApprovalInboxQueryDto { Limit = 1 });
        var second = await inboxService.GetPendingPageAsync(
            BuildPrincipal("Manager"), new ApprovalInboxQueryDto { Limit = 1, Cursor = first.NextCursor });
        var third = await inboxService.GetPendingPageAsync(
            BuildPrincipal("Manager"), new ApprovalInboxQueryDto { Limit = 1, Cursor = second.NextCursor });

        first.Items.Concat(second.Items).Concat(third.Items)
            .Select(item => item.InboxItemId)
            .Should().OnlyHaveUniqueItems().And.HaveCount(3);
        third.HasNext.Should().BeFalse();

        var purchasingInbox = await inboxService.GetPendingAsync(
            BuildPrincipal("Purchasing"), new ApprovalInboxQueryDto { Limit = 20 });
        purchasingInbox.Should().NotContain(item => item.TargetType == "material-demand");

        await using var approvalFixture = await MaterialDemandApprovalFixture.CreateAsync();
        var requestId = await approvalFixture.SeedRequestAsync("DRAFT");
        var act = async () => await approvalFixture.CreateWorkflowService().ExecuteAsync(
            "material-demand",
            requestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Approve },
            approvalFixture.ActorIdString,
            BuildPrincipal("Purchasing"));
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
        await using var approvalContext = approvalFixture.CreateContext();
        (await approvalContext.Materialrequests.AsNoTracking().SingleAsync()).Status.Should().Be("DRAFT");
        (await approvalContext.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Inbox_TerminalDemandLeavesPendingAndRemainsInHistory()
    {
        await using var context = CreateInboxContext();
        var pending = await SeedInboxDemandAsync(context, 1, "DRAFT");
        var terminal = await SeedInboxDemandAsync(context, 2, "MANAGERAPPROVED");
        context.Approvalhistories.Add(new Approvalhistory
        {
            ApprovalHistoryId = GuidHelper.NewId(),
            TargetType = "material-demand",
            TargetId = terminal.RequestId,
            Decision = "APPROVE",
            OldStatus = "DRAFT",
            NewStatus = "MANAGERAPPROVED",
            Reason = "Đã duyệt",
            ActionBy = terminal.CreatedBy,
            ActionAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var inbox = await new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>())
            .GetPendingAsync(BuildPrincipal("Manager"), new ApprovalInboxQueryDto { Limit = 20 });

        inbox.Should().ContainSingle(item => item.TargetId == GuidHelper.ToGuidString(pending.RequestId));
        inbox.Should().NotContain(item => item.TargetId == GuidHelper.ToGuidString(terminal.RequestId));
        (await context.Approvalhistories.AsNoTracking().CountAsync(history =>
            history.TargetType == "material-demand" && history.TargetId == terminal.RequestId)).Should().Be(1);
    }

    [Fact(Skip = "Plan 09-10 owns auditable price-exception approval behavior.")]
    public void Manager_resolves_price_exception_above_fifteen_percent()
    {
        Assert.Fail("Plan 09-10 must persist and resolve price exceptions.");
    }

    private static ClaimsPrincipal BuildPrincipal(string role)
        => new(new ClaimsIdentity([new Claim(ClaimTypes.Role, role)], "test"));

    private static IpcManagementContext CreateInboxContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"material-demand-inbox-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }

    private static async Task<Materialrequest> SeedInboxDemandAsync(
        IpcManagementContext context,
        int ordinal,
        string status,
        bool twoLines = false)
    {
        var roleId = GuidHelper.NewId();
        var userId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var planId = GuidHelper.NewId();
        var role = new Role { RoleId = roleId, RoleCode = $"MANAGER-{ordinal}", RoleName = "Manager" };
        var user = new User
        {
            UserId = userId,
            FullName = $"Quản lý {ordinal}",
            Username = $"manager-{ordinal}",
            PasswordHash = "hash",
            RoleId = roleId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var unit = new Unit
        {
            UnitId = unitId,
            UnitCode = $"KG-{ordinal}",
            UnitName = "kg",
            ConvertRateToBase = 1
        };
        var warehouse = new Warehouse
        {
            WarehouseId = warehouseId,
            WarehouseCode = $"WH-{ordinal}",
            WarehouseName = "Kho chính",
            WarehouseType = "MAIN"
        };
        var ingredient = new Ingredient
        {
            IngredientId = ingredientId,
            IngredientCode = $"ING-{ordinal}",
            IngredientName = $"Nguyên liệu {ordinal}",
            UnitId = unitId,
            WarehouseId = warehouseId,
            ReferencePrice = 1000,
            IsFreshDaily = true,
            IsActive = true
        };
        var submittedAt = new DateTime(2026, 7, 21, 8, ordinal, 0, DateTimeKind.Utc);
        var plan = new Productionplan
        {
            PlanId = planId,
            PlanCode = $"KHSX-2026072{ordinal}-FULLDAY",
            PlanDate = new DateOnly(2026, 7, 21 + ordinal),
            WeekStartDate = new DateOnly(2026, 7, 20),
            Status = "CREATED",
            CreatedBy = userId,
            CreatedAt = submittedAt,
            UpdatedAt = submittedAt,
            CreatedByNavigation = user
        };
        var request = new Materialrequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = $"MR-2026072{ordinal}-FULLDAY",
            PlanId = planId,
            RequestDate = plan.PlanDate,
            RequestScope = "FULLDAY",
            Status = status,
            CreatedBy = userId,
            CreatedByNavigation = user,
            Plan = plan
        };

        request.Materialrequestlines.Add(CreateInboxLine(request, ingredient, unit, 4m));
        if (twoLines)
        {
            request.Materialrequestlines.Add(CreateInboxLine(request, ingredient, unit, 6m));
        }

        context.AddRange(role, user, unit, warehouse, ingredient, plan, request);
        await context.SaveChangesAsync();
        return request;
    }

    private static Materialrequestline CreateInboxLine(
        Materialrequest request,
        Ingredient ingredient,
        Unit unit,
        decimal suggestedPurchaseQuantity)
        => new()
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = request.RequestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            TotalServings = 100,
            GrossQtyPerServing = 0.1m,
            BomRatePercent = 100,
            TotalRequiredQty = suggestedPurchaseQuantity,
            CurrentStockQty = 0,
            SuggestedPurchaseQty = suggestedPurchaseQuantity,
            Ingredient = ingredient,
            Unit = unit,
            Request = request
        };

    private static T? ReadProperty<T>(object instance, string propertyName)
    {
        var property = instance.GetType().GetProperty(propertyName);
        property.Should().NotBeNull($"{propertyName} is required approval inbox context");
        return (T?)property!.GetValue(instance);
    }

    private sealed class MaterialDemandApprovalFixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly DbContextOptions<IpcManagementContext> _options;

        private MaterialDemandApprovalFixture(
            SqliteConnection connection,
            DbContextOptions<IpcManagementContext> options)
        {
            _connection = connection;
            _options = options;
        }

        public byte[] ActorId { get; } = GuidHelper.NewId();
        public string ActorIdString => GuidHelper.ToGuidString(ActorId);

        public static async Task<MaterialDemandApprovalFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            await CreateSchemaAsync(connection);
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;
            return new MaterialDemandApprovalFixture(connection, options);
        }

        public IpcManagementContext CreateContext() => new(_options);

        public IApprovalWorkflowService CreateWorkflowService()
        {
            var handlerType = typeof(IApprovalTargetHandler).Assembly.GetType(
                "IPCManagement.Api.Services.Approvals.MaterialDemandApprovalHandler");
            handlerType.Should().NotBeNull("material demand must be a first-class approval target handler");
            var handler = (IApprovalTargetHandler)Activator.CreateInstance(handlerType!, CreateContext())!;
            return new ApprovalWorkflowService([handler]);
        }

        public async Task<string> SeedRequestAsync(string status)
        {
            await using var context = CreateContext();
            var requestId = GuidHelper.NewId();
            context.Materialrequests.Add(new Materialrequest
            {
                RequestId = requestId,
                RequestCode = $"MR-{Guid.NewGuid():N}",
                PlanId = GuidHelper.NewId(),
                RequestDate = new DateOnly(2026, 7, 22),
                RequestScope = "FULLDAY",
                Status = status,
                CreatedBy = ActorId
            });
            await context.SaveChangesAsync();
            return GuidHelper.ToGuidString(requestId);
        }

        public async ValueTask DisposeAsync() => await _connection.DisposeAsync();

        private static async Task CreateSchemaAsync(SqliteConnection connection)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE materialrequests (
                    requestId BLOB PRIMARY KEY,
                    requestCode TEXT NOT NULL UNIQUE,
                    planId BLOB NOT NULL,
                    requestDate TEXT NOT NULL,
                    requestScope TEXT NOT NULL,
                    status TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    approvedBy BLOB NULL,
                    approvedAt TEXT NULL
                );
                CREATE TABLE approvalhistories (
                    approvalHistoryId BLOB PRIMARY KEY,
                    targetType TEXT NOT NULL,
                    targetId BLOB NOT NULL,
                    decision TEXT NOT NULL,
                    oldStatus TEXT NULL,
                    newStatus TEXT NULL,
                    reason TEXT NULL,
                    actionBy BLOB NOT NULL,
                    actionAt TEXT NOT NULL
                );
                """;
            await command.ExecuteNonQueryAsync();
        }
    }
}
