using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.SystemOperation.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class LegacyLineageDispositionServiceTests
{
    [Fact]
    public async Task IssueDisposition_ShouldRequireIndependentManagerThenApplyOnlyReviewedProvenance()
    {
        await using var fixture = await Fixture.CreateAsync();
        var candidates = await fixture.Service.GetCandidatesAsync("ISSUE_LINE", GuidHelper.ToGuidString(fixture.IssueLine.IssueLineId));
        candidates.Should().ContainSingle(item => item.TargetLineId == GuidHelper.ToGuidString(fixture.DemandLine.RequestLineId));
        var created = await fixture.Service.CreateAsync(new CreateLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-create-1",
            LegacyLineType = "ISSUE_LINE",
            LegacyLineId = GuidHelper.ToGuidString(fixture.IssueLine.IssueLineId),
            TargetLineId = GuidHelper.ToGuidString(fixture.DemandLine.RequestLineId),
            Reason = "Đối chiếu chứng từ gốc kho với demand line đúng cùng đơn vị."
        }, GuidHelper.ToGuidString(fixture.Admin.UserId));

        created.Status.Should().Be("PENDING_MANAGER_REVIEW");
        fixture.IssueLine.MaterialRequestLineId.Should().BeNull();
        fixture.Context.Lifecycletransitions.Should().ContainSingle(item => item.ToState == "PENDING_MANAGER_REVIEW");
        fixture.Context.Lifecycleoutboxmessages.Should().ContainSingle();
        fixture.Context.Lifecyclecommandreceipts.Should().ContainSingle();

        var approved = await fixture.Service.ReviewAsync(created.DispositionId, new ReviewLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-review-1",
            ExpectedVersion = 0,
            Approve = true,
            Reason = "Đã kiểm tra source-line, request và unit khớp chứng từ gốc."
        }, GuidHelper.ToGuidString(fixture.Manager.UserId));

        approved.Status.Should().Be("APPROVED");
        approved.Version.Should().Be(1);
        fixture.IssueLine.MaterialRequestLineId.Should().BeNull();

        var applied = await fixture.Service.ApplyAsync(created.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-apply-1",
            ExpectedVersion = 1,
            Reason = "Áp dụng mapping provenance đã được Manager duyệt."
        }, GuidHelper.ToGuidString(fixture.Admin.UserId));

        applied.Status.Should().Be("APPLIED");
        applied.Version.Should().Be(2);
        fixture.Context.Inventoryissuelines.Single().MaterialRequestLineId.Should().Equal(fixture.DemandLine.RequestLineId);
        fixture.Context.Lifecycletransitions.Should().HaveCount(3);
        fixture.Context.Lifecycleoutboxmessages.Should().HaveCount(3);
        fixture.Context.Auditlogs.Should().HaveCount(3);
    }

    [Fact]
    public async Task ReviewAsync_ShouldRejectSelfReviewAndStaleVersionWithoutApplyingLineage()
    {
        await using var fixture = await Fixture.CreateAsync();
        var created = await fixture.Service.CreateAsync(new CreateLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-create-self",
            LegacyLineType = "ISSUE_LINE",
            LegacyLineId = GuidHelper.ToGuidString(fixture.IssueLine.IssueLineId),
            TargetLineId = GuidHelper.ToGuidString(fixture.DemandLine.RequestLineId),
            Reason = "Proposal cần review độc lập."
        }, GuidHelper.ToGuidString(fixture.Manager.UserId));

        var selfReview = () => fixture.Service.ReviewAsync(created.DispositionId, new ReviewLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-self-review",
            ExpectedVersion = 0,
            Approve = true,
            Reason = "Không hợp lệ."
        }, GuidHelper.ToGuidString(fixture.Manager.UserId));
        await selfReview.Should().ThrowAsync<BusinessRuleException>();

        var staleReview = () => fixture.Service.ReviewAsync(created.DispositionId, new ReviewLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-stale-review",
            ExpectedVersion = 9,
            Approve = true,
            Reason = "Không hợp lệ vì stale."
        }, GuidHelper.ToGuidString(fixture.SecondManager.UserId));
        await staleReview.Should().ThrowAsync<DbUpdateConcurrencyException>();
        fixture.Context.Inventoryissuelines.Single().MaterialRequestLineId.Should().BeNull();
        fixture.Context.Legacylinedispositions.Single().Status.Should().Be("PENDING_MANAGER_REVIEW");
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectCrossSourceTargetAndPreserveLegacyLine()
    {
        await using var fixture = await Fixture.CreateAsync();

        var create = () => fixture.Service.CreateAsync(new CreateLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-invalid-target",
            LegacyLineType = "ISSUE_LINE",
            LegacyLineId = GuidHelper.ToGuidString(fixture.IssueLine.IssueLineId),
            TargetLineId = GuidHelper.ToGuidString(fixture.WrongUnitDemandLine.RequestLineId),
            Reason = "Không được map khác unit/source."
        }, GuidHelper.ToGuidString(fixture.Admin.UserId));

        await create.Should().ThrowAsync<BusinessRuleException>();
        fixture.Context.Legacylinedispositions.Should().BeEmpty();
        fixture.Context.Inventoryissuelines.Single().MaterialRequestLineId.Should().BeNull();
    }

    [Fact]
    public async Task ReturnDisposition_ShouldMapOnlySourceIssueLineAfterIndependentApproval()
    {
        await using var fixture = await Fixture.CreateAsync();
        var candidate = (await fixture.Service.GetCandidatesAsync(
            "RETURN_LINE", GuidHelper.ToGuidString(fixture.ReturnLine.ReturnLineId))).Should().ContainSingle().Subject;

        var created = await fixture.Service.CreateAsync(new CreateLegacyLineageDispositionRequest
        {
            CommandId = "legacy-return-create-1",
            LegacyLineType = "RETURN_LINE",
            LegacyLineId = GuidHelper.ToGuidString(fixture.ReturnLine.ReturnLineId),
            TargetLineId = candidate.TargetLineId,
            Reason = "Đối chiếu phiếu trả với dòng xuất cùng chứng từ, nguyên liệu và đơn vị."
        }, GuidHelper.ToGuidString(fixture.Admin.UserId));
        var approved = await fixture.Service.ReviewAsync(created.DispositionId, new ReviewLegacyLineageDispositionRequest
        {
            CommandId = "legacy-return-review-1",
            ExpectedVersion = 0,
            Approve = true,
            Reason = "Manager đã kiểm tra chứng từ trả và dòng xuất nguồn."
        }, GuidHelper.ToGuidString(fixture.Manager.UserId));
        var applied = await fixture.Service.ApplyAsync(created.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = "legacy-return-apply-1",
            ExpectedVersion = approved.Version,
            Reason = "Áp dụng source issue-line đã duyệt."
        }, GuidHelper.ToGuidString(fixture.Admin.UserId));

        applied.Status.Should().Be("APPLIED");
        fixture.ReturnLine.SourceIssueLineId.Should().Equal(fixture.IssueLine.IssueLineId);
        fixture.IssueLine.MaterialRequestLineId.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_ShouldReplaySameCommandWithoutSecondProposal()
    {
        await using var fixture = await Fixture.CreateAsync();
        var request = CreateIssueRequest(fixture, "legacy-issue-create-replay");

        var created = await fixture.Service.CreateAsync(request, GuidHelper.ToGuidString(fixture.Admin.UserId));
        var replayed = await fixture.Service.CreateAsync(request, GuidHelper.ToGuidString(fixture.Admin.UserId));

        replayed.DispositionId.Should().Be(created.DispositionId);
        fixture.Context.Legacylinedispositions.Should().ContainSingle();
        fixture.Context.Lifecycletransitions.Should().ContainSingle();
        fixture.Context.Lifecyclecommandreceipts.Should().ContainSingle();
    }

    [Fact]
    public async Task ReviewAsync_ShouldRejectNonManagerAndRejectedProposalCannotApply()
    {
        await using var fixture = await Fixture.CreateAsync();
        var created = await fixture.Service.CreateAsync(
            CreateIssueRequest(fixture, "legacy-issue-create-reject"), GuidHelper.ToGuidString(fixture.Admin.UserId));

        var nonManagerReview = () => fixture.Service.ReviewAsync(created.DispositionId, new ReviewLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-non-manager-review",
            ExpectedVersion = 0,
            Approve = true,
            Reason = "Không có quyền duyệt."
        }, GuidHelper.ToGuidString(fixture.NonManager.UserId));
        await nonManagerReview.Should().ThrowAsync<UnauthorizedAccessException>();

        var rejected = await fixture.Service.ReviewAsync(created.DispositionId, new ReviewLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-reject",
            ExpectedVersion = 0,
            Approve = false,
            Reason = "Manager từ chối do chứng từ chưa đủ bằng chứng."
        }, GuidHelper.ToGuidString(fixture.Manager.UserId));
        var apply = () => fixture.Service.ApplyAsync(created.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-rejected-apply",
            ExpectedVersion = rejected.Version,
            Reason = "Không thể áp dụng proposal bị từ chối."
        }, GuidHelper.ToGuidString(fixture.Admin.UserId));

        await apply.Should().ThrowAsync<BusinessRuleException>();
        fixture.Context.Legacylinedispositions.Single().Status.Should().Be("REJECTED");
        fixture.IssueLine.MaterialRequestLineId.Should().BeNull();
    }

    [Fact]
    public async Task ApplyAsync_ShouldRejectWhenSourceWasMappedAfterApproval()
    {
        await using var fixture = await Fixture.CreateAsync();
        var created = await fixture.Service.CreateAsync(
            CreateIssueRequest(fixture, "legacy-issue-create-apply-conflict"), GuidHelper.ToGuidString(fixture.Admin.UserId));
        var approved = await fixture.Service.ReviewAsync(created.DispositionId, new ReviewLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-review-apply-conflict",
            ExpectedVersion = 0,
            Approve = true,
            Reason = "Manager đã duyệt trước khi source được cập nhật bởi luồng khác."
        }, GuidHelper.ToGuidString(fixture.Manager.UserId));
        fixture.IssueLine.MaterialRequestLineId = GuidHelper.NewId();
        await fixture.Context.SaveChangesAsync();

        var apply = () => fixture.Service.ApplyAsync(created.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-apply-conflict",
            ExpectedVersion = approved.Version,
            Reason = "Không được ghi đè provenance do luồng khác đã cập nhật."
        }, GuidHelper.ToGuidString(fixture.Admin.UserId));

        await apply.Should().ThrowAsync<BusinessRuleException>();
        fixture.Context.Legacylinedispositions.Single().Status.Should().Be("APPROVED");
        fixture.IssueLine.MaterialRequestLineId.Should().NotEqual(fixture.DemandLine.RequestLineId);
    }

    [Fact]
    public async Task ApplyAsync_ShouldUseTransactionalDefaultModeVersionFence()
    {
        await using var fixture = await Fixture.CreateAsync();
        var created = await fixture.Service.CreateAsync(
            CreateIssueRequest(fixture, "legacy-issue-create-protected"), GuidHelper.ToGuidString(fixture.Admin.UserId));
        var approved = await fixture.Service.ReviewAsync(created.DispositionId, new ReviewLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-review-protected",
            ExpectedVersion = 0,
            Approve = true,
            Reason = "Manager approved exact evidence."
        }, GuidHelper.ToGuidString(fixture.Manager.UserId));
        var runner = new ProtectedTransactionRunner();
        var requestContext = new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.Default,
            OperationKey = "legacylineagedispositions.apply",
            ExpectedModeVersion = 17,
            Disposition = OperationDisposition.Retained,
        };
        var service = new LegacyLineageDispositionService(
            fixture.Context, runner, new LifecycleTransitionRecorder(fixture.Context), requestContext);

        var applied = await service.ApplyAsync(created.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = "legacy-issue-apply-protected",
            ExpectedVersion = approved.Version,
            Reason = "Apply only under the captured DEFAULT authority."
        }, GuidHelper.ToGuidString(fixture.Admin.UserId));

        applied.Status.Should().Be("APPLIED");
        runner.OperationKey.Should().Be("legacylineagedispositions.apply");
        runner.ExpectedModeVersion.Should().Be(17);
        runner.ProtectedExecutionCount.Should().Be(1);
    }

    [Fact]
    public async Task EveryOperation_ShouldRejectWhileMaterialReconciliationIsActiveWithoutWrites()
    {
        await using var fixture = await Fixture.CreateAsync();
        var before = Snapshot(fixture.Context);
        var requestContext = new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.MaterialReconciliation,
            OperationKey = "legacylineagedispositions.create",
            ExpectedModeVersion = 18,
            Disposition = OperationDisposition.Retained,
        };
        var service = new LegacyLineageDispositionService(
            fixture.Context, new ProtectedTransactionRunner(), new LifecycleTransitionRecorder(fixture.Context), requestContext);

        var list = () => service.GetAsync();
        var candidates = () => service.GetCandidatesAsync("ISSUE_LINE", GuidHelper.ToGuidString(fixture.IssueLine.IssueLineId));
        var create = () => service.CreateAsync(
            CreateIssueRequest(fixture, "legacy-issue-create-inactive"), GuidHelper.ToGuidString(fixture.Admin.UserId));

        await list.Should().ThrowAsync<BusinessRuleException>();
        await candidates.Should().ThrowAsync<BusinessRuleException>();
        await create.Should().ThrowAsync<BusinessRuleException>();
        Snapshot(fixture.Context).Should().BeEquivalentTo(before);
    }

    private static object Snapshot(IpcManagementContext context) => new
    {
        Dispositions = context.Legacylinedispositions.Count(),
        Transitions = context.Lifecycletransitions.Count(),
        Outbox = context.Lifecycleoutboxmessages.Count(),
        Receipts = context.Lifecyclecommandreceipts.Count(),
        Audits = context.Auditlogs.Count(),
        Lineage = context.Inventoryissuelines.Single().MaterialRequestLineId,
    };

    [Fact]
    public async Task OpenProposalDatabaseFence_ShouldRejectSecondActiveProposal()
    {
        await using var fixture = await Fixture.CreateAsync();
        await fixture.Service.CreateAsync(
            CreateIssueRequest(fixture, "legacy-issue-create-fence"), GuidHelper.ToGuidString(fixture.Admin.UserId));

        fixture.Context.Legacylinedispositions.Add(new LegacyLineageDisposition
        {
            DispositionId = GuidHelper.NewId(),
            LegacyLineType = "ISSUE_LINE",
            LegacyLineId = fixture.IssueLine.IssueLineId,
            TargetMaterialRequestLineId = fixture.DemandLine.RequestLineId,
            Status = "PENDING_MANAGER_REVIEW",
            Reason = "Second concurrent proposal must be rejected by the database fence.",
            CreatedBy = fixture.Admin.UserId,
            CreatedAt = DateTime.UtcNow,
            Version = 0,
        });

        var save = () => fixture.Context.SaveChangesAsync();
        await save.Should().ThrowAsync<DbUpdateException>();
    }

    private static CreateLegacyLineageDispositionRequest CreateIssueRequest(Fixture fixture, string commandId) => new()
    {
        CommandId = commandId,
        LegacyLineType = "ISSUE_LINE",
        LegacyLineId = GuidHelper.ToGuidString(fixture.IssueLine.IssueLineId),
        TargetLineId = GuidHelper.ToGuidString(fixture.DemandLine.RequestLineId),
        Reason = "Proposal đối soát lineage legacy cần Manager review độc lập.",
    };

    [Fact]
    public async Task Model_ShouldUseGeneratedOpenDispositionFenceAndValidatedTypeTarget()
    {
        await using var fixture = await Fixture.CreateAsync();
        var entity = fixture.Context.Model.FindEntityType(typeof(LegacyLineageDisposition))!;

        entity.FindProperty("OpenDispositionKey")!.GetComputedColumnSql()
            .Should().Contain("PENDING_MANAGER_REVIEW");
        entity.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.GetDatabaseName() == "uxLegacyLineageDispositionsOpenLine" &&
            index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { "LegacyLineType", "LegacyLineId", "OpenDispositionKey" }));
    }

    private sealed class ProtectedTransactionRunner : IEfTransactionRunner
    {
        public string? OperationKey { get; private set; }
        public long ExpectedModeVersion { get; private set; }
        public int ProtectedExecutionCount { get; private set; }

        public Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
            => operation(cancellationToken);

        public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
            => operation(cancellationToken);

        public Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion, Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
        {
            OperationKey = operationKey;
            ExpectedModeVersion = expectedModeVersion;
            ProtectedExecutionCount++;
            return operation(cancellationToken);
        }
    }

    private sealed class Fixture : IAsyncDisposable, IDisposable
    {
        private readonly SqliteConnection _connection;

        private Fixture(IpcManagementContext context, SqliteConnection connection)
        {
            Context = context;
            _connection = connection;
            Service = new LegacyLineageDispositionService(context, new ImmediateTransactionRunner(), new LifecycleTransitionRecorder(context));
        }

        public IpcManagementContext Context { get; }
        public LegacyLineageDispositionService Service { get; }
        public User Admin { get; private set; } = null!;
        public User Manager { get; private set; } = null!;
        public User SecondManager { get; private set; } = null!;
        public User NonManager { get; private set; } = null!;
        public InventoryIssueLine IssueLine { get; private set; } = null!;
        public MaterialRequestLine DemandLine { get; private set; } = null!;
        public MaterialRequestLine WrongUnitDemandLine { get; private set; } = null!;
        public InventoryReturnLine ReturnLine { get; private set; } = null!;

        public static async Task<Fixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            await CreateSchemaAsync(connection);
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;
            var fixture = new Fixture(new IpcManagementContext(options), connection);
            await fixture.SeedAsync();
            return fixture;
        }

        private async Task SeedAsync()
        {
            var adminRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "ADMIN", RoleName = "Admin" };
            var managerRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "MANAGER", RoleName = "Manager" };
            var chefRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "CHEF", RoleName = "Bếp trưởng" };
            Admin = CreateUser(adminRole, "admin");
            Manager = CreateUser(managerRole, "manager-1");
            SecondManager = CreateUser(managerRole, "manager-2");
            NonManager = CreateUser(chefRole, "chef-1");

            var ingredientId = GuidHelper.NewId();
            var unitId = GuidHelper.NewId();
            var request = new MaterialRequest
            {
                RequestId = GuidHelper.NewId(),
                RequestCode = "MR-LEGACY-1",
                PlanId = GuidHelper.NewId(),
                RequestDate = new DateOnly(2026, 8, 9),
                RequestScope = "SHIFT",
                Status = "MANAGERAPPROVED",
                CreatedBy = Admin.UserId,
            };
            DemandLine = new MaterialRequestLine
            {
                RequestLineId = GuidHelper.NewId(),
                RequestId = request.RequestId,
                PlanLineId = GuidHelper.NewId(),
                IngredientId = ingredientId,
                UnitId = unitId,
                BomScope = "global",
                AppliedPortionRuleSource = "CONTRACT_DEFAULT",
            };
            WrongUnitDemandLine = new MaterialRequestLine
            {
                RequestLineId = GuidHelper.NewId(),
                RequestId = request.RequestId,
                PlanLineId = GuidHelper.NewId(),
                IngredientId = ingredientId,
                UnitId = GuidHelper.NewId(),
                BomScope = "global",
                AppliedPortionRuleSource = "CONTRACT_DEFAULT",
            };
            request.Materialrequestlines.Add(DemandLine);
            request.Materialrequestlines.Add(WrongUnitDemandLine);
            var issue = new InventoryIssue
            {
                IssueId = GuidHelper.NewId(),
                IssueCode = "ISS-LEGACY-1",
                IssueDate = new DateOnly(2026, 8, 9),
                WarehouseId = GuidHelper.NewId(),
                MaterialRequestId = request.RequestId,
                IssuedBy = Admin.UserId,
                CreatedAt = DateTime.UtcNow,
            };
            IssueLine = new InventoryIssueLine
            {
                IssueLineId = GuidHelper.NewId(),
                IssueId = issue.IssueId,
                IngredientId = ingredientId,
                UnitId = unitId,
                RequestedQty = 4,
                IssuedQty = 4,
            };
            issue.Inventoryissuelines.Add(IssueLine);

            var returnDocument = new InventoryReturn
            {
                ReturnId = GuidHelper.NewId(),
                ReturnCode = "RET-LEGACY-1",
                ReturnDate = new DateOnly(2026, 8, 9),
                ReturnType = "WASTE",
                WarehouseId = issue.WarehouseId,
                IssueId = issue.IssueId,
                CreatedBy = Admin.UserId,
                CreatedAt = DateTime.UtcNow,
            };
            ReturnLine = new InventoryReturnLine
            {
                ReturnLineId = GuidHelper.NewId(),
                ReturnId = returnDocument.ReturnId,
                IngredientId = ingredientId,
                UnitId = unitId,
                Quantity = 1,
            };
            returnDocument.Inventoryreturnlines.Add(ReturnLine);

            Context.AddRange(adminRole, managerRole, chefRole, Admin, Manager, SecondManager, NonManager, request, issue, returnDocument);
            await Context.SaveChangesAsync();
        }

        private static User CreateUser(Role role, string username) => new()
        {
            UserId = GuidHelper.NewId(),
            FullName = username,
            Username = username,
            PasswordHash = "not-used",
            RoleId = role.RoleId,
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        public void Dispose()
        {
            Context.Dispose();
            _connection.Dispose();
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await _connection.DisposeAsync();
        }

        private static async Task CreateSchemaAsync(SqliteConnection connection)
        {
            var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE roles (
                    roleId BLOB PRIMARY KEY,
                    roleCode TEXT NOT NULL,
                    roleName TEXT NOT NULL
                );

                CREATE TABLE users (
                    userId BLOB PRIMARY KEY,
                    fullName TEXT NOT NULL,
                    username TEXT NOT NULL,
                    passwordHash TEXT NOT NULL,
                    roleId BLOB NOT NULL,
                    isActive INTEGER NOT NULL,
                    createdAt TEXT NOT NULL
                );

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

                CREATE TABLE materialrequestlines (
                    requestLineId BLOB PRIMARY KEY,
                    requestId BLOB NOT NULL,
                    planLineId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    bomId BLOB NULL,
                    priceTierAmount NUMERIC NOT NULL DEFAULT 25000,
                    bomScope TEXT NOT NULL DEFAULT 'global',
                    totalServings INTEGER NOT NULL,
                    grossQtyPerServing NUMERIC NOT NULL,
                    bomRatePercent NUMERIC NOT NULL DEFAULT 100,
                    appliedPortionRuleId BLOB NULL,
                    appliedPortionRuleSource TEXT NOT NULL DEFAULT 'CONTRACT_DEFAULT',
                    appliedPortionRatePercent NUMERIC NOT NULL DEFAULT 100,
                    yieldLossPercent NUMERIC NULL,
                    totalRequiredQty NUMERIC NOT NULL,
                    currentStockQty NUMERIC NOT NULL,
                    suggestedPurchaseQty NUMERIC NOT NULL
                );

                CREATE TABLE inventoryissues (
                    issueId BLOB PRIMARY KEY,
                    issueCode TEXT NOT NULL,
                    issueDate TEXT NOT NULL,
                    shiftName TEXT NULL,
                    warehouseId BLOB NOT NULL,
                    materialRequestId BLOB NULL,
                    reconciliationBatchId BLOB NULL,
                    issuedBy BLOB NOT NULL,
                    receivedBy BLOB NULL,
                    receivedAt TEXT NULL,
                    createdAt TEXT NOT NULL
                );

                CREATE TABLE inventoryissuelines (
                    issueLineId BLOB PRIMARY KEY,
                    issueId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    materialRequestLineId BLOB NULL,
                    reconciliationBatchLineId BLOB NULL,
                    requestedQty NUMERIC NOT NULL,
                    issuedQty NUMERIC NOT NULL
                );

                CREATE TABLE inventoryreturns (
                    returnId BLOB PRIMARY KEY,
                    returnCode TEXT NOT NULL,
                    returnDate TEXT NOT NULL,
                    shiftName TEXT NULL,
                    returnType TEXT NOT NULL,
                    warehouseId BLOB NOT NULL,
                    issueId BLOB NOT NULL,
                    reason TEXT NULL,
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL,
                    receivedBy BLOB NULL,
                    receivedAt TEXT NULL
                );

                CREATE TABLE inventoryreturnlines (
                    returnLineId BLOB PRIMARY KEY,
                    returnId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    sourceIssueLineId BLOB NULL,
                    quantity NUMERIC NOT NULL
                );

                CREATE TABLE legacylinedispositions (
                    dispositionId BLOB PRIMARY KEY,
                    legacyLineType TEXT NOT NULL,
                    legacyLineId BLOB NOT NULL,
                    targetMaterialRequestLineId BLOB NULL,
                    targetIssueLineId BLOB NULL,
                    status TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    reviewReason TEXT NULL,
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL,
                    reviewedBy BLOB NULL,
                    reviewedAt TEXT NULL,
                    appliedBy BLOB NULL,
                    appliedAt TEXT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    openDispositionKey INTEGER GENERATED ALWAYS AS (
                        CASE WHEN status IN ('PENDING_MANAGER_REVIEW', 'APPROVED') THEN 1 ELSE NULL END
                    ) VIRTUAL,
                    UNIQUE(legacyLineType, legacyLineId, openDispositionKey)
                );

                CREATE TABLE lifecycletransitions (
                    transitionId BLOB PRIMARY KEY,
                    aggregateType TEXT NOT NULL,
                    aggregateId BLOB NOT NULL,
                    commandId TEXT NOT NULL,
                    aggregateSequence INTEGER NOT NULL,
                    fromState TEXT NULL,
                    toState TEXT NOT NULL,
                    actorId BLOB NULL,
                    expectedVersion INTEGER NOT NULL,
                    reason TEXT NULL,
                    correlationId TEXT NULL,
                    causationId TEXT NULL,
                    payloadJson TEXT NOT NULL,
                    schemaVersion INTEGER NOT NULL DEFAULT 1,
                    createdAt TEXT NOT NULL
                );

                CREATE TABLE lifecycleoutboxmessages (
                    outboxMessageId BLOB PRIMARY KEY,
                    eventType TEXT NOT NULL,
                    aggregateType TEXT NOT NULL,
                    aggregateId BLOB NOT NULL,
                    aggregateSequence INTEGER NOT NULL,
                    commandId TEXT NOT NULL,
                    payloadJson TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    attemptCount INTEGER NOT NULL DEFAULT 0,
                    nextAttemptAt TEXT NULL,
                    lockedAt TEXT NULL,
                    processedAt TEXT NULL,
                    lastError TEXT NULL,
                    createdAt TEXT NOT NULL
                );

                CREATE TABLE lifecyclecommandreceipts (
                    commandReceiptId BLOB PRIMARY KEY,
                    commandId TEXT NOT NULL,
                    aggregateType TEXT NOT NULL,
                    aggregateId BLOB NOT NULL,
                    responseJson TEXT NOT NULL,
                    createdAt TEXT NOT NULL
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
        }
    }
}
