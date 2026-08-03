using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Tests;

public sealed class WeeklyMenuImportBatchTests
{
    [Fact]
    public async Task CommitPreparedBatchAsync_Should_RollBackFirstCustomer_ThenRetryOnceWithoutDuplicates()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await CreateSchemaAsync(connection);
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new IpcManagementContext(options);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var ticketStore = new WeeklyMenuImportPreviewTicketStore(cache);
        var persistence = new FailingBatchPersistence(context) { FailSecondCustomer = true };
        var service = CreateService(context, persistence, ticketStore, cache);
        var prepared = CreatePreparedBatch(ticketStore);

        var failed = () => service.CommitPreparedBatchAsync(prepared, null, CancellationToken.None);

        await failed.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*CUS-02*Không file nào trong batch được lưu.*");
        await using (var freshAfterFailure = new IpcManagementContext(options))
        {
            (await freshAfterFailure.Menuversions.AsNoTracking().CountAsync()).Should().Be(0);
        }

        persistence.FailSecondCustomer = false;
        persistence.ResetAttempt();
        var retried = await service.CommitPreparedBatchAsync(prepared, null, CancellationToken.None);

        retried.Should().HaveCount(2);
        await using (var freshAfterRetry = new IpcManagementContext(options))
        {
            (await freshAfterRetry.Menuversions.AsNoTracking().CountAsync()).Should().Be(2);
        }

        var replay = () => service.CommitPreparedBatchAsync(prepared, null, CancellationToken.None);
        await replay.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Phiên xem trước đã hết hạn hoặc không còn hợp lệ. Vui lòng kiểm tra lại file.");
        await using var freshAfterReplay = new IpcManagementContext(options);
        (await freshAfterReplay.Menuversions.AsNoTracking().CountAsync()).Should().Be(2);
    }

    private static WeeklyMenuImportService CreateService(
        IpcManagementContext context,
        IWeeklyMenuImportPersistence persistence,
        WeeklyMenuImportPreviewTicketStore ticketStore,
        IMemoryCache cache)
        => new(
            context,
            new WeeklyMenuCustomerResolver(context),
            new WeeklyMenuImportResultBuilder(context),
            persistence,
            ticketStore,
            new EfTransactionRunner(context),
            cache);

    private static IReadOnlyList<PreparedWeeklyMenuImport> CreatePreparedBatch(
        WeeklyMenuImportPreviewTicketStore ticketStore)
    {
        var week = new DateOnly(2026, 8, 3);
        return Enumerable.Range(1, 2).Select(index =>
        {
            var customer = new Customer
            {
                CustomerId = GuidHelper.NewId(),
                CustomerCode = $"CUS-0{index}",
                CustomerName = $"Customer {index}",
                IsActive = true
            };
            var checksum = $"CHECKSUM-{index}";
            var plan = new WeeklyMenuImportPlan(
                $"customer-{index}.xlsx",
                "25000",
                "A",
                week,
                week.AddDays(6),
                1,
                [],
                week)
            {
                SourceChecksum = checksum
            };
            var ticket = ticketStore.Issue(
                checksum,
                GuidHelper.ToGuidString(customer.CustomerId),
                week,
                25000m);
            return new PreparedWeeklyMenuImport(plan, customer, 25000m, ticket.Token);
        }).ToList();
    }

    private static async Task CreateSchemaAsync(SqliteConnection connection)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE menuversions (
                menuVersionId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                weekStartDate TEXT NOT NULL,
                versionNo INTEGER NOT NULL,
                status TEXT NOT NULL,
                sourceFileName TEXT NULL,
                sourceChecksum TEXT NULL,
                sourceImportBatch TEXT NULL,
                createdBy BLOB NULL,
                createdAt TEXT NOT NULL,
                publishedBy BLOB NULL,
                publishedAt TEXT NULL,
                updatedAt TEXT NOT NULL,
                successRowCount INTEGER NOT NULL DEFAULT 0,
                errorRowCount INTEGER NOT NULL DEFAULT 0,
                warningRowCount INTEGER NOT NULL DEFAULT 0
            );
            """;
        await command.ExecuteNonQueryAsync();
    }

    private sealed class FailingBatchPersistence(IpcManagementContext context) : IWeeklyMenuImportPersistence
    {
        private int _customerNumber;
        public bool FailSecondCustomer { get; set; }

        public void ResetAttempt() => _customerNumber = 0;

        public Task<WeeklyMenuImportResultDto> CommitAsync(
            WeeklyMenuImportPlan plan,
            Customer customer,
            decimal priceTierAmount,
            string? actorUserId,
            CancellationToken cancellationToken)
        {
            _customerNumber++;
            if (FailSecondCustomer && _customerNumber == 2)
            {
                throw new BusinessRuleException("Lỗi cưỡng bức ở khách hàng thứ hai.");
            }

            var menuVersionId = GuidHelper.NewId();
            context.Menuversions.Add(new MenuVersion
            {
                MenuVersionId = menuVersionId,
                CustomerId = customer.CustomerId,
                WeekStartDate = plan.WeekStartDate,
                VersionNo = 1,
                Status = "DRAFT",
                SourceFileName = plan.FileName,
                SourceChecksum = plan.SourceChecksum,
                SourceImportBatch = $"BATCH-{customer.CustomerCode}",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            return Task.FromResult(new WeeklyMenuImportResultDto
            {
                Committed = true,
                CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
                CustomerCode = customer.CustomerCode,
                MenuVersionId = GuidHelper.ToGuidString(menuVersionId),
                SourceChecksum = plan.SourceChecksum
            });
        }
    }
}
