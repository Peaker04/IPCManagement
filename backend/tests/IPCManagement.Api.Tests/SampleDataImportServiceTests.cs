using System.Reflection;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services.SampleData;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class SampleDataImportServiceTests
{
    [Theory]
    [InlineData("Kg", "KG")]
    [InlineData("Ký", "KG")]
    [InlineData("Thùng", "THUNG")]
    [InlineData("Bịch", "BICH")]
    public void NormalizeUnitCode_Should_Handle_CommonVietnameseUnits(string input, string expected)
    {
        var result = InvokePrivateStatic<string>("NormalizeUnitCode", input);

        result.Should().Be(expected);
    }

    [Fact]
    public void ParseDate_Should_Handle_ExcelSerial_AndVietnameseDateText()
    {
        var serialResult = InvokePrivateStatic<DateOnly?>("ParseDate", "45823");
        var textResult = InvokePrivateStatic<DateOnly?>("ParseDate", "Từ ngày 15/06/2026 đến ngày 20/06/2026");

        serialResult.Should().Be(new DateOnly(2025, 6, 15));
        textResult.Should().Be(new DateOnly(2026, 6, 15));
    }

    [Theory]
    [InlineData("MENU MẶN - CA SÁNG", "Mặn", "MORNING")]
    [InlineData("MENU CHAY- CA CHIỀU", "Chay", "AFTERNOON")]
    public void TryParseMenuSection_Should_Detect_VariantAndShift(string label, string variant, string shift)
    {
        var method = typeof(SampleDataImportService).GetMethod(
            "TryParseMenuSection",
            BindingFlags.NonPublic | BindingFlags.Static);
        var args = new object?[] { label, null, null };

        var parsed = (bool)method!.Invoke(null, args)!;

        parsed.Should().BeTrue();
        args[1].Should().Be(variant);
        args[2].Should().Be(shift);
    }

    [Fact]
    public async Task ResolveCustomerContractPolicy_Should_UseActiveContractForImportSchedule()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customercontracts (
                contractId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                effectiveFrom TEXT NOT NULL,
                effectiveTo TEXT NULL,
                activeWeekDays TEXT NOT NULL,
                shiftNames TEXT NOT NULL,
                defaultMenuPrice TEXT NOT NULL,
                defaultBomRatePercent TEXT NOT NULL,
                status TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();

        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new IpcManagementContext(options);
        var customerId = GuidHelper.NewId();
        context.Customercontracts.Add(new Customercontract
        {
            ContractId = GuidHelper.NewId(),
            CustomerId = customerId,
            EffectiveFrom = new DateOnly(2026, 6, 15),
            ActiveWeekDays = "t2,t3",
            ShiftNames = "MORNING",
            DefaultMenuPrice = 43000,
            DefaultBomRatePercent = 125,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new SampleDataImportService(context, null!);
        var method = typeof(SampleDataImportService).GetMethod(
            "ResolveCustomerContractPolicy",
            BindingFlags.NonPublic | BindingFlags.Instance);

        var result = method!.Invoke(service, [
            new Customer
            {
                CustomerId = customerId,
                CustomerCode = "CUS",
                CustomerName = "Customer",
                IsActive = true
            },
            new DateOnly(2026, 6, 15),
            "MORNING"
        ])!;

        GetProperty<decimal>(result, "MenuPrice").Should().Be(43000);
        GetProperty<decimal>(result, "BomRatePercent").Should().Be(125);
        GetProperty<bool>(result, "UsedFallback").Should().BeFalse();
    }

    [Fact]
    public async Task ResolveCustomerContractPolicy_Should_Fallback_WhenNoActiveContractMatches()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customercontracts (
                contractId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                effectiveFrom TEXT NOT NULL,
                effectiveTo TEXT NULL,
                activeWeekDays TEXT NOT NULL,
                shiftNames TEXT NOT NULL,
                defaultMenuPrice TEXT NOT NULL,
                defaultBomRatePercent TEXT NOT NULL,
                status TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();

        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new IpcManagementContext(options);
        var customerId = GuidHelper.NewId();

        var service = new SampleDataImportService(context, null!);
        var method = typeof(SampleDataImportService).GetMethod(
            "ResolveCustomerContractPolicy",
            BindingFlags.NonPublic | BindingFlags.Instance);

        var result = method!.Invoke(service, [
            new Customer
            {
                CustomerId = customerId,
                CustomerCode = "CUS",
                CustomerName = "Customer",
                IsActive = true
            },
            new DateOnly(2026, 6, 15),
            "MORNING"
        ])!;

        GetProperty<decimal>(result, "MenuPrice").Should().Be(25000);
        GetProperty<decimal>(result, "BomRatePercent").Should().Be(100);
        GetProperty<bool>(result, "UsedFallback").Should().BeTrue();
    }

    [Fact]
    public async Task ResolveCustomerContractPolicy_Should_IgnoreInactiveAndExpiredContracts()
    {
        var setup = await CreateContractPolicyContextAsync();
        await using var connection = setup.Connection;
        await using var context = setup.Context;
        var customerId = GuidHelper.NewId();
        context.Customercontracts.AddRange(
            new Customercontract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = customerId,
                EffectiveFrom = new DateOnly(2026, 6, 1),
                ActiveWeekDays = "t2",
                ShiftNames = "MORNING",
                DefaultMenuPrice = 48000,
                DefaultBomRatePercent = 120,
                Status = "INACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Customercontract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = customerId,
                EffectiveFrom = new DateOnly(2026, 6, 1),
                EffectiveTo = new DateOnly(2026, 6, 14),
                ActiveWeekDays = "t2",
                ShiftNames = "MORNING",
                DefaultMenuPrice = 49000,
                DefaultBomRatePercent = 130,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var result = InvokeContractPolicy(context, customerId, new DateOnly(2026, 6, 15), "MORNING");

        GetProperty<decimal>(result, "MenuPrice").Should().Be(25000);
        GetProperty<decimal>(result, "BomRatePercent").Should().Be(100);
        GetProperty<bool>(result, "UsedFallback").Should().BeTrue();
    }

    [Fact]
    public async Task ResolveCustomerContractPolicy_Should_ApplyNewEffectiveContractMidWeek()
    {
        var setup = await CreateContractPolicyContextAsync();
        await using var connection = setup.Connection;
        await using var context = setup.Context;
        var customerId = GuidHelper.NewId();
        context.Customercontracts.AddRange(
            new Customercontract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = customerId,
                EffectiveFrom = new DateOnly(2026, 6, 15),
                EffectiveTo = new DateOnly(2026, 6, 16),
                ActiveWeekDays = "t2,t3",
                ShiftNames = "MORNING",
                DefaultMenuPrice = 40000,
                DefaultBomRatePercent = 110,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Customercontract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = customerId,
                EffectiveFrom = new DateOnly(2026, 6, 17),
                ActiveWeekDays = "t4,t5,t6",
                ShiftNames = "MORNING",
                DefaultMenuPrice = 52000,
                DefaultBomRatePercent = 145,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var mondayPolicy = InvokeContractPolicy(context, customerId, new DateOnly(2026, 6, 15), "MORNING");
        var wednesdayPolicy = InvokeContractPolicy(context, customerId, new DateOnly(2026, 6, 17), "MORNING");

        GetProperty<decimal>(mondayPolicy, "MenuPrice").Should().Be(40000);
        GetProperty<decimal>(mondayPolicy, "BomRatePercent").Should().Be(110);
        GetProperty<bool>(mondayPolicy, "UsedFallback").Should().BeFalse();
        GetProperty<decimal>(wednesdayPolicy, "MenuPrice").Should().Be(52000);
        GetProperty<decimal>(wednesdayPolicy, "BomRatePercent").Should().Be(145);
        GetProperty<bool>(wednesdayPolicy, "UsedFallback").Should().BeFalse();
    }

    [Fact]
    public async Task PreviewWeeklyMenuImport_Should_ReturnValidationDto_WhenCustomerIsUnknown()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customers (
                customerId BLOB PRIMARY KEY,
                customerCode TEXT NOT NULL,
                customerName TEXT NOT NULL,
                note TEXT NULL,
                isActive INTEGER NULL
            );
            """;
        await command.ExecuteNonQueryAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new IpcManagementContext(options);
        var service = new SampleDataImportService(context, null!);
        await using var stream = new MemoryStream([1, 2, 3]);

        var result = await service.PreviewWeeklyMenuImportAsync(
            stream,
            "menu.xlsx",
            Guid.NewGuid().ToString(),
            new DateOnly(2026, 6, 15));

        result.Validation.HasCriticalErrors.Should().BeTrue();
        result.Validation.IsValid.Should().BeFalse();
        result.Validation.ErrorCount.Should().Be(1);
        result.Validation.Issues.Should().ContainSingle(issue =>
            issue.Code == "UNKNOWN_CUSTOMER" &&
            issue.Field == "customerId" &&
            issue.Severity == "error");
    }

    private static T InvokePrivateStatic<T>(string methodName, params object?[] args)
    {
        var method = typeof(SampleDataImportService).GetMethod(
            methodName,
            BindingFlags.NonPublic | BindingFlags.Static);

        method.Should().NotBeNull();
        return (T)method!.Invoke(null, args)!;
    }

    private static object InvokeContractPolicy(
        IpcManagementContext context,
        byte[] customerId,
        DateOnly serviceDate,
        string shiftName)
    {
        var service = new SampleDataImportService(context, null!);
        var method = typeof(SampleDataImportService).GetMethod(
            "ResolveCustomerContractPolicy",
            BindingFlags.NonPublic | BindingFlags.Instance);

        return method!.Invoke(service, [
            new Customer
            {
                CustomerId = customerId,
                CustomerCode = "CUS",
                CustomerName = "Customer",
                IsActive = true
            },
            serviceDate,
            shiftName
        ])!;
    }

    private static async Task<(SqliteConnection Connection, IpcManagementContext Context)> CreateContractPolicyContextAsync()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customercontracts (
                contractId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                effectiveFrom TEXT NOT NULL,
                effectiveTo TEXT NULL,
                activeWeekDays TEXT NOT NULL,
                shiftNames TEXT NOT NULL,
                defaultMenuPrice TEXT NOT NULL,
                defaultBomRatePercent TEXT NOT NULL,
                status TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();

        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        return (connection, new IpcManagementContext(options));
    }

    private static T GetProperty<T>(object instance, string propertyName)
    {
        var property = instance.GetType().GetProperty(propertyName);
        property.Should().NotBeNull();
        return (T)property!.GetValue(instance)!;
    }
}
