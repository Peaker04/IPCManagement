using FluentAssertions;
using IPCManagement.Api.Exceptions;
using NSubstitute;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Diagnostics;
using System.Reflection;
using System.Security.Claims;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    private sealed class WorkflowFixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly DbContextOptions<IpcManagementContext> _options;

        private WorkflowFixture(SqliteConnection connection, DbContextOptions<IpcManagementContext> options)
        {
            _connection = connection;
            _options = options;
        }

        public byte[] UserId { get; } = GuidHelper.NewId();
        public string UserIdString => GuidHelper.ToGuidString(UserId);
        public byte[] UnitId { get; } = GuidHelper.NewId();
        public byte[] WarehouseId { get; } = GuidHelper.NewId();
        public byte[] IngredientId { get; } = GuidHelper.NewId();
        public string IngredientIdString => GuidHelper.ToGuidString(IngredientId);
        public byte[] CustomerId { get; } = GuidHelper.NewId();
        public string CustomerIdString => GuidHelper.ToGuidString(CustomerId);
        public byte[] SupplierId { get; } = GuidHelper.NewId();
        public byte[] QuantityPlanId { get; } = GuidHelper.NewId();
        public byte[] ProductionPlanId { get; } = GuidHelper.NewId();
        public byte[] DishWithBomId { get; } = GuidHelper.NewId();
        public byte[] ReceiptId { get; } = GuidHelper.NewId();
        public byte[] IssueId { get; } = GuidHelper.NewId();

        public static async Task<WorkflowFixture> CreateAsync(DbCommandInterceptor? interceptor = null)
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var optionsBuilder = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection);
            if (interceptor is not null)
            {
                optionsBuilder.AddInterceptors(interceptor);
            }

            await CreateMinimalWorkflowSchemaAsync(connection);

            return new WorkflowFixture(connection, optionsBuilder.Options);
        }

        public IpcManagementContext CreateContext() => new(_options);

        public async Task SeedMenuWithDemandAsync(bool includeMissingDish)
        {
            await using var context = CreateContext();

            var roleId = GuidHelper.NewId();
            var menuId = GuidHelper.NewId();
            var scheduleId = GuidHelper.NewId();
            var quantityLineId = GuidHelper.NewId();
            var dishMissingBomId = GuidHelper.NewId();

            var role = new Role { RoleId = roleId, RoleCode = "ADMIN", RoleName = "Admin" };
            var user = new User
            {
                UserId = UserId,
                Username = "workflow-test",
                FullName = "Workflow Test",
                PasswordHash = "hash",
                RoleId = roleId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            var unit = new Unit
            {
                UnitId = UnitId,
                UnitCode = "KG",
                UnitName = "kg",
                ConvertRateToBase = 1
            };
            var warehouse = new Warehouse
            {
                WarehouseId = WarehouseId,
                WarehouseCode = "WH",
                WarehouseName = "Main",
                WarehouseType = "MAIN"
            };
            var ingredient = new Ingredient
            {
                IngredientId = IngredientId,
                IngredientCode = "ING",
                IngredientName = "Ingredient",
                UnitId = UnitId,
                WarehouseId = WarehouseId,
                ReferencePrice = 1000,
                IsFreshDaily = true,
                IsActive = true
            };
            var supplier = new Supplier
            {
                SupplierId = SupplierId,
                SupplierCode = "SUP",
                SupplierName = "Supplier",
                IsActive = true
            };
            var customer = new Customer
            {
                CustomerId = CustomerId,
                CustomerCode = "CUS",
                CustomerName = "Customer",
                IsActive = true
            };
            var menu = new Menu
            {
                MenuId = menuId,
                MenuCode = "MENU",
                MenuName = "Menu",
                IsActive = true
            };
            var dishWithBom = new Dish
            {
                DishId = DishWithBomId,
                DishCode = "DISH-BOM",
                DishName = "Dish with BOM",
                IsActive = true
            };
            var dishMissingBom = new Dish
            {
                DishId = dishMissingBomId,
                DishCode = "DISH-MISSING",
                DishName = "Dish missing BOM",
                IsActive = true
            };

            context.Roles.Add(role);
            context.Users.Add(user);
            context.Units.Add(unit);
            context.Warehouses.Add(warehouse);
            context.Ingredients.Add(ingredient);
            context.Suppliers.Add(supplier);
            context.Customers.Add(customer);
            context.Menus.Add(menu);
            context.Dishes.AddRange(dishWithBom, dishMissingBom);
            context.Menuitems.Add(new MenuItem
            {
                MenuItemId = GuidHelper.NewId(),
                MenuId = menuId,
                DishId = DishWithBomId,
                DisplayOrder = 1
            });
            if (includeMissingDish)
            {
                context.Menuitems.Add(new MenuItem
                {
                    MenuItemId = GuidHelper.NewId(),
                    MenuId = menuId,
                    DishId = dishMissingBomId,
                    DisplayOrder = 2
                });
            }

            context.Dishboms.Add(new DishBom
            {
                BomId = GuidHelper.NewId(),
                DishId = DishWithBomId,
                IngredientId = IngredientId,
                UnitId = UnitId,
                GrossQtyPerServing = 2,
                WasteRatePercent = 0,
                BomStatus = "PUBLISHED",
                EffectiveFrom = new DateOnly(2026, 1, 1)
            });
            context.Customerweekmenutiers.Add(new CustomerWeekMenuTier
            {
                TierId = GuidHelper.NewId(),
                CustomerId = CustomerId,
                WeekStartDate = new DateOnly(2026, 6, 15),
                PriceTierAmount = 25000,
                CreatedAt = DateTime.UtcNow
            });
            context.Menuschedules.Add(new MenuSchedule
            {
                MenuScheduleId = scheduleId,
                CustomerId = CustomerId,
                MenuId = menuId,
                ServiceDate = new DateOnly(2026, 6, 15),
                WeekStartDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                MenuPrice = 25000,
                BomRatePercent = 100,
                Status = "ACTIVE"
            });
            context.Mealquantityplans.Add(new MealQuantityPlan
            {
                QuantityPlanId = QuantityPlanId,
                PlanCode = "QTY-20260615",
                ServiceDate = new DateOnly(2026, 6, 15),
                Status = OrderStatus.Completed,
                ForecastReceivedAt = DateTime.UtcNow.AddHours(-3),
                ConfirmedAt = DateTime.UtcNow.AddHours(-2),
                ConfirmationTime = new TimeOnly(9, 0),
                ConfirmedBy = UserId
            });
            context.Mealquantityplanlines.Add(new MealQuantityPlanLine
            {
                QuantityPlanLineId = quantityLineId,
                QuantityPlanId = QuantityPlanId,
                MenuScheduleId = scheduleId,
                CustomerId = CustomerId,
                MenuId = menuId,
                ShiftName = "MORNING",
                ForecastServings = 100,
                ConfirmedServings = 100,
                FinalServings = 100
            });
            context.Productionplans.Add(new ProductionPlan
            {
                PlanId = ProductionPlanId,
                PlanCode = "KHSX-REPORT-SEED",
                PlanDate = new DateOnly(2026, 6, 15),
                Status = "CREATED",
                CreatedBy = UserId,
                CreatedAt = DateTime.UtcNow
            });

            await context.SaveChangesAsync();
        }

        public async Task SeedPerformanceWeekAsync(int customerCount, int ingredientCount)
        {
            await using var context = CreateContext();
            var roleId = GuidHelper.NewId();
            var menuId = GuidHelper.NewId();
            var dishId = GuidHelper.NewId();
            var weekStart = new DateOnly(2026, 8, 3);

            context.Roles.Add(new Role { RoleId = roleId, RoleCode = "ADMIN", RoleName = "Admin" });
            context.Users.Add(new User
            {
                UserId = UserId,
                Username = "performance-test",
                FullName = "Performance Test",
                PasswordHash = "hash",
                RoleId = roleId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            context.Units.Add(new Unit
            {
                UnitId = UnitId,
                UnitCode = "KG",
                UnitName = "kg",
                ConvertRateToBase = 1
            });
            context.Warehouses.Add(new Warehouse
            {
                WarehouseId = WarehouseId,
                WarehouseCode = "WH-PERF",
                WarehouseName = "Performance Warehouse",
                WarehouseType = "MAIN"
            });
            context.Suppliers.Add(new Supplier
            {
                SupplierId = SupplierId,
                SupplierCode = "SUP-PERF",
                SupplierName = "Performance Supplier",
                IsActive = true
            });
            context.Menus.Add(new Menu
            {
                MenuId = menuId,
                MenuCode = "MENU-PERF",
                MenuName = "Performance Menu",
                IsActive = true
            });
            context.Dishes.Add(new Dish
            {
                DishId = dishId,
                DishCode = "DISH-PERF",
                DishName = "Performance Dish",
                IsActive = true
            });
            context.Menuitems.Add(new MenuItem
            {
                MenuItemId = GuidHelper.NewId(),
                MenuId = menuId,
                DishId = dishId,
                DisplayOrder = 1
            });

            for (var ingredientIndex = 0; ingredientIndex < ingredientCount; ingredientIndex++)
            {
                var ingredientId = GuidHelper.NewId();
                context.Ingredients.Add(new Ingredient
                {
                    IngredientId = ingredientId,
                    IngredientCode = $"ING-PERF-{ingredientIndex:00}",
                    IngredientName = $"Performance Ingredient {ingredientIndex:00}",
                    UnitId = UnitId,
                    WarehouseId = WarehouseId,
                    ReferencePrice = 1000 + ingredientIndex,
                    IsFreshDaily = true,
                    IsActive = true
                });
                context.Dishboms.Add(new DishBom
                {
                    BomId = GuidHelper.NewId(),
                    DishId = dishId,
                    IngredientId = ingredientId,
                    UnitId = UnitId,
                    GrossQtyPerServing = 0.01m + (ingredientIndex * 0.001m),
                    WasteRatePercent = 0,
                    BomStatus = "PUBLISHED",
                    EffectiveFrom = weekStart
                });
            }

            var customers = Enumerable.Range(0, customerCount)
                .Select(customerIndex => new Customer
                {
                    CustomerId = GuidHelper.NewId(),
                    CustomerCode = $"CUS-PERF-{customerIndex:00}",
                    CustomerName = $"Performance Customer {customerIndex:00}",
                    IsActive = true
                })
                .ToList();
            context.Customers.AddRange(customers);
            context.Customerweekmenutiers.AddRange(customers.Select(customer => new CustomerWeekMenuTier
            {
                TierId = GuidHelper.NewId(),
                CustomerId = customer.CustomerId,
                WeekStartDate = weekStart,
                PriceTierAmount = 25000,
                CreatedAt = DateTime.UtcNow
            }));

            for (var dayOffset = 0; dayOffset < 7; dayOffset++)
            {
                var serviceDate = weekStart.AddDays(dayOffset);
                var quantityPlanId = GuidHelper.NewId();
                context.Mealquantityplans.Add(new MealQuantityPlan
                {
                    QuantityPlanId = quantityPlanId,
                    PlanCode = $"QTY-PERF-{serviceDate:yyyyMMdd}",
                    ServiceDate = serviceDate,
                    Status = OrderStatus.Completed,
                    ForecastReceivedAt = DateTime.UtcNow.AddHours(-3),
                    ConfirmedAt = DateTime.UtcNow.AddHours(-2),
                    ConfirmationTime = new TimeOnly(9, 0),
                    ConfirmedBy = UserId
                });

                foreach (var customer in customers)
                {
                    var scheduleId = GuidHelper.NewId();
                    context.Menuschedules.Add(new MenuSchedule
                    {
                        MenuScheduleId = scheduleId,
                        CustomerId = customer.CustomerId,
                        MenuId = menuId,
                        ServiceDate = serviceDate,
                        WeekStartDate = weekStart,
                        ShiftName = "MORNING",
                        MenuPrice = 25000,
                        BomRatePercent = 100,
                        Status = "ACTIVE"
                    });
                    context.Mealquantityplanlines.Add(new MealQuantityPlanLine
                    {
                        QuantityPlanLineId = GuidHelper.NewId(),
                        QuantityPlanId = quantityPlanId,
                        MenuScheduleId = scheduleId,
                        CustomerId = customer.CustomerId,
                        MenuId = menuId,
                        ShiftName = "MORNING",
                        ForecastServings = 120,
                        ConfirmedServings = 120,
                        FinalServings = 120
                    });
                }
            }

            await context.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            await _connection.DisposeAsync();
        }

        private static async Task CreateMinimalWorkflowSchemaAsync(SqliteConnection connection)
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
                    username TEXT NOT NULL,
                    passwordHash TEXT NOT NULL,
                    fullName TEXT NOT NULL,
                    roleId BLOB NOT NULL,
                    isActive INTEGER NOT NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE units (
                    unitId BLOB PRIMARY KEY,
                    unitCode TEXT NOT NULL,
                    unitName TEXT NOT NULL,
                    baseUnitCode TEXT NULL,
                    convertRateToBase TEXT NOT NULL
                );
                CREATE TABLE warehouses (
                    warehouseId BLOB PRIMARY KEY,
                    warehouseCode TEXT NOT NULL,
                    warehouseName TEXT NOT NULL,
                    warehouseType TEXT NOT NULL,
                    note TEXT NULL,
                    IsOperationalActive INTEGER NOT NULL DEFAULT 0,
                    OperationalSingletonKey INTEGER NULL
                );
                CREATE TABLE ingredients (
                    ingredientId BLOB PRIMARY KEY,
                    ingredientCode TEXT NOT NULL,
                    ingredientName TEXT NOT NULL,
                    unitId BLOB NOT NULL,
                    warehouseId BLOB NOT NULL,
                    referencePrice TEXT NOT NULL,
                    isFreshDaily INTEGER NOT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE suppliers (
                    supplierId BLOB PRIMARY KEY,
                    supplierCode TEXT NOT NULL,
                    supplierName TEXT NOT NULL,
                    debtPolicy TEXT NULL,
                    invoicePolicy TEXT NULL,
                    contactName TEXT NULL,
                    phone TEXT NULL,
                    address TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE customers (
                    customerId BLOB PRIMARY KEY,
                    customerCode TEXT NOT NULL,
                    customerName TEXT NOT NULL,
                    note TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE supplierquotations (
                    quotationId BLOB PRIMARY KEY,
                    supplierId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitPrice TEXT NOT NULL,
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL,
                    note TEXT NULL,
                    isActive INTEGER NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
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
                CREATE TABLE portionrules (
                    portionRuleId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    dishId BLOB NULL,
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL,
                    activeWeekDays TEXT NULL,
                    shiftNames TEXT NULL,
                    menuVariant TEXT NULL,
                    menuSectionName TEXT NULL,
                    slotName TEXT NULL,
                    dishCategory TEXT NULL,
                    portionRatePercent TEXT NOT NULL,
                    bomRatePercent TEXT NULL,
                    yieldLossPercent TEXT NULL,
                    priority INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                CREATE TABLE menus (
                    menuId BLOB PRIMARY KEY,
                    menuCode TEXT NOT NULL,
                    menuName TEXT NOT NULL,
                    fromDate TEXT NULL,
                    toDate TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE dishes (
                    dishId BLOB PRIMARY KEY,
                    dishCode TEXT NOT NULL,
                    dishName TEXT NOT NULL,
                    dishGroup TEXT NULL,
                    dishType TEXT NULL,
                    sourceImportBatch TEXT NULL,
                    sourceFileName TEXT NULL,
                    sourceChecksum TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE menuitems (
                    menuItemId BLOB PRIMARY KEY,
                    menuId BLOB NOT NULL,
                    dishId BLOB NOT NULL,
                    dishSlot TEXT NULL,
                    displayOrder INTEGER NOT NULL
                );
                CREATE TABLE dishbom (
                    bomId BLOB PRIMARY KEY,
                    dishId BLOB NOT NULL,
                    customerId BLOB NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    priceTierAmount TEXT NOT NULL DEFAULT '25000.00',
                    grossQtyPerServing TEXT NOT NULL,
                    wasteRatePercent TEXT NOT NULL,
                    bomStatus TEXT NOT NULL DEFAULT 'PUBLISHED',
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL
                );
                CREATE TABLE customerweekmenutiers (
                    tierId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    weekStartDate TEXT NOT NULL,
                    priceTierAmount TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    UNIQUE (customerId, weekStartDate)
                );
                CREATE TABLE menuschedules (
                    menuScheduleId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    menuId BLOB NOT NULL,
                    serviceDate TEXT NOT NULL,
                    weekStartDate TEXT NOT NULL,
                    shiftName TEXT NOT NULL,
                    menuPrice TEXT NOT NULL,
                    bomRatePercent TEXT NOT NULL,
                    status TEXT NOT NULL,
                    menuVersionId BLOB NULL
                );
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
                CREATE TABLE menuamendments (
                    menuAmendmentId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    weekStartDate TEXT NOT NULL,
                    baseMenuVersionId BLOB NULL,
                    status TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    impactSnapshotJson TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL,
                    reviewedBy BLOB NULL,
                    reviewedAt TEXT NULL,
                    executedBy BLOB NULL,
                    executedAt TEXT NULL
                );
                CREATE TABLE menuamendmentlines (
                    menuAmendmentLineId BLOB PRIMARY KEY,
                    menuAmendmentId BLOB NOT NULL,
                    serviceDate TEXT NOT NULL,
                    shiftName TEXT NOT NULL,
                    dishSlot TEXT NOT NULL,
                    oldDishId BLOB NULL,
                    newDishId BLOB NOT NULL
                );
                CREATE TABLE quantityimportbatches (
                    importBatchId BLOB PRIMARY KEY,
                    batchCode TEXT NOT NULL,
                    sourceCompanyName TEXT NULL,
                    sourceType TEXT NOT NULL,
                    importedBy BLOB NULL,
                    importedAt TEXT NOT NULL,
                    status TEXT NOT NULL
                );
                CREATE TABLE mealquantityplans (
                    quantityPlanId BLOB PRIMARY KEY,
                    importBatchId BLOB NULL,
                    planCode TEXT NOT NULL,
                    serviceDate TEXT NOT NULL,
                    status TEXT NOT NULL,
                    forecastReceivedAt TEXT NULL,
                    confirmedAt TEXT NULL,
                    confirmationTime TEXT NOT NULL,
                    confirmedBy BLOB NULL,
                    completedAt TEXT NULL,
                    completedBy BLOB NULL,
                    rowVersion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE mealquantityplanlines (
                    quantityPlanLineId BLOB PRIMARY KEY,
                    quantityPlanId BLOB NOT NULL,
                    menuScheduleId BLOB NOT NULL,
                    customerId BLOB NOT NULL,
                    menuId BLOB NOT NULL,
                    shiftName TEXT NOT NULL,
                    forecastServings INTEGER NOT NULL,
                    confirmedServings INTEGER NOT NULL,
                    adjustedServings INTEGER NOT NULL,
                    finalServings INTEGER NOT NULL,
                    updatedAt TEXT NOT NULL DEFAULT '2026-01-01 00:00:00'
                );
                CREATE TABLE productionplans (
                    planId BLOB PRIMARY KEY,
                    planCode TEXT NOT NULL,
                    planDate TEXT NOT NULL,
                    customerId BLOB NULL,
                    weekStartDate TEXT NULL,
                    menuVersionId BLOB NULL,
                    status TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    sentToKitchenAt TEXT NULL,
                    sentToKitchenBy BLOB NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL DEFAULT '2026-01-01 00:00:00'
                );
                CREATE TABLE productionplanlines (
                    planLineId BLOB PRIMARY KEY,
                    planId BLOB NOT NULL,
                    quantityPlanLineId BLOB NOT NULL,
                    customerId BLOB NOT NULL,
                    menuId BLOB NOT NULL,
                    dishId BLOB NOT NULL,
                    shiftName TEXT NOT NULL,
                    totalServings INTEGER NOT NULL
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
                    bomId BLOB NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    priceTierAmount TEXT NOT NULL DEFAULT '25000.00',
                    bomScope TEXT NOT NULL DEFAULT 'global',
                    totalServings INTEGER NOT NULL,
                    grossQtyPerServing TEXT NOT NULL,
                    bomRatePercent TEXT NOT NULL,
                    appliedPortionRuleId BLOB NULL,
                    appliedPortionRatePercent TEXT NOT NULL DEFAULT '100.00',
                    appliedPortionRuleSource TEXT NOT NULL DEFAULT 'CONTRACT_DEFAULT',
                    yieldLossPercent TEXT NULL,
                    totalRequiredQty TEXT NOT NULL,
                    currentStockQty TEXT NOT NULL,
                    suggestedPurchaseQty TEXT NOT NULL
                );
                CREATE TABLE purchaserequests (
                    purchaseRequestId BLOB PRIMARY KEY,
                    purchaseRequestCode TEXT NOT NULL,
                    requestDate TEXT NOT NULL,
                    purchaseForDate TEXT NOT NULL,
                    shiftName TEXT NULL,
                    status TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    approvedBy BLOB NULL,
                    approvedAt TEXT NULL
                );
                CREATE TABLE purchaserequestlines (
                    purchaseRequestLineId BLOB PRIMARY KEY,
                    purchaseRequestId BLOB NOT NULL,
                    materialRequestLineId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    supplierId BLOB NULL,
                    isLegacySupplierSnapshot INTEGER NOT NULL DEFAULT 0,
                    unitId BLOB NOT NULL,
                    requiredQty TEXT NOT NULL,
                    currentStockQty TEXT NOT NULL,
                    purchaseQty TEXT NOT NULL,
                    estimatedUnitPrice TEXT NOT NULL,
                    expectedDeliveryDate TEXT NULL,
                    note TEXT NULL,
                    IsOperationalActive INTEGER NOT NULL DEFAULT 0,
                    OperationalSingletonKey INTEGER NULL
                );
                CREATE TABLE purchaselinesupplierdecisions (
                    purchaseLineSupplierDecisionId BLOB PRIMARY KEY,
                    purchaseRequestLineId BLOB NOT NULL,
                    supplierId BLOB NOT NULL,
                    evidenceType TEXT NOT NULL,
                    evidenceId BLOB NOT NULL,
                    evidenceDate TEXT NOT NULL,
                    evidenceReferencePrice TEXT NOT NULL,
                    proposedUnitPrice TEXT NOT NULL,
                    proposedDeliveryDate TEXT NOT NULL,
                    receivingWarehouseId BLOB NULL,
                    purchasingTerms TEXT NULL,
                    confirmedBy BLOB NOT NULL,
                    confirmedAt TEXT NOT NULL,
                    decisionFingerprint TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'CURRENT',
                    currentDecisionKey BLOB NULL,
                    supersededByDecisionId BLOB NULL,
                    concurrencyVersion INTEGER NOT NULL DEFAULT 1
                );
                CREATE UNIQUE INDEX uqPurchaseLineSupplierDecisionsLineFingerprint
                    ON purchaselinesupplierdecisions (purchaseRequestLineId, decisionFingerprint);
                CREATE UNIQUE INDEX uqPurchaseLineSupplierDecisionsCurrentKey
                    ON purchaselinesupplierdecisions (currentDecisionKey);
                CREATE TABLE purchasepriceexceptions (
                    purchasePriceExceptionId BLOB PRIMARY KEY,
                    purchaseLineSupplierDecisionId BLOB NOT NULL,
                    referencePrice TEXT NOT NULL,
                    proposedPrice TEXT NOT NULL,
                    variancePercent TEXT NOT NULL,
                    evidenceType TEXT NOT NULL,
                    evidenceId BLOB NOT NULL,
                    evidenceDate TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    proposalFingerprint TEXT NOT NULL,
                    proposalVersion INTEGER NOT NULL,
                    requestedBy BLOB NOT NULL,
                    requestedAt TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    decidedBy BLOB NULL,
                    decisionReason TEXT NULL,
                    decidedAt TEXT NULL,
                    supersededByExceptionId BLOB NULL,
                    concurrencyVersion INTEGER NOT NULL DEFAULT 1
                );
                CREATE TABLE purchaseorders (
                    purchaseOrderId BLOB PRIMARY KEY,
                    purchaseOrderCode TEXT NOT NULL,
                    purchaseRequestId BLOB NOT NULL,
                    supplierId BLOB NOT NULL,
                    proposedDeliveryDate TEXT NULL,
                    receivingWarehouseId BLOB NULL,
                    purchasingTerms TEXT NULL,
                    orderDate TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'ORDERED',
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                CREATE TABLE purchaseorderlines (
                    purchaseOrderLineId BLOB PRIMARY KEY,
                    purchaseOrderId BLOB NOT NULL,
                    purchaseRequestLineId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    orderedQty TEXT NOT NULL,
                    receivedQty TEXT NOT NULL,
                    unitPrice TEXT NOT NULL
                );
                CREATE TABLE currentstock (
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    currentQty TEXT NOT NULL,
                    lastUpdated TEXT NOT NULL,
                    rowVersion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (warehouseId, ingredientId)
                );
                CREATE TABLE unitnormalizationreviews (
                    reviewId BLOB PRIMARY KEY,
                    ingredientId BLOB NOT NULL,
                    sourceUnitId BLOB NOT NULL,
                    catalogUnitId BLOB NOT NULL,
                    recommendedUnitId BLOB NULL,
                    observedStockQty TEXT NULL,
                    sourceReceiptCount INTEGER NOT NULL DEFAULT 0,
                    catalogReceiptCount INTEGER NOT NULL DEFAULT 0,
                    bomLineCount INTEGER NOT NULL DEFAULT 0,
                    proposedSourceToCatalogFactor TEXT NULL,
                    confidence TEXT NOT NULL DEFAULT 'BLOCKED',
                    status TEXT NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
                    evidenceSource TEXT NOT NULL,
                    evidenceNote TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL,
                    reviewedAt TEXT NULL,
                    reviewedBy BLOB NULL
                );
                CREATE UNIQUE INDEX uq_unitnormalizationreviews_pair
                    ON unitnormalizationreviews (ingredientId, sourceUnitId, catalogUnitId);
                CREATE TABLE currentstocklots (
                    lotStockId BLOB PRIMARY KEY,
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    lotNumber TEXT NULL,
                    manufactureDate TEXT NULL,
                    expiredDate TEXT NULL,
                    currentQty TEXT NOT NULL,
                    lastUpdated TEXT NOT NULL
                );
                CREATE TABLE stockmovements (
                    movementId BLOB PRIMARY KEY,
                    movementDate TEXT NOT NULL,
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    lotNumber TEXT NULL,
                    manufactureDate TEXT NULL,
                    expiredDate TEXT NULL,
                    movementType TEXT NOT NULL,
                    refTable TEXT NULL,
                    refId BLOB NULL,
                    quantityIn TEXT NOT NULL,
                    quantityOut TEXT NOT NULL,
                    beforeQty TEXT NOT NULL DEFAULT '0',
                    afterQty TEXT NOT NULL DEFAULT '0',
                    reason TEXT NULL,
                    note TEXT NULL,
                    performedBy BLOB NOT NULL
                );
                CREATE TABLE stocksnapshots (
                    snapshotId BLOB PRIMARY KEY,
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    periodMonth TEXT NOT NULL,
                    openingQty TEXT NOT NULL,
                    quantityIn TEXT NOT NULL,
                    quantityOut TEXT NOT NULL,
                    closingQty TEXT NOT NULL,
                    generatedAt TEXT NOT NULL
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
                CREATE TABLE lifecycletransitions (
                    transitionId BLOB PRIMARY KEY, aggregateType TEXT NOT NULL, aggregateId BLOB NOT NULL,
                    commandId TEXT NOT NULL UNIQUE, aggregateSequence INTEGER NOT NULL, fromState TEXT NULL,
                    toState TEXT NOT NULL, actorId BLOB NULL, expectedVersion INTEGER NOT NULL, reason TEXT NULL,
                    correlationId TEXT NULL, causationId TEXT NULL, payloadJson TEXT NULL,
                    schemaVersion INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL
                );
                CREATE TABLE lifecycleoutboxmessages (
                    outboxMessageId BLOB PRIMARY KEY, eventType TEXT NOT NULL, aggregateType TEXT NOT NULL,
                    aggregateId BLOB NOT NULL, aggregateSequence INTEGER NOT NULL, commandId TEXT NOT NULL UNIQUE,
                    payloadJson TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', attemptCount INTEGER NOT NULL DEFAULT 0,
                    nextAttemptAt TEXT NULL, lockedAt TEXT NULL, processedAt TEXT NULL, lastError TEXT NULL, createdAt TEXT NOT NULL
                );
                CREATE TABLE lifecyclecommandreceipts (
                    commandReceiptId BLOB PRIMARY KEY, commandId TEXT NOT NULL, aggregateType TEXT NOT NULL,
                    aggregateId BLOB NOT NULL, responseJson TEXT NOT NULL, createdAt TEXT NOT NULL,
                    UNIQUE(commandId, aggregateType, aggregateId)
                );
                CREATE TABLE inventoryreceipts (
                    receiptId BLOB PRIMARY KEY,
                    receiptCode TEXT NOT NULL,
                    receiptDate TEXT NOT NULL,
                    warehouseId BLOB NOT NULL,
                    supplierId BLOB NOT NULL,
                    purchaseRequestId BLOB NULL,
                    purchaseOrderId BLOB NULL,
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'DRAFT',
                    qualityStatus TEXT NOT NULL DEFAULT 'PENDING_INSPECTION',
                    concurrencyVersion INTEGER NOT NULL DEFAULT 0,
                    qualityCheckedBy BLOB NULL,
                    qualityCheckedAt TEXT NULL,
                    managerApprovedBy BLOB NULL,
                    managerApprovedAt TEXT NULL,
                    managerApprovalReason TEXT NULL,
                    postedBy BLOB NULL,
                    postedAt TEXT NULL,
                    rejectedBy BLOB NULL,
                    rejectedAt TEXT NULL,
                    rejectionReason TEXT NULL
                );
                CREATE TABLE inventoryreceiptlines (
                    receiptLineId BLOB PRIMARY KEY,
                    receiptId BLOB NOT NULL,
                    purchaseRequestLineId BLOB NULL,
                    purchaseOrderLineId BLOB NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    quantity TEXT NOT NULL,
                    unitPrice TEXT NOT NULL,
                    amount TEXT NULL,
                    lotNumber TEXT NULL,
                    manufactureDate TEXT NULL,
                    expiredDate TEXT NULL,
                    packageQuantitySnapshot TEXT NULL,
                    packageBaseUnitIdSnapshot BLOB NULL,
                    packagePolicyVersionSnapshot TEXT NULL,
                    acceptedQuantity TEXT NULL,
                    rejectedQuantity TEXT NULL,
                    qualityReason TEXT NULL
                );
                CREATE TABLE purchasereceiptactivelines (
                    purchaseOrderLineId BLOB PRIMARY KEY,
                    receiptId BLOB NOT NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE inventoryissues (
                    issueId BLOB PRIMARY KEY,
                    issueCode TEXT NOT NULL,
                    issueDate TEXT NOT NULL,
                    shiftName TEXT NULL,
                    warehouseId BLOB NOT NULL,
                    materialRequestId BLOB NOT NULL,
                    issuedBy BLOB NOT NULL,
                    receivedBy BLOB NULL,
                    receivedAt TEXT NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE supplementalmaterialrequests (
                    requestId BLOB PRIMARY KEY,
                    requestCode TEXT NOT NULL,
                    issueId BLOB NOT NULL,
                    issueLineId BLOB NOT NULL,
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    requestedQty TEXT NOT NULL,
                reason TEXT NULL,
                status TEXT NOT NULL,
                requestedBy BLOB NOT NULL,
                requestedAt TEXT NOT NULL,
                openIssueLineId BLOB GENERATED ALWAYS AS (CASE WHEN status IN ('REJECTED', 'FULFILLED') THEN NULL ELSE issueLineId END) VIRTUAL
                );
                CREATE UNIQUE INDEX uxSupplementalMaterialRequestsOpenIssueLine ON supplementalmaterialrequests (openIssueLineId);
                CREATE TABLE inventoryissuelines (
                    issueLineId BLOB PRIMARY KEY,
                    issueId BLOB NOT NULL,
                    materialRequestLineId BLOB NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    requestedQty TEXT NOT NULL,
                    issuedQty TEXT NOT NULL
                );
                CREATE TABLE inventoryreturns (
                    returnId BLOB PRIMARY KEY,
                    returnCode TEXT NOT NULL,
                    returnDate TEXT NOT NULL,
                    shiftName TEXT NULL,
                    returnType TEXT NOT NULL DEFAULT 'RETURN',
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
                    quantity TEXT NOT NULL
                );
                CREATE TABLE inventoryallocationdispositions (
                    allocationDispositionId BLOB PRIMARY KEY,
                    sourceIssueLineId BLOB NOT NULL,
                    destinationIssueLineId BLOB NOT NULL,
                    quantity TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    correlationId TEXT NULL,
                    causationId TEXT NULL
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
                    openDispositionKey INTEGER NULL
                );
                CREATE TABLE quantityadjustments (
                    adjustmentId BLOB PRIMARY KEY,
                    quantityPlanLineId BLOB NOT NULL,
                    oldServings INTEGER NOT NULL,
                    newServings INTEGER NOT NULL,
                    reason TEXT NULL,
                    adjustedBy BLOB NOT NULL,
                    adjustedAt TEXT NOT NULL
                );
                CREATE TABLE bomadjustments (
                    bomAdjustmentId BLOB PRIMARY KEY,
                    bomId BLOB NOT NULL,
                    oldGrossQtyPerServing TEXT NOT NULL,
                    oldWasteRatePercent TEXT NOT NULL,
                    newGrossQtyPerServing TEXT NOT NULL,
                    newWasteRatePercent TEXT NOT NULL,
                    reason TEXT NULL,
                    adjustedBy BLOB NOT NULL,
                    adjustedAt TEXT NOT NULL
                );
                """;
            await command.ExecuteNonQueryAsync();
        }
    }
}
