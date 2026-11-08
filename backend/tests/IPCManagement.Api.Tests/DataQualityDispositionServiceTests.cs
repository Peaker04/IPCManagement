using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Infrastructure.Lifecycle;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class DataQualityDispositionServiceTests
{
    [Fact]
    public async Task Disposition_RequiresSeparatedActorsCurrentVersionAndMatchingAppendOnlyCorrection()
    {
        await using var fixture = await Fixture.CreateAsync();
        var created = await fixture.DispositionService.CreateAsync(new CreateDataQualityDispositionRequest(
            "UNIT_NORMALIZATION",
            GuidHelper.ToGuidString(fixture.Review.ReviewId),
            fixture.SourceFingerprint,
            "RETAIN_DISTINCT_WITH_SOURCE_EVIDENCE",
            fixture.EvidenceJson,
            "Admin records the reviewed source row without changing catalog data.",
            "dq-create-1"), GuidHelper.ToGuidString(fixture.Admin.UserId));

        created.Status.Should().Be("PENDING_MANAGER_REVIEW");
        var createReplay = await fixture.DispositionService.CreateAsync(new CreateDataQualityDispositionRequest(
            "UNIT_NORMALIZATION", GuidHelper.ToGuidString(fixture.Review.ReviewId), fixture.SourceFingerprint,
            "RETAIN_DISTINCT_WITH_SOURCE_EVIDENCE", fixture.EvidenceJson,
            "Admin records the reviewed source row without changing catalog data.", "dq-create-1"),
            GuidHelper.ToGuidString(fixture.Admin.UserId));
        createReplay.Should().BeEquivalentTo(created);

        var unauthorizedReview = () => fixture.DispositionService.ReviewAsync(created.DispositionId,
            new ReviewDataQualityDispositionRequest("APPROVE", "Admin cannot review.", 0, "dq-review-admin"),
            GuidHelper.ToGuidString(fixture.Admin.UserId));
        await unauthorizedReview.Should().ThrowAsync<UnauthorizedAccessException>();

        var staleReview = () => fixture.DispositionService.ReviewAsync(created.DispositionId,
            new ReviewDataQualityDispositionRequest("APPROVE", "Stale review must not write.", 9, "dq-review-stale"),
            GuidHelper.ToGuidString(fixture.Manager.UserId));
        await staleReview.Should().ThrowAsync<DbUpdateConcurrencyException>();

        var approved = await fixture.DispositionService.ReviewAsync(created.DispositionId,
            new ReviewDataQualityDispositionRequest("APPROVE", "Manager verified the source evidence.", 0, "dq-review-1"),
            GuidHelper.ToGuidString(fixture.Manager.UserId));
        approved.Status.Should().Be("APPROVED");

        var invalidCorrection = () => fixture.DispositionService.ApplyAsync(created.DispositionId,
            new ApplyDataQualityDispositionRequest(nameof(UnitNormalizationReview), GuidHelper.ToGuidString(GuidHelper.NewId()),
                "Missing correction must fail closed.", approved.Version, "dq-apply-invalid"),
            GuidHelper.ToGuidString(fixture.Admin.UserId));
        await invalidCorrection.Should().ThrowAsync<BusinessRuleException>();

        fixture.Review.Status = "RETAIN_DISTINCT";
        await fixture.Context.SaveChangesAsync();
        var applied = await fixture.DispositionService.ApplyAsync(created.DispositionId,
            new ApplyDataQualityDispositionRequest(nameof(UnitNormalizationReview), GuidHelper.ToGuidString(fixture.Review.ReviewId),
                "Link the independently reviewed append-only decision.", approved.Version, "dq-apply-1"),
            GuidHelper.ToGuidString(fixture.Admin.UserId));

        applied.Status.Should().Be("APPLIED");
        applied.Version.Should().Be(2);
        fixture.Context.Lifecycletransitions.Should().HaveCount(3);
        fixture.Context.Dataqualitydispositions.Should().ContainSingle(item => item.Status == "APPLIED");

        var applyReplay = await fixture.DispositionService.ApplyAsync(created.DispositionId,
            new ApplyDataQualityDispositionRequest(nameof(UnitNormalizationReview), GuidHelper.ToGuidString(fixture.Review.ReviewId),
                "Replay returns the durable command receipt.", approved.Version, "dq-apply-1"),
            GuidHelper.ToGuidString(fixture.Admin.UserId));
        applyReplay.Should().BeEquivalentTo(applied);
        fixture.Context.Lifecycletransitions.Should().HaveCount(3);
    }

    [Fact]
    public async Task UnitDecision_RequiresManagerEvidencePositiveFactorAndCompatibleBaseFamily()
    {
        await using var fixture = await Fixture.CreateAsync();

        var unauthorized = () => fixture.UnitService.DecideAsync(
            GuidHelper.ToGuidString(fixture.Review.ReviewId),
            new UnitNormalizationReviewDecisionRequest("BLOCK", "catalog", "Reviewed evidence.", null, null),
            GuidHelper.ToGuidString(fixture.Admin.UserId));
        await unauthorized.Should().ThrowAsync<UnauthorizedAccessException>();

        var missingEvidence = () => fixture.UnitService.DecideAsync(
            GuidHelper.ToGuidString(fixture.Review.ReviewId),
            new UnitNormalizationReviewDecisionRequest("CONFIRM", "", "", 1000m, null),
            GuidHelper.ToGuidString(fixture.Manager.UserId));
        await missingEvidence.Should().ThrowAsync<ArgumentException>();

        var nonPositiveFactor = () => fixture.UnitService.DecideAsync(
            GuidHelper.ToGuidString(fixture.Review.ReviewId),
            new UnitNormalizationReviewDecisionRequest("CONFIRM", "catalog", "Reviewed evidence.", 0m, null),
            GuidHelper.ToGuidString(fixture.Manager.UserId));
        await nonPositiveFactor.Should().ThrowAsync<ArgumentException>();

        fixture.Review.CatalogUnit.BaseUnitCode = "ML";
        await fixture.Context.SaveChangesAsync();
        var incompatibleFamily = () => fixture.UnitService.DecideAsync(
            GuidHelper.ToGuidString(fixture.Review.ReviewId),
            new UnitNormalizationReviewDecisionRequest("CONFIRM", "catalog", "Reviewed evidence.", 1000m, null),
            GuidHelper.ToGuidString(fixture.Manager.UserId));
        await incompatibleFamily.Should().ThrowAsync<InvalidOperationException>();

        fixture.Review.CatalogUnit.BaseUnitCode = "G";
        await fixture.Context.SaveChangesAsync();

        var retainedDistinct = await fixture.UnitService.DecideAsync(
            GuidHelper.ToGuidString(fixture.Review.ReviewId),
            new UnitNormalizationReviewDecisionRequest("RETAIN_DISTINCT", "catalog-owner/specification-44",
                "Authoritative specification confirms these units must remain distinct.", null, null),
            GuidHelper.ToGuidString(fixture.Manager.UserId));

        retainedDistinct.Status.Should().Be("RETAIN_DISTINCT");
        retainedDistinct.EvidenceSource.Should().Be("catalog-owner/specification-44");
        fixture.Context.Auditlogs.Should().ContainSingle(item => item.NewValue == "RETAIN_DISTINCT");
    }

    [Fact]
    public async Task Disposition_RequiresObjectEvidenceAndExistingSource()
    {
        await using var fixture = await Fixture.CreateAsync();

        var invalidEvidence = () => fixture.DispositionService.CreateAsync(new CreateDataQualityDispositionRequest(
            "UNIT_NORMALIZATION", GuidHelper.ToGuidString(fixture.Review.ReviewId), fixture.SourceFingerprint,
            "RETAIN_DISTINCT_WITH_SOURCE_EVIDENCE", "[]",
            "Evidence must remain an object.", "dq-create-invalid-evidence"),
            GuidHelper.ToGuidString(fixture.Admin.UserId));
        await invalidEvidence.Should().ThrowAsync<ArgumentException>();

        var missingSource = () => fixture.DispositionService.CreateAsync(new CreateDataQualityDispositionRequest(
            "UNIT_NORMALIZATION", GuidHelper.ToGuidString(GuidHelper.NewId()), fixture.SourceFingerprint,
            "RETAIN_DISTINCT_WITH_SOURCE_EVIDENCE", fixture.EvidenceJson,
            "Missing source must fail closed.", "dq-create-missing-source"),
            GuidHelper.ToGuidString(fixture.Admin.UserId));
        await missingSource.Should().ThrowAsync<KeyNotFoundException>();
        fixture.Context.Dataqualitydispositions.Should().BeEmpty();
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;

        private Fixture(IpcManagementContext context, SqliteConnection connection)
        {
            Context = context;
            _connection = connection;
            DispositionService = new DataQualityDispositionService(
                context, new ImmediateTransactionRunner(), new LifecycleTransitionRecorder(context));
            UnitService = new UnitNormalizationReviewService(context);
        }

        public IpcManagementContext Context { get; }
        public DataQualityDispositionService DispositionService { get; }
        public UnitNormalizationReviewService UnitService { get; }
        public User Admin { get; private set; } = null!;
        public User Manager { get; private set; } = null!;
        public UnitNormalizationReview Review { get; private set; } = null!;
        public string SourceFingerprint { get; private set; } = null!;
        public string EvidenceJson { get; private set; } = null!;

        public static async Task<Fixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            await CreateSchemaAsync(connection);
            var context = new IpcManagementContext(new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection).Options);
            var fixture = new Fixture(context, connection);
            await fixture.SeedAsync();
            return fixture;
        }

        private async Task SeedAsync()
        {
            var adminRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "ADMIN", RoleName = "Admin" };
            var managerRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "MANAGER", RoleName = "Manager" };
            Admin = CreateUser(adminRole, "admin-dq");
            Manager = CreateUser(managerRole, "manager-dq");
            var sourceUnit = new Unit
            {
                UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram",
                BaseUnitCode = "G", ConvertRateToBase = 1000m
            };
            var catalogUnit = new Unit
            {
                UnitId = GuidHelper.NewId(), UnitCode = "G", UnitName = "Gram",
                BaseUnitCode = "G", ConvertRateToBase = 1m
            };
            var ingredient = new Ingredient
            {
                IngredientId = GuidHelper.NewId(), IngredientCode = "ING-DQ", IngredientName = "Ingredient DQ",
                UnitId = catalogUnit.UnitId, WarehouseId = GuidHelper.NewId(), ReferencePrice = 1m,
                IsFreshDaily = false, IsActive = true, Unit = catalogUnit
            };
            Review = new UnitNormalizationReview
            {
                ReviewId = GuidHelper.NewId(), IngredientId = ingredient.IngredientId,
                SourceUnitId = sourceUnit.UnitId, CatalogUnitId = catalogUnit.UnitId,
                SourceUnit = sourceUnit, CatalogUnit = catalogUnit, Ingredient = ingredient,
                Confidence = "BLOCKED", Status = "NEEDS_CONFIRMATION",
                EvidenceSource = "classification", EvidenceNote = "Awaiting evidence.",
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            Context.AddRange(adminRole, managerRole, Admin, Manager, sourceUnit, catalogUnit, ingredient, Review);
            await Context.SaveChangesAsync();

            SourceFingerprint = new string('A', 64);
            EvidenceJson = """{"source":"catalog/specification/44","note":"retain distinct"}""";
        }

        private static User CreateUser(Role role, string username) => new()
        {
            UserId = GuidHelper.NewId(), FullName = username, Username = username,
            PasswordHash = "not-used", RoleId = role.RoleId, Role = role,
            IsActive = true, CreatedAt = DateTime.UtcNow
        };

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await _connection.DisposeAsync();
        }

        private static async Task CreateSchemaAsync(SqliteConnection connection)
        {
            var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE roles (roleId BLOB PRIMARY KEY, roleCode TEXT NOT NULL, roleName TEXT NOT NULL);
                CREATE TABLE users (userId BLOB PRIMARY KEY, fullName TEXT NOT NULL, username TEXT NOT NULL,
                    passwordHash TEXT NOT NULL, roleId BLOB NOT NULL, isActive INTEGER NOT NULL, createdAt TEXT NOT NULL);
                CREATE TABLE units (unitId BLOB PRIMARY KEY, unitCode TEXT NOT NULL UNIQUE, unitName TEXT NOT NULL,
                    baseUnitCode TEXT NULL, convertRateToBase NUMERIC NOT NULL);
                CREATE TABLE ingredients (ingredientId BLOB PRIMARY KEY, ingredientCode TEXT NOT NULL UNIQUE,
                    ingredientName TEXT NOT NULL, unitId BLOB NOT NULL, warehouseId BLOB NOT NULL,
                    referencePrice NUMERIC NOT NULL, isFreshDaily INTEGER NOT NULL, isActive INTEGER NOT NULL);
                CREATE TABLE unitnormalizationreviews (reviewId BLOB PRIMARY KEY, ingredientId BLOB NOT NULL,
                    sourceUnitId BLOB NOT NULL, catalogUnitId BLOB NOT NULL, recommendedUnitId BLOB NULL,
                    observedStockQty NUMERIC NULL, sourceReceiptCount INTEGER NOT NULL, catalogReceiptCount INTEGER NOT NULL,
                    bomLineCount INTEGER NOT NULL, proposedSourceToCatalogFactor NUMERIC NULL, confidence TEXT NOT NULL,
                    status TEXT NOT NULL, evidenceSource TEXT NOT NULL, evidenceNote TEXT NOT NULL, createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL, reviewedAt TEXT NULL, reviewedBy BLOB NULL);
                CREATE TABLE dataqualitydispositions (dispositionId BLOB PRIMARY KEY, issueType TEXT NOT NULL,
                    sourceEntityId BLOB NOT NULL, sourceFingerprint TEXT NOT NULL, proposedAction TEXT NOT NULL,
                    evidenceJson TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, reviewReason TEXT NULL,
                    createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, reviewedBy BLOB NULL, reviewedAt TEXT NULL,
                    appliedBy BLOB NULL, appliedAt TEXT NULL, correctionEntityType TEXT NULL,
                    correctionEntityId BLOB NULL, version INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(issueType, sourceEntityId, sourceFingerprint));
                CREATE TABLE lifecycletransitions (transitionId BLOB PRIMARY KEY, aggregateType TEXT NOT NULL,
                    aggregateId BLOB NOT NULL, commandId TEXT NOT NULL UNIQUE, aggregateSequence INTEGER NOT NULL,
                    fromState TEXT NULL, toState TEXT NOT NULL, actorId BLOB NULL, expectedVersion INTEGER NOT NULL,
                    reason TEXT NULL, correlationId TEXT NULL, causationId TEXT NULL, payloadJson TEXT NOT NULL,
                    schemaVersion INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL);
                CREATE TABLE lifecycleoutboxmessages (outboxMessageId BLOB PRIMARY KEY, eventType TEXT NOT NULL,
                    aggregateType TEXT NOT NULL, aggregateId BLOB NOT NULL, aggregateSequence INTEGER NOT NULL,
                    commandId TEXT NOT NULL UNIQUE, payloadJson TEXT NOT NULL, status TEXT NOT NULL,
                    attemptCount INTEGER NOT NULL DEFAULT 0, nextAttemptAt TEXT NULL, lockedAt TEXT NULL,
                    processedAt TEXT NULL, lastError TEXT NULL, createdAt TEXT NOT NULL);
                CREATE TABLE lifecyclecommandreceipts (commandReceiptId BLOB PRIMARY KEY, commandId TEXT NOT NULL,
                    aggregateType TEXT NOT NULL, aggregateId BLOB NOT NULL, responseJson TEXT NOT NULL,
                    createdAt TEXT NOT NULL, UNIQUE(commandId, aggregateType, aggregateId));
                CREATE TABLE auditlogs (auditId BLOB PRIMARY KEY, changedAt TEXT NOT NULL, changedBy BLOB NOT NULL,
                    businessArea TEXT NOT NULL, entityName TEXT NOT NULL, entityId BLOB NULL, fieldName TEXT NULL,
                    oldValue TEXT NULL, newValue TEXT NULL, reason TEXT NULL, correlationId TEXT NULL);
                """;
            await command.ExecuteNonQueryAsync();
        }
    }
}
