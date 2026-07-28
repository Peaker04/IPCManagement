using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.SampleData.Contracts;

namespace IPCManagement.Api.Features.SampleData.Services;

public partial class SampleDataImportService : ISampleDataImportService
{
    private const string SampleCustomerCode = "DAV";
    private const string SampleCustomerName = "Draxlmaier";
    private const string SampleUserName = "sample.importer";

    private static readonly string[] OrderRequiredHeaders =
    [
        "Row Labels",
        "Ca sáng",
        "Ca chiều"
    ];

    private static readonly string[] PurchaseRequiredHeaders =
    [
        "Ngày Giao hàng",
        "Tên hàng",
        "Đơn vị tính",
        "Số lượng",
        "Đơn giá"
    ];

    private static readonly string[] MenuDayColumns = ["D", "E", "F", "G", "H", "I"];

    private readonly IpcManagementContext _context;
    private readonly IHostEnvironment _environment;
    private readonly XlsxWorkbookReader _reader = new();

    public SampleDataImportService(IpcManagementContext context, IHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    private Dictionary<string, int> ReadOrderWorkbookShiftFallbacks(
        string workbookPath,
        int? maxRows,
        SampleDataFileResultDto fileResult,
        SampleDataImportResultDto result)
    {
        var totals = new Dictionary<string, List<decimal>>(StringComparer.OrdinalIgnoreCase)
        {
            ["MORNING"] = [],
            ["AFTERNOON"] = []
        };

        foreach (var sheetName in _reader.GetSheetNames(workbookPath))
        {
            IReadOnlyList<IReadOnlyDictionary<string, string>> rows;
            try
            {
                rows = _reader.ReadTable(workbookPath, sheetName, OrderRequiredHeaders, maxRows);
            }
            catch (InvalidOperationException)
            {
                continue;
            }

            fileResult.RowsScanned += rows.Count;
            foreach (var row in rows)
            {
                var label = Get(row, "Row Labels");
                if (string.IsNullOrWhiteSpace(label) || label.StartsWith("NCC", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var morning = ParseDecimal(Get(row, "Ca sáng"));
                var afternoon = ParseDecimal(Get(row, "Ca chiều"));
                if (morning > 0)
                {
                    totals["MORNING"].Add(morning);
                }

                if (afternoon > 0)
                {
                    totals["AFTERNOON"].Add(afternoon);
                }
            }
        }

        var fallbacks = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var (shift, values) in totals)
        {
            if (values.Count == 0)
            {
                continue;
            }

            // Order workbook rows are material quantities, not exact servings. Use them only
            // as a bounded fallback when BOM serving hints are absent.
            var average = values.Average();
            fallbacks[shift] = Math.Clamp((int)Math.Round(average * 10, MidpointRounding.AwayFromZero), 80, 800);
        }

        if (fallbacks.Count == 0)
        {
            AddWarning(result, "Không đọc được fallback số suất từ workbook Đơn đặt hàng.");
        }

        return fallbacks;
    }

    private async Task<Customer> EnsureCustomerAsync(
        string customerCode,
        string customerName,
        string note,
        bool dryRun,
        SampleDataImportCountsDto counts,
        CancellationToken cancellationToken)
    {
        var customer = await _context.Customers
            .FirstOrDefaultAsync(item => item.CustomerCode == customerCode, cancellationToken);
        if (customer is not null)
        {
            customer.CustomerName = customerName;
            customer.Note = string.IsNullOrWhiteSpace(customer.Note) ? note : customer.Note;
            customer.IsActive = true;
            counts.CustomersUpdated++;
            return customer;
        }

        counts.CustomersCreated++;
        customer = new Customer
        {
            CustomerId = GuidHelper.NewId(),
            CustomerCode = customerCode,
            CustomerName = customerName,
            Note = note,
            IsActive = true
        };

        if (!dryRun)
        {
            _context.Customers.Add(customer);
        }

        return customer;
    }

    private async Task<User> EnsureSampleUserAsync(
        bool dryRun,
        SampleDataImportCountsDto counts,
        CancellationToken cancellationToken)
    {
        var role = await _context.Roles.FirstOrDefaultAsync(item => item.RoleCode == "ADMIN", cancellationToken);
        if (role is null)
        {
            counts.RolesCreated++;
            role = new Role
            {
                RoleId = GuidHelper.NewId(),
                RoleCode = "ADMIN",
                RoleName = "Quản trị"
            };

            if (!dryRun)
            {
                _context.Roles.Add(role);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        var user = await _context.Users.FirstOrDefaultAsync(item => item.Username == SampleUserName, cancellationToken);
        if (user is not null)
        {
            return user;
        }

        counts.UsersCreated++;
        user = new User
        {
            UserId = GuidHelper.NewId(),
            FullName = "Sample Data Importer",
            Username = SampleUserName,
            PasswordHash = "sample-data-importer",
            RoleId = role.RoleId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        if (!dryRun)
        {
            _context.Users.Add(user);
            await _context.SaveChangesAsync(cancellationToken);
        }

        return user;
    }

    private async Task<QuantityImportBatch> EnsureQuantityImportBatchAsync(
        bool dryRun,
        SampleDataImportCountsDto counts,
        CancellationToken cancellationToken)
    {
        const string batchCode = "BATCH-SAMPLE-DON-DAT-HANG-T5-2026";
        var batch = await _context.Quantityimportbatches
            .FirstOrDefaultAsync(item => item.BatchCode == batchCode, cancellationToken);
        if (batch is not null)
        {
            return batch;
        }

        counts.QuantityImportBatchesCreated++;
        batch = new QuantityImportBatch
        {
            ImportBatchId = GuidHelper.NewId(),
            BatchCode = batchCode,
            SourceCompanyName = SampleCustomerName,
            SourceType = "EXCEL",
            ImportedAt = DateTime.UtcNow,
            Status = "VALIDATED"
        };

        if (!dryRun)
        {
            _context.Quantityimportbatches.Add(batch);
        }

        return batch;
    }

    private Dish EnsureDish(
        string dishName,
        string dishGroup,
        string dishType,
        List<Dish> dishes,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var normalized = NormalizeName(dishName);
        var stableCode = StableCode("DISH", dishName);
        var existing = dishes.FirstOrDefault(item =>
            string.Equals(NormalizeName(item.DishName), normalized, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.DishCode, stableCode, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.DishName = dishName.Trim();
            existing.DishGroup = string.IsNullOrWhiteSpace(dishGroup) ? existing.DishGroup : dishGroup.Trim();
            existing.DishType = string.IsNullOrWhiteSpace(dishType) ? existing.DishType : dishType.Trim();
            existing.IsActive = true;
            counts.DishesUpdated++;
            return existing;
        }

        counts.DishesCreated++;
        var dish = new Dish
        {
            DishId = GuidHelper.NewId(),
            DishCode = stableCode,
            DishName = dishName.Trim(),
            DishGroup = string.IsNullOrWhiteSpace(dishGroup) ? null : dishGroup.Trim(),
            DishType = string.IsNullOrWhiteSpace(dishType) ? null : dishType.Trim(),
            IsActive = true
        };

        if (!dryRun)
        {
            _context.Dishes.Add(dish);
        }

        dishes.Add(dish);
        return dish;
    }

    private Menu EnsureMenu(
        DateOnly serviceDate,
        string shiftName,
        Customer customer,
        DateOnly weekStart,
        DateOnly weekEnd,
        List<Menu> menus,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var menuCode = $"MENU-{customer.CustomerCode}-{serviceDate:yyyyMMdd}-{shiftName}";
        var existing = menus.FirstOrDefault(item =>
            string.Equals(item.MenuCode, menuCode, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.MenuName = $"Thực đơn {customer.CustomerCode} {ToVietnameseShift(shiftName)} {serviceDate:dd/MM/yyyy}";
            existing.FromDate = weekStart;
            existing.ToDate = weekEnd;
            existing.IsActive = true;
            counts.MenusUpdated++;
            return existing;
        }

        counts.MenusCreated++;
        var menu = new Menu
        {
            MenuId = GuidHelper.NewId(),
            MenuCode = menuCode,
            MenuName = $"Thực đơn {customer.CustomerCode} {ToVietnameseShift(shiftName)} {serviceDate:dd/MM/yyyy}",
            FromDate = weekStart,
            ToDate = weekEnd,
            IsActive = true
        };

        if (!dryRun)
        {
            _context.Menus.Add(menu);
        }

        menus.Add(menu);
        return menu;
    }

    private void EnsureMenuItem(
        Menu menu,
        Dish dish,
        string dishSlot,
        int displayOrder,
        List<MenuItem> menuItems,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var existing = menuItems.FirstOrDefault(item =>
            item.MenuId.SequenceEqual(menu.MenuId) &&
            item.DishId.SequenceEqual(dish.DishId) &&
            string.Equals(item.DishSlot, dishSlot, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.DisplayOrder = displayOrder;
            counts.MenuItemsUpdated++;
            return;
        }

        counts.MenuItemsCreated++;
        var menuItem = new MenuItem
        {
            MenuItemId = GuidHelper.NewId(),
            MenuId = menu.MenuId,
            DishId = dish.DishId,
            DishSlot = dishSlot,
            DisplayOrder = displayOrder
        };

        if (!dryRun)
        {
            _context.Menuitems.Add(menuItem);
        }

        menuItems.Add(menuItem);
    }

    private void EnsureMenuSchedule(
        Customer customer,
        Menu menu,
        DateOnly serviceDate,
        DateOnly weekStart,
        string shiftName,
        List<MenuSchedule> schedules,
        bool dryRun,
        SampleDataImportCountsDto counts,
        CustomerContractPolicy? contractPolicy = null,
        byte[]? menuVersionId = null)
    {
        contractPolicy ??= ResolveCustomerContractPolicy(customer, serviceDate, shiftName);
        var existing = schedules.FirstOrDefault(item =>
            item.CustomerId.SequenceEqual(customer.CustomerId) &&
            item.ServiceDate == serviceDate &&
            string.Equals(item.ShiftName, shiftName, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.MenuId = menu.MenuId;
            existing.WeekStartDate = weekStart;
            existing.MenuPrice = contractPolicy.MenuPrice;
            existing.BomRatePercent = contractPolicy.BomRatePercent;
            existing.Status = "DRAFT";
            existing.MenuVersionId = menuVersionId;
            counts.MenuSchedulesUpdated++;
            return;
        }

        counts.MenuSchedulesCreated++;
        var schedule = new MenuSchedule
        {
            MenuScheduleId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            MenuId = menu.MenuId,
            ServiceDate = serviceDate,
            WeekStartDate = weekStart,
            ShiftName = shiftName,
            MenuPrice = contractPolicy.MenuPrice,
            BomRatePercent = contractPolicy.BomRatePercent,
            Status = "DRAFT",
            MenuVersionId = menuVersionId
        };

        if (!dryRun)
        {
            _context.Menuschedules.Add(schedule);
        }

        schedules.Add(schedule);
    }

    private CustomerContractPolicy ResolveCustomerContractPolicy(
        Customer customer,
        DateOnly serviceDate,
        string shiftName)
    {
        var dayCode = ToDayCode(serviceDate);
        var contract = _context.Customercontracts
            .AsNoTracking()
            .Where(item =>
                item.CustomerId.SequenceEqual(customer.CustomerId) &&
                item.Status == "ACTIVE" &&
                item.EffectiveFrom <= serviceDate &&
                (item.EffectiveTo == null || item.EffectiveTo >= serviceDate))
            .AsEnumerable()
            .Where(item =>
                SplitCsv(item.ActiveWeekDays).Contains(dayCode, StringComparer.OrdinalIgnoreCase) &&
                SplitCsv(item.ShiftNames).Contains(shiftName, StringComparer.OrdinalIgnoreCase))
            .OrderByDescending(item => item.EffectiveFrom)
            .FirstOrDefault();

        if (contract is null)
        {
            return new CustomerContractPolicy(
                DecimalPolicy.RoundMoney(25000),
                DecimalPolicy.RoundPercent(100),
                UsedFallback: true);
        }

        return new CustomerContractPolicy(
            DecimalPolicy.RoundMoney(contract.DefaultMenuPrice),
            DecimalPolicy.RoundPercent(100),
            UsedFallback: false);
    }

    private static string MissingCustomerContractWarning(Customer customer, DateOnly serviceDate, string shiftName)
        => $"Không có hợp đồng hiệu lực cho {customer.CustomerCode} ngày {serviceDate:dd/MM/yyyy} {ToVietnameseShift(shiftName)}; dùng giá mặc định 25.000 và BOM 100%.";

    private static string ToDayCode(DateOnly date)
        => date.DayOfWeek switch
        {
            DayOfWeek.Monday => "t2",
            DayOfWeek.Tuesday => "t3",
            DayOfWeek.Wednesday => "t4",
            DayOfWeek.Thursday => "t5",
            DayOfWeek.Friday => "t6",
            DayOfWeek.Saturday => "t7",
            _ => "cn"
        };

    private static IReadOnlyList<string> SplitCsv(string value)
        => value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private MealQuantityPlan EnsureMealQuantityPlan(
        DateOnly serviceDate,
        QuantityImportBatch batch,
        List<MealQuantityPlan> plans,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var planCode = $"QTY-{SampleCustomerCode}-{serviceDate:yyyyMMdd}";
        var existing = plans.FirstOrDefault(item =>
            string.Equals(item.PlanCode, planCode, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.ImportBatchId = batch.ImportBatchId;
            existing.Status = string.Equals(existing.Status, "CONFIRMED", StringComparison.OrdinalIgnoreCase)
                ? existing.Status
                : "FORECASTED";
            counts.MealQuantityPlansUpdated++;
            return existing;
        }

        counts.MealQuantityPlansCreated++;
        var plan = new MealQuantityPlan
        {
            QuantityPlanId = GuidHelper.NewId(),
            ImportBatchId = batch.ImportBatchId,
            PlanCode = planCode,
            ServiceDate = serviceDate,
            Status = "FORECASTED",
            ForecastReceivedAt = DateTime.UtcNow,
            ConfirmationTime = new TimeOnly(8, 30)
        };

        if (!dryRun)
        {
            _context.Mealquantityplans.Add(plan);
        }

        plans.Add(plan);
        return plan;
    }

    private void EnsureMealQuantityPlanLine(
        MealQuantityPlan plan,
        MenuSchedule schedule,
        int servings,
        List<MealQuantityPlanLine> planLines,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var existing = planLines.FirstOrDefault(item =>
            item.QuantityPlanId.SequenceEqual(plan.QuantityPlanId) &&
            item.MenuScheduleId.SequenceEqual(schedule.MenuScheduleId));
        if (existing is not null)
        {
            existing.ForecastServings = servings;
            existing.FinalServings = string.Equals(plan.Status, "CONFIRMED", StringComparison.OrdinalIgnoreCase)
                ? existing.FinalServings
                : servings;
            counts.MealQuantityPlanLinesUpdated++;
            return;
        }

        counts.MealQuantityPlanLinesCreated++;
        var line = new MealQuantityPlanLine
        {
            QuantityPlanLineId = GuidHelper.NewId(),
            QuantityPlanId = plan.QuantityPlanId,
            MenuScheduleId = schedule.MenuScheduleId,
            CustomerId = schedule.CustomerId,
            MenuId = schedule.MenuId,
            ShiftName = schedule.ShiftName,
            ForecastServings = servings,
            ConfirmedServings = 0,
            AdjustedServings = 0,
            FinalServings = servings
        };

        if (!dryRun)
        {
            _context.Mealquantityplanlines.Add(line);
        }

        planLines.Add(line);
    }

    private InventoryReceipt EnsureReceipt(
        Supplier supplier,
        Warehouse warehouse,
        User sampleUser,
        DateOnly receiptDate,
        List<InventoryReceipt> receipts,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var receiptCode = $"RCP-SAMPLE-{receiptDate:yyyyMMdd}-{supplier.SupplierCode.Replace("SUP-", "", StringComparison.Ordinal)}";
        if (receiptCode.Length > 50)
        {
            receiptCode = receiptCode[..50];
        }

        var existing = receipts.FirstOrDefault(item =>
            string.Equals(item.ReceiptCode, receiptCode, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.SupplierId = supplier.SupplierId;
            existing.WarehouseId = warehouse.WarehouseId;
            existing.CreatedBy = sampleUser.UserId;
            counts.InventoryReceiptsUpdated++;
            return existing;
        }

        counts.InventoryReceiptsCreated++;
        var receipt = new InventoryReceipt
        {
            ReceiptId = GuidHelper.NewId(),
            ReceiptCode = receiptCode,
            ReceiptDate = receiptDate,
            WarehouseId = warehouse.WarehouseId,
            SupplierId = supplier.SupplierId,
            CreatedBy = sampleUser.UserId,
            CreatedAt = receiptDate.ToDateTime(new TimeOnly(8, 0))
        };

        if (!dryRun)
        {
            _context.Inventoryreceipts.Add(receipt);
        }

        receipts.Add(receipt);
        return receipt;
    }

    private InventoryReceiptLine EnsureReceiptLine(
        InventoryReceipt receipt,
        Ingredient ingredient,
        Unit unit,
        decimal quantity,
        decimal unitPrice,
        string sourceSheet,
        DateOnly receiptDate,
        List<InventoryReceiptLine> receiptLines,
        bool dryRun,
        SampleDataImportCountsDto counts,
        out decimal quantityDelta)
    {
        quantity = DecimalPolicy.RoundQuantity(quantity);
        unitPrice = DecimalPolicy.RoundMoney(unitPrice);
        var lotNumber = StableLotNumber(sourceSheet, receiptDate, ingredient.IngredientName);
        var existing = receiptLines.FirstOrDefault(item =>
            item.ReceiptId.SequenceEqual(receipt.ReceiptId) &&
            string.Equals(item.LotNumber, lotNumber, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            quantityDelta = DecimalPolicy.RoundQuantity(quantity - existing.Quantity);
            existing.IngredientId = ingredient.IngredientId;
            existing.UnitId = unit.UnitId;
            existing.Quantity = quantity;
            existing.UnitPrice = unitPrice;
            counts.InventoryReceiptLinesUpdated++;
            return existing;
        }

        quantityDelta = quantity;
        counts.InventoryReceiptLinesCreated++;
        var line = new InventoryReceiptLine
        {
            ReceiptLineId = GuidHelper.NewId(),
            ReceiptId = receipt.ReceiptId,
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            Quantity = quantity,
            UnitPrice = unitPrice,
            LotNumber = lotNumber
        };

        if (!dryRun)
        {
            _context.Inventoryreceiptlines.Add(line);
        }

        receiptLines.Add(line);
        return line;
    }

    private void EnsureStockMovement(
        Warehouse warehouse,
        Ingredient ingredient,
        Unit unit,
        User sampleUser,
        InventoryReceiptLine receiptLine,
        DateOnly receiptDate,
        decimal quantity,
        List<StockMovement> stockMovements,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        quantity = DecimalPolicy.RoundQuantity(quantity);
        var existing = stockMovements.FirstOrDefault(item =>
            string.Equals(item.MovementType, "RECEIPT", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(item.RefTable, "inventoryreceiptlines", StringComparison.OrdinalIgnoreCase) &&
            item.RefId is not null &&
            item.RefId.SequenceEqual(receiptLine.ReceiptLineId));
        if (existing is not null)
        {
            existing.QuantityIn = quantity;
            existing.QuantityOut = 0;
            existing.BeforeQty = 0;
            existing.AfterQty = quantity;
            existing.UnitId = unit.UnitId;
            existing.IngredientId = ingredient.IngredientId;
            counts.StockMovementsUpdated++;
            return;
        }

        counts.StockMovementsCreated++;
        var movement = new StockMovement
        {
            MovementId = GuidHelper.NewId(),
            MovementDate = receiptDate.ToDateTime(new TimeOnly(8, 5)),
            WarehouseId = warehouse.WarehouseId,
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            MovementType = "RECEIPT",
            RefTable = "inventoryreceiptlines",
            RefId = receiptLine.ReceiptLineId,
            QuantityIn = quantity,
            QuantityOut = 0,
            BeforeQty = 0,
            AfterQty = quantity,
            Reason = "Import dữ liệu mẫu từ workbook theo dõi đặt hàng",
            Note = "Sample data import",
            PerformedBy = sampleUser.UserId
        };

        if (!dryRun)
        {
            _context.Stockmovements.Add(movement);
        }

        stockMovements.Add(movement);
    }

    private void EnsureCurrentStock(
        Warehouse warehouse,
        Ingredient ingredient,
        Unit unit,
        decimal quantityDelta,
        List<CurrentStock> currentStocks,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        quantityDelta = DecimalPolicy.RoundQuantity(quantityDelta);
        if (quantityDelta == 0)
        {
            return;
        }

        var existing = currentStocks.FirstOrDefault(item =>
            item.WarehouseId.SequenceEqual(warehouse.WarehouseId) &&
            item.IngredientId.SequenceEqual(ingredient.IngredientId));
        if (existing is not null)
        {
            existing.UnitId = unit.UnitId;
            existing.CurrentQty = DecimalPolicy.RoundQuantity(existing.CurrentQty + quantityDelta);
            existing.LastUpdated = DateTime.UtcNow;
            counts.CurrentStockRowsUpdated++;
            return;
        }

        counts.CurrentStockRowsCreated++;
        var stock = new CurrentStock
        {
            WarehouseId = warehouse.WarehouseId,
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            CurrentQty = quantityDelta,
            LastUpdated = DateTime.UtcNow
        };

        if (!dryRun)
        {
            _context.Currentstocks.Add(stock);
        }

        currentStocks.Add(stock);
    }

    private static int EstimateServings(
        MenuSchedule schedule,
        Dictionary<string, List<int>> servingHints,
        Dictionary<string, int> shiftFallbacks)
    {
        var candidates = schedule.Menu.Menuitems
            .Select(item => item.Dish.DishName)
            .SelectMany(dishName => servingHints.GetValueOrDefault(NormalizeName(dishName)) ?? [])
            .Where(value => value > 0)
            .Distinct()
            .ToList();
        if (candidates.Count > 0)
        {
            return Math.Clamp((int)Math.Round(candidates.Average(), MidpointRounding.AwayFromZero), 1, 2000);
        }

        return shiftFallbacks.GetValueOrDefault(schedule.ShiftName, 408);
    }

    private static DateOnly? ExtractMenuWeekStart(IReadOnlyList<IReadOnlyDictionary<string, string>> rows)
    {
        foreach (var row in rows)
        {
            foreach (var value in row.Values)
            {
                var match = Regex.Match(value, @"(\d{1,2})/(\d{1,2})/(\d{4}).*?(\d{1,2})/(\d{1,2})/(\d{4})");
                if (!match.Success)
                {
                    continue;
                }

                return new DateOnly(
                    int.Parse(match.Groups[3].Value, CultureInfo.InvariantCulture),
                    int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture),
                    int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture));
            }
        }

        return null;
    }

    private static DateOnly? ExtractFirstDateFromMenuRows(IReadOnlyList<IReadOnlyDictionary<string, string>> rows)
    {
        foreach (var row in rows)
        {
            foreach (var column in MenuDayColumns)
            {
                var parsed = ParseDate(GetColumn(row, column));
                if (parsed is not null)
                {
                    return parsed;
                }
            }
        }

        return null;
    }

    private static bool TryParseMenuSection(string label, out string variant, out string shiftName)
    {
        variant = string.Empty;
        shiftName = string.Empty;
        var normalized = RemoveDiacritics(label).ToUpperInvariant();
        if (!normalized.Contains("MENU", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (normalized.Contains("CHIEU", StringComparison.OrdinalIgnoreCase))
        {
            shiftName = "AFTERNOON";
        }
        else if (normalized.Contains("SANG", StringComparison.OrdinalIgnoreCase))
        {
            shiftName = "MORNING";
        }
        else
        {
            return false;
        }

        variant = normalized.Contains("CHAY", StringComparison.OrdinalIgnoreCase) ? "Chay" : "Mặn";
        return true;
    }

    private static void ApplySupplierPolicy(Supplier supplier, SupplierPolicy? policy)
    {
        if (policy is null)
        {
            return;
        }

        supplier.DebtPolicy = string.IsNullOrWhiteSpace(policy.DebtPolicy)
            ? supplier.DebtPolicy
            : policy.DebtPolicy;
        supplier.InvoicePolicy = string.IsNullOrWhiteSpace(policy.InvoicePolicy)
            ? supplier.InvoicePolicy
            : policy.InvoicePolicy;
    }

    private static string ResolveSupplierName(string sheetName, Dictionary<string, SupplierPolicy> policies)
    {
        var key = NormalizeSheetKey(sheetName);
        if (policies.TryGetValue(key, out var policy))
        {
            return policy.SupplierName;
        }

        var stripped = Regex.Replace(sheetName.Trim(), @"^\d+\.\s*", string.Empty);
        return stripped.Trim();
    }

    private static void ValidateAmount(
        IReadOnlyDictionary<string, string> row,
        decimal quantity,
        decimal unitPrice,
        SampleDataImportResultDto result,
        string itemName,
        DateOnly deliveryDate)
    {
        var amount = ParseDecimal(Get(row, "Thành tiền"));
        if (amount <= 0)
        {
            return;
        }

        var expected = DecimalPolicy.CalculateLineAmount(quantity, unitPrice);
        if (Math.Abs(expected - DecimalPolicy.RoundMoney(amount)) > 1)
        {
            AddWarning(result, $"Thành tiền lệch ở '{itemName}' ngày {deliveryDate:dd/MM/yyyy}: {amount} != {expected}.");
        }
    }

    private static string Get(IReadOnlyDictionary<string, string> row, string key)
        => row.TryGetValue(key, out var value) ? value.Trim() : string.Empty;

    private static string GetColumn(IReadOnlyDictionary<string, string> row, string column)
        => row.TryGetValue(column, out var value) ? value.Trim() : string.Empty;

    private static int ParseInt(string value)
        => (int)Math.Round(ParseDecimal(value), MidpointRounding.AwayFromZero);

    private static decimal ParseDecimal(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return 0;
        }

        var normalized = value.Trim().Replace(",", ".", StringComparison.Ordinal);
        return decimal.TryParse(
            normalized,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out var parsed)
            ? parsed
            : 0;
    }

    private static DateOnly? ParseDate(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (double.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var serial) &&
            serial > 30000 &&
            serial < 60000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        }

        if (DateTime.TryParse(value, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out var viDate) ||
            DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out viDate))
        {
            return DateOnly.FromDateTime(viDate);
        }

        var match = Regex.Match(value, @"(\d{1,2})/(\d{1,2})/(\d{4})");
        if (match.Success)
        {
            return new DateOnly(
                int.Parse(match.Groups[3].Value, CultureInfo.InvariantCulture),
                int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture),
                int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture));
        }

        return null;
    }

    private static string NormalizeName(string value)
        => Regex.Replace(value.Trim(), @"\s+", " ");

    private static string NormalizeUnitCode(string value)
    {
        var normalized = RemoveDiacritics(value).Trim().ToUpperInvariant();
        return normalized switch
        {
            "" => "UNIT",
            "KG" or "KGS" or "KILOGRAM" or "KY" => "KG",
            "THUNG" => "THUNG",
            "BICH" => "BICH",
            "CAI" => "CAI",
            "CHAI" => "CHAI",
            "GOI" => "GOI",
            _ => Regex.Replace(normalized, @"\s+", "-")
        };
    }

    private static string NormalizeUnitName(string value)
        => string.IsNullOrWhiteSpace(value) ? "Đơn vị" : value.Trim();

    private static string NormalizeSheetKey(string value)
        => Regex.Replace(RemoveDiacritics(value).Trim().ToUpperInvariant(), @"\s+", "");

    private static string StableCode(string prefix, string name)
    {
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(NormalizeName(name).ToUpperInvariant()));
        var suffix = Convert.ToHexString(hash)[..10];
        return $"{prefix}-{suffix}";
    }

    private static string StableLotNumber(string sheetName, DateOnly date, string ingredientName)
    {
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes($"{sheetName}|{date:yyyyMMdd}|{NormalizeName(ingredientName)}"));
        return $"SAMPLE-{Convert.ToHexString(hash)[..16]}";
    }

    private static string ToVietnameseShift(string shiftName)
        => string.Equals(shiftName, "MORNING", StringComparison.OrdinalIgnoreCase) ? "Ca sáng" : "Ca chiều";

    private static string RemoveDiacritics(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(capacity: normalized.Length);
        foreach (var character in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(character);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private static void AddWarning(SampleDataImportResultDto result, string warning)
    {
        if (result.Warnings.Count < 100)
        {
            result.Warnings.Add(warning);
        }
    }

    private sealed record SupplierPolicy(
        string SheetCode,
        string SupplierName,
        string DebtPolicy,
        string InvoicePolicy);

    private sealed record CustomerContractPolicy(
        decimal MenuPrice,
        decimal BomRatePercent,
        bool UsedFallback);
}
