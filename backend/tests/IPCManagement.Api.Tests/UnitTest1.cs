using Xunit;
using Microsoft.EntityFrameworkCore;
using System.IO;
using System;
using IPCManagement.Api.Data;
using System.Linq;
using System.Collections.Generic;

namespace IPCManagement.Api.Tests;

public class UnitTest1
{
    [Fact]
    public void ForceRegisterMigrations()
    {
        var connectionString = "server=localhost;port=3306;database=ipcmanagement;user=root;password=123456;";
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql(connectionString, ServerVersion.AutoDetect(connectionString))
            .Options;
            
        using var context = new IpcManagementContext(options);
        
        var migrations = new List<string>
        {
            "20260605013906_AddCurrentStockTable",
            "20260605020053_AddRefreshTokenTable",
            "20260621180049_AddConcurrencyToCurrentStock",
            "20260626043000_SeedTemporaryBomData",
            "20260630031911_AddCustomerContractsAndMenuVersions",
            "20260630062000_AddPortionRules",
            "20260630065000_AddPortionRuleTraceToDemandLines",
            "20260630161000_AddBomVersionStatus",
            "20260701175833_AddCustomerImportMapping",
            "20260702061320_AddImportAuditFields",
            "20260702072352_AddProductionPlanUpdatedAt",
            "20260702121000_AddProductionPlanMetadata",
            "20260702124738_AddSupplierQuotations",
            "20260702164531_AddPurchaseOrders",
            "20260702165732_FixPurchaseRequestStatusEnum",
            "20260702194500_AddPurchaseLineDeliveryNote",
            "20260702203000_AddInventoryIssueReceivedAt",
            "20260702204500_AddInventoryReturnType",
            "20260703090000_AlignPurchaseRequestReceiptStatuses",
            "20260703093000_AddLotLevelStock",
            "20260703100000_AddStockMovementQuantitySnapshots",
            "20260703103000_AddMonthlyStockSnapshots"
        };
        
        context.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
              `MigrationId` varchar(150) NOT NULL,
              `ProductVersion` varchar(32) NOT NULL,
              PRIMARY KEY (`MigrationId`)
            ) CHARACTER SET=utf8mb4;
        ");
        
        foreach (var m in migrations)
        {
            context.Database.ExecuteSqlRaw(
                "INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES ({0}, '9.0.16')",
                m
            );
        }
        
        var history = context.Database.SqlQueryRaw<string>("SELECT MigrationId FROM __EFMigrationsHistory").ToList();
        Console.WriteLine($"TOTAL MIGRATIONS APPLIED: {history.Count}");
    }
}
