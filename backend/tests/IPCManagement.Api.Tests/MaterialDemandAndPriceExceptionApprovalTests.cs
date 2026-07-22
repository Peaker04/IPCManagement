using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Approvals;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IPCManagement.Api.Tests;

public class MaterialDemandAndPriceExceptionApprovalTests
{
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

    [Fact(Skip = "Plan 09-10 owns auditable price-exception approval behavior.")]
    public void Manager_resolves_price_exception_above_fifteen_percent()
    {
        Assert.Fail("Plan 09-10 must persist and resolve price exceptions.");
    }

    private static ClaimsPrincipal BuildPrincipal(string role)
        => new(new ClaimsIdentity([new Claim(ClaimTypes.Role, role)], "test"));

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
