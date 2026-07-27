using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class BoundaryQueryServiceTests
{
    [Fact]
    public async Task PurchaseRequestQuery_Should_PreserveFiltersPagingAndDetailMapping()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"boundary-query-{Guid.NewGuid():N}")
            .Options;
        var approvedId = GuidHelper.NewId();
        await using (var context = new IpcManagementContext(options))
        {
            context.Purchaserequests.AddRange(
                CreatePurchaseRequest(approvedId, "PR-APPROVED", "APPROVED", new DateOnly(2026, 7, 21)),
                CreatePurchaseRequest(GuidHelper.NewId(), "PR-DRAFT", "DRAFT", new DateOnly(2026, 7, 20)));
            await context.SaveChangesAsync();
        }

        await using var queryContext = new IpcManagementContext(options);
        var service = new PurchaseRequestQueryService(queryContext);
        var page = await service.GetPurchaseRequestsPageAsync(new PurchaseRequestQueryDto
        {
            Status = " approved ",
            DateFrom = "2026-07-20",
            DateTo = "2026-07-22",
            PageNumber = 0,
            PageSize = 500
        });

        page.PageNumber.Should().Be(1);
        page.PageSize.Should().Be(100);
        page.TotalCount.Should().Be(1);
        page.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            PurchaseRequestId = GuidHelper.ToGuidString(approvedId),
            PurchaseRequestCode = "PR-APPROVED",
            PurchaseForDate = "2026-07-21",
            Status = "APPROVED"
        });

        var detail = await service.GetPurchaseRequestByIdAsync(approvedId);
        detail.Should().NotBeNull();
        detail!.PurchaseRequestCode.Should().Be("PR-APPROVED");
        detail.Lines.Should().BeEmpty();
    }

    [Fact]
    public async Task ApprovalHistoryQuery_Should_FilterTargetAndKeepChronologicalOrder()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        var actorId = GuidHelper.NewId();
        var targetId = GuidHelper.NewId();
        var actor = new User
        {
            UserId = actorId,
            FullName = "Approval Manager",
            Username = "approval.manager",
            PasswordHash = "not-used",
            RoleId = GuidHelper.NewId(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await using (var context = new IpcManagementContext(options))
        {
            await CreateApprovalHistorySchemaAsync(connection);
            context.Approvalhistories.AddRange(
                CreateHistory(GuidHelper.NewId(), targetId, actor, "REJECT", new DateTime(2026, 7, 21, 9, 0, 0)),
                CreateHistory(GuidHelper.NewId(), targetId, actor, "APPROVE", new DateTime(2026, 7, 21, 8, 0, 0)),
                CreateHistory(GuidHelper.NewId(), GuidHelper.NewId(), actor, "APPROVE", new DateTime(2026, 7, 21, 7, 0, 0)));
            await context.SaveChangesAsync();
        }

        await using var queryContext = new IpcManagementContext(options);
        var storedHistory = await queryContext.Approvalhistories.AsNoTracking().ToListAsync();
        storedHistory.Should().HaveCount(3);
        storedHistory.Count(item => item.TargetId.SequenceEqual(targetId)).Should().Be(2);
        var result = await new ApprovalHistoryQueryService(queryContext)
            .GetHistoryAsync("material-demand", targetId);

        result.Should().HaveCount(2);
        result.Select(item => item.Decision).Should().ContainInOrder("APPROVE", "REJECT");
        result.Should().OnlyContain(item => item.ActionByName == "Approval Manager");
    }

    private static async Task CreateApprovalHistorySchemaAsync(SqliteConnection connection)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE users (
                userId BLOB PRIMARY KEY,
                username TEXT NOT NULL,
                passwordHash TEXT NOT NULL,
                fullName TEXT NOT NULL,
                roleId BLOB NOT NULL,
                isActive INTEGER NULL,
                createdAt TEXT NOT NULL
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

    private static PurchaseRequest CreatePurchaseRequest(
        byte[] id,
        string code,
        string status,
        DateOnly purchaseForDate)
        => new()
        {
            PurchaseRequestId = id,
            PurchaseRequestCode = code,
            RequestDate = purchaseForDate,
            PurchaseForDate = purchaseForDate,
            ShiftName = "FULLDAY",
            Status = status,
            CreatedBy = GuidHelper.NewId()
        };

    private static ApprovalHistory CreateHistory(
        byte[] id,
        byte[] targetId,
        User actor,
        string decision,
        DateTime actionAt)
        => new()
        {
            ApprovalHistoryId = id,
            TargetType = "material-demand",
            TargetId = targetId,
            Decision = decision,
            OldStatus = "DRAFT",
            NewStatus = decision == "APPROVE" ? "APPROVED" : "REJECTED",
            ActionBy = actor.UserId,
            ActionByNavigation = actor,
            ActionAt = actionAt
        };
}
