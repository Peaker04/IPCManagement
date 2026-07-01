using System.Globalization;
using System.Text.RegularExpressions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.SampleData;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.SampleData;

public partial class SampleDataImportService
{
    private static readonly string[] MenuDayKeys = ["t2", "t3", "t4", "t5", "t6", "t7", "cn"];

    private static readonly (string Slot, string[] Keywords)[] WeeklyMenuSlotRules =
    [
        ("main", ["MON MAN CHINH", "MON CHAY CHINH", "MON CHINH"]),
        ("sub1", ["PHU 1"]),
        ("sub2", ["PHU 2"]),
        ("sub1", ["PHU"]),
        ("rau", ["RAU"]),
        ("canh", ["CANH", "MON NUOC", "SUA CANH"]),
        ("fruit", ["TRAI CAY", "TRANG MIENG", "SUA CHUA", "SUA"])
    ];

    public async Task<IReadOnlyList<CoordinationCustomerOptionDto>> GetActiveCustomersAsync(
        CancellationToken cancellationToken = default)
        => await _context.Customers
            .Where(customer => customer.IsActive != false)
            .OrderBy(customer => customer.CustomerCode)
            .Select(customer => new CoordinationCustomerOptionDto
            {
                CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
                CustomerCode = customer.CustomerCode,
                CustomerName = customer.CustomerName
            })
            .ToListAsync(cancellationToken);

    public async Task<WeeklyMenuImportResultDto?> GetCommittedWeeklyMenuAsync(
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default)
    {
        var customer = await ResolveImportCustomerAsync(customerId, cancellationToken);
        var customerSchedules = _context.Menuschedules
            .AsNoTracking()
            .Where(schedule => schedule.CustomerId.SequenceEqual(customer.CustomerId));

        var resolvedWeekStart = weekStartDate;
        if (resolvedWeekStart is null)
        {
            var latestSchedule = await customerSchedules
                .OrderByDescending(schedule => schedule.WeekStartDate)
                .ThenByDescending(schedule => schedule.ServiceDate)
                .FirstOrDefaultAsync(cancellationToken);
            if (latestSchedule is null)
            {
                return null;
            }

            resolvedWeekStart = latestSchedule.WeekStartDate;
        }

        var schedules = await customerSchedules
            .Where(schedule => schedule.WeekStartDate == resolvedWeekStart.Value)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(menuItem => menuItem.Dish)
            .OrderBy(schedule => schedule.ServiceDate)
            .ThenBy(schedule => schedule.ShiftName)
            .ToListAsync(cancellationToken);

        if (schedules.Count == 0)
        {
            return null;
        }

        var parsedItems = new List<ParsedWeeklyMenuItem>();
        var rows = new List<WeeklyMenuImportRowDto>();
        foreach (var schedule in schedules)
        {
            var dayKey = DayKey(schedule.ServiceDate.DayOfWeek);
            foreach (var menuItem in schedule.Menu.Menuitems.OrderBy(item => item.DisplayOrder))
            {
                var slotInfo = ParsePersistedDishSlot(menuItem.DishSlot);
                var sourceShiftLabel = ToVietnameseShift(schedule.ShiftName);
                var item = new ParsedWeeklyMenuItem
                {
                    SourceOrder = menuItem.DisplayOrder,
                    ServiceDate = schedule.ServiceDate,
                    DayKey = dayKey,
                    SectionLabel = $"MENU {slotInfo.VariantLabel.ToUpperInvariant()} {sourceShiftLabel.ToUpperInvariant()}",
                    SectionKey = $"{slotInfo.VariantKey}-{schedule.ShiftName.ToLowerInvariant()}",
                    SourceShift = schedule.ShiftName,
                    SourceShiftLabel = sourceShiftLabel,
                    DbShiftName = schedule.ShiftName,
                    VariantKey = slotInfo.VariantKey,
                    VariantLabel = slotInfo.VariantLabel,
                    Slot = slotInfo.Slot,
                    SlotLabel = slotInfo.SlotLabel,
                    DishName = menuItem.Dish.DishName,
                    DishId = GuidHelper.ToGuidString(menuItem.DishId),
                    ExistingDish = true
                };
                parsedItems.Add(item);

                rows.Add(new WeeklyMenuImportRowDto
                {
                    ServiceDate = item.ServiceDate,
                    DayKey = item.DayKey,
                    SourceSection = item.SectionLabel,
                    SourceShift = item.SourceShift,
                    DbShiftName = item.DbShiftName,
                    Variant = item.VariantLabel,
                    Slot = item.Slot,
                    SlotLabel = item.SlotLabel,
                    DishName = item.DishName,
                    DishId = item.DishId,
                    ExistingDish = true
                });
            }
        }

        var result = new WeeklyMenuImportResultDto
        {
            Committed = true,
            FileName = "Persisted weekly menu",
            CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
            CustomerCode = customer.CustomerCode,
            CustomerName = customer.CustomerName,
            WeekStartDate = resolvedWeekStart,
            WeekEndDate = schedules.Max(schedule => schedule.ServiceDate),
            DetectedLayout = new WeeklyMenuImportLayoutDto
            {
                SheetName = "Backend",
                LabelColumn = "DB",
                DayColumns = schedules
                    .GroupBy(schedule => schedule.ServiceDate)
                    .OrderBy(group => group.Key)
                    .Select(group => new WeeklyMenuImportColumnDto
                    {
                        Column = DayKey(group.Key.DayOfWeek),
                        ServiceDate = group.Key,
                        Label = group.Key.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)
                    })
                    .ToList(),
                Sections = parsedItems
                    .Select(item => item.SectionLabel)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList(),
                RowsScanned = parsedItems.Count,
                RowsImported = parsedItems.Count
            },
            Rows = rows
        };

        BuildImportedWeeklyMenu(result, parsedItems);
        return result;
    }

    public async Task<WeeklyMenuImportResultDto> PreviewWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default)
    {
        var customer = await ResolveImportCustomerAsync(customerId, cancellationToken);
        var mapping = await FindCustomerImportMappingAsync(customer.CustomerId, cancellationToken);
        var tempFilePath = await SaveTempWorkbookAsync(fileStream, cancellationToken);
        try
        {
            var plan = ParseWeeklyMenuWorkbook(tempFilePath, fileName, weekStartDate, mapping);
            return await BuildWeeklyMenuImportResultAsync(
                plan,
                customer,
                committed: false,
                cancellationToken);
        }
        finally
        {
            DeleteTempWorkbook(tempFilePath);
        }
    }

    public async Task<WeeklyMenuImportResultDto> CommitWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default)
    {
        var customer = await ResolveImportCustomerAsync(customerId, cancellationToken);
        var mapping = await FindCustomerImportMappingAsync(customer.CustomerId, cancellationToken);
        var tempFilePath = await SaveTempWorkbookAsync(fileStream, cancellationToken);
        try
        {
            var plan = ParseWeeklyMenuWorkbook(tempFilePath, fileName, weekStartDate, mapping);
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            var result = await CommitWeeklyMenuImportPlanAsync(plan, customer, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        finally
        {
            DeleteTempWorkbook(tempFilePath);
        }
    }

    private async Task<Customer> ResolveImportCustomerAsync(string customerId, CancellationToken cancellationToken)
    {
        var customerBytes = GuidHelper.ParseGuidString(customerId);
        if (customerBytes is null)
        {
            throw new ArgumentException("Khách hàng import không hợp lệ.");
        }

        var customer = await _context.Customers
            .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customerBytes), cancellationToken);
        if (customer is null || customer.IsActive == false)
        {
            throw new KeyNotFoundException("Không tìm thấy khách hàng đang hoạt động để import thực đơn.");
        }

        return customer;
    }

    private Task<Customerimportmapping?> FindCustomerImportMappingAsync(
        byte[] customerId,
        CancellationToken cancellationToken)
        => _context.Customerimportmappings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customerId), cancellationToken);

    public async Task<CustomerImportMappingDto?> GetCustomerImportMappingAsync(
        string customerId,
        CancellationToken cancellationToken = default)
    {
        var customer = await ResolveImportCustomerAsync(customerId, cancellationToken);
        var mapping = await FindCustomerImportMappingAsync(customer.CustomerId, cancellationToken);
        return mapping is null
            ? null
            : new CustomerImportMappingDto
            {
                CustomerId = customerId,
                SheetNameHint = mapping.SheetNameHint,
                LabelColumn = mapping.LabelColumn
            };
    }

    public async Task<CustomerImportMappingDto> SaveCustomerImportMappingAsync(
        string customerId,
        SaveCustomerImportMappingDto request,
        CancellationToken cancellationToken = default)
    {
        var customer = await ResolveImportCustomerAsync(customerId, cancellationToken);
        var mapping = await _context.Customerimportmappings
            .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customer.CustomerId), cancellationToken);

        var now = DateTime.UtcNow;
        if (mapping is null)
        {
            mapping = new Customerimportmapping
            {
                MappingId = GuidHelper.NewId(),
                CustomerId = customer.CustomerId,
                CreatedAt = now
            };
            _context.Customerimportmappings.Add(mapping);
        }

        mapping.SheetNameHint = string.IsNullOrWhiteSpace(request.SheetNameHint) ? null : request.SheetNameHint.Trim();
        mapping.LabelColumn = string.IsNullOrWhiteSpace(request.LabelColumn) ? null : request.LabelColumn.Trim().ToUpperInvariant();
        mapping.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        return new CustomerImportMappingDto
        {
            CustomerId = customerId,
            SheetNameHint = mapping.SheetNameHint,
            LabelColumn = mapping.LabelColumn
        };
    }

    private async Task<WeeklyMenuImportResultDto> CommitWeeklyMenuImportPlanAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        CancellationToken cancellationToken)
    {
        var result = await BuildWeeklyMenuImportResultAsync(
            plan,
            customer,
            committed: true,
            cancellationToken);

        var existingDishes = await _context.Dishes.ToListAsync(cancellationToken);
        var existingMenus = await _context.Menus.ToListAsync(cancellationToken);
        var existingMenuItems = await _context.Menuitems.ToListAsync(cancellationToken);
        var existingSchedules = await _context.Menuschedules.ToListAsync(cancellationToken);

        var groupedItems = plan.Items
            .GroupBy(item => new { item.ServiceDate, item.DbShiftName })
            .OrderBy(group => group.Key.ServiceDate)
            .ThenBy(group => group.Key.DbShiftName);

        foreach (var group in groupedItems)
        {
            var lockedSchedule = existingSchedules.FirstOrDefault(item =>
                item.CustomerId.SequenceEqual(customer.CustomerId) &&
                item.ServiceDate == group.Key.ServiceDate &&
                string.Equals(item.ShiftName, group.Key.DbShiftName, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(item.Status, "DRAFT", StringComparison.OrdinalIgnoreCase));
            if (lockedSchedule is not null)
            {
                throw new InvalidOperationException(
                    $"Không thể ghi đè thực đơn {group.Key.ServiceDate:dd/MM/yyyy} {ToVietnameseShift(group.Key.DbShiftName)} vì lịch đã ở trạng thái {lockedSchedule.Status}.");
            }

            var menu = EnsureMenu(
                group.Key.ServiceDate,
                group.Key.DbShiftName,
                customer,
                plan.WeekStartDate,
                plan.WeekEndDate,
                existingMenus,
                dryRun: false,
                result.Counts);

            var staleItems = existingMenuItems
                .Where(item => item.MenuId.SequenceEqual(menu.MenuId))
                .ToList();
            if (staleItems.Count > 0)
            {
                _context.Menuitems.RemoveRange(staleItems);
                existingMenuItems.RemoveAll(item => item.MenuId.SequenceEqual(menu.MenuId));
            }

            var displayOrder = 0;
            foreach (var parsedItem in group.OrderBy(item => item.SourceOrder))
            {
                var dish = EnsureImportedMenuDish(
                    parsedItem.DishName,
                    parsedItem.SectionKey,
                    parsedItem.SlotLabel,
                    existingDishes,
                    dryRun: false,
                    result.Counts);
                parsedItem.DishId = GuidHelper.ToGuidString(dish.DishId);
                parsedItem.ExistingDish = result.Rows.Any(row =>
                    row.DishName.Equals(parsedItem.DishName, StringComparison.OrdinalIgnoreCase) &&
                    row.ExistingDish);

                EnsureMenuItem(
                    menu,
                    dish,
                    $"{parsedItem.VariantKey}-{parsedItem.Slot}",
                    ++displayOrder,
                    existingMenuItems,
                    dryRun: false,
                    result.Counts);
            }

            EnsureMenuSchedule(
                customer,
                menu,
                group.Key.ServiceDate,
                plan.WeekStartDate,
                group.Key.DbShiftName,
                existingSchedules,
                dryRun: false,
                result.Counts);
        }

        ApplyCommittedDishIds(result, plan.Items);
        return result;
    }

    private async Task<WeeklyMenuImportResultDto> BuildWeeklyMenuImportResultAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        bool committed,
        CancellationToken cancellationToken)
    {
        var existingDishes = await _context.Dishes.ToListAsync(cancellationToken);
        var existingByName = existingDishes
            .GroupBy(dish => NormalizeDishMatchKey(dish.DishName), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var result = new WeeklyMenuImportResultDto
        {
            Committed = committed,
            FileName = plan.FileName,
            CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
            CustomerCode = customer.CustomerCode,
            CustomerName = customer.CustomerName,
            WeekStartDate = plan.WeekStartDate,
            WeekEndDate = plan.WeekEndDate,
            DetectedLayout = new WeeklyMenuImportLayoutDto
            {
                SheetName = plan.SheetName,
                LabelColumn = plan.LabelColumn,
                DayColumns = plan.DayColumns
                    .Select(column => new WeeklyMenuImportColumnDto
                    {
                        Column = column.Column,
                        ServiceDate = column.ServiceDate,
                        Label = column.Label
                    })
                    .ToList(),
                Sections = plan.Sections.ToList(),
                RowsScanned = plan.RowsScanned,
                RowsImported = plan.Items.Count,
                RowsSkipped = plan.RowsSkipped
            },
            Warnings = plan.Warnings.ToList()
        };

        foreach (var parsedItem in plan.Items)
        {
            var key = NormalizeDishMatchKey(parsedItem.DishName);
            if (existingByName.TryGetValue(key, out var existingDish))
            {
                parsedItem.DishId = GuidHelper.ToGuidString(existingDish.DishId);
                parsedItem.ExistingDish = true;
            }

            result.Rows.Add(new WeeklyMenuImportRowDto
            {
                ServiceDate = parsedItem.ServiceDate,
                DayKey = parsedItem.DayKey,
                SourceSection = parsedItem.SectionLabel,
                SourceShift = parsedItem.SourceShift,
                DbShiftName = parsedItem.DbShiftName,
                Variant = parsedItem.VariantLabel,
                Slot = parsedItem.Slot,
                SlotLabel = parsedItem.SlotLabel,
                DishName = parsedItem.DishName,
                DishId = parsedItem.DishId,
                ExistingDish = parsedItem.ExistingDish
            });
        }

        BuildImportedWeeklyMenu(result, plan.Items);
        return result;
    }

    private WeeklyMenuImportPlan ParseWeeklyMenuWorkbook(
        string workbookPath,
        string originalFileName,
        DateOnly? weekStartFallback,
        Customerimportmapping? mapping = null)
    {
        var sheetCandidates = _reader.GetSheetNames(workbookPath)
            .Select(sheetName =>
            {
                var rows = _reader.ReadRows(workbookPath, sheetName, 240);
                return new WeeklyMenuSheetCandidate(sheetName, rows, ScoreMenuSheet(sheetName, rows));
            })
            .ToList();

        // Cấu hình mapping đã lưu cho khách hàng (nếu có) được ưu tiên trước khi dò tự động,
        // để hỗ trợ nhiều mẫu file khác nhau theo từng khách hàng (FULL-001).
        var sheetsMatchingHint = string.IsNullOrWhiteSpace(mapping?.SheetNameHint)
            ? []
            : sheetCandidates
                .Where(candidate => candidate.SheetName.Contains(mapping.SheetNameHint, StringComparison.OrdinalIgnoreCase))
                .ToList();

        var best = (sheetsMatchingHint.Count > 0 ? sheetsMatchingHint : sheetCandidates)
            .OrderByDescending(candidate => candidate.Score)
            .FirstOrDefault();
        if (best is null || best.Score < 20)
        {
            throw new InvalidOperationException("File Excel không có bảng thực đơn tuần hợp lệ.");
        }

        var labelColumn = !string.IsNullOrWhiteSpace(mapping?.LabelColumn)
            ? mapping.LabelColumn
            : DetectLabelColumn(best.Rows);
        if (labelColumn is null)
        {
            throw new InvalidOperationException("Không xác định được cột nhãn món trong file thực đơn.");
        }

        var weekStart = ExtractWeekStart(best.Rows, originalFileName, weekStartFallback);
        var dayColumns = DetectDayColumns(best.Rows, labelColumn, weekStart, weekStartFallback);
        if (dayColumns.Count == 0)
        {
            throw new InvalidOperationException("Không xác định được cột ngày. Vui lòng nhập ngày bắt đầu tuần rồi thử lại.");
        }

        var resolvedWeekStart = dayColumns.Min(item => item.ServiceDate);
        var weekEnd = dayColumns.Max(item => item.ServiceDate);
        var plan = new WeeklyMenuImportPlan(
            originalFileName,
            best.SheetName,
            labelColumn,
            resolvedWeekStart,
            weekEnd,
            best.Rows.Count,
            dayColumns);

        ParseMenuRows(best.Rows, labelColumn, dayColumns, plan);
        if (plan.Items.Count == 0)
        {
            throw new InvalidOperationException("File Excel không có dòng món ăn hợp lệ để import.");
        }

        return plan;
    }

    private static int ScoreMenuSheet(
        string sheetName,
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows)
    {
        var score = NormalizeText(sheetName).Contains("MENU", StringComparison.OrdinalIgnoreCase) ? 8 : 0;
        foreach (var row in rows.Take(80))
        {
            foreach (var value in row.Values)
            {
                if (IsWeeklyMenuSection(value))
                {
                    score += 15;
                }
                else if (ResolveWeeklyMenuSlot(value) is not null)
                {
                    score += 3;
                }
                else if (ParseImportDate(value) is not null || ContainsWeekdayLabel(value))
                {
                    score += 1;
                }
            }
        }

        return score;
    }

    private static string? DetectLabelColumn(IReadOnlyList<IReadOnlyDictionary<string, string>> rows)
    {
        var scores = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows.Take(80))
        {
            foreach (var (column, value) in row)
            {
                var points = 0;
                if (IsWeeklyMenuSection(value))
                {
                    points += 20;
                }

                if (ResolveWeeklyMenuSlot(value) is not null)
                {
                    points += 8;
                }

                if (points > 0)
                {
                    scores[column] = scores.GetValueOrDefault(column) + points;
                }
            }
        }

        return scores.Count == 0
            ? null
            : scores.OrderByDescending(item => item.Value)
                .ThenBy(item => ColumnLetterToIndex(item.Key))
                .First()
                .Key;
    }

    private static List<WeeklyMenuImportDayColumn> DetectDayColumns(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string labelColumn,
        DateOnly? detectedWeekStart,
        DateOnly? weekStartFallback)
    {
        var labelIndex = ColumnLetterToIndex(labelColumn);
        var datedRows = rows
            .Take(60)
            .Select((row, rowIndex) => new
            {
                RowIndex = rowIndex,
                Dates = row
                    .Where(item => ColumnLetterToIndex(item.Key) > labelIndex)
                    .Select(item => new { item.Key, Date = ParseDayColumnDate(item.Value) })
                    .Where(item => item.Date is not null)
                    .GroupBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(group => group.Key, group => group.First().Date!.Value, StringComparer.OrdinalIgnoreCase)
            })
            .Where(item => item.Dates.Count > 0)
            .OrderByDescending(item => item.Dates.Count)
            .ThenBy(item => item.RowIndex)
            .ToList();

        var datedColumns = datedRows.FirstOrDefault()?.Dates;
        if (datedColumns is not null && datedColumns.Count > 0)
        {
            return datedColumns
                .OrderBy(item => ColumnLetterToIndex(item.Key))
                .Select((item, index) =>
                {
                    var serviceDate = ResolveDayColumnDate(
                        rows,
                        item.Key,
                        item.Value,
                        index,
                        detectedWeekStart ?? weekStartFallback);
                    return new WeeklyMenuImportDayColumn(
                        item.Key,
                        serviceDate,
                        ResolveDayKeyForColumn(rows, item.Key, index),
                        FormatDayColumnLabel(item.Key, serviceDate));
                })
                .ToList();
        }

        var start = detectedWeekStart ?? weekStartFallback;
        if (start is null)
        {
            return [];
        }

        var weekdayColumns = rows
            .Take(60)
            .SelectMany(row => row)
            .Where(item => ColumnLetterToIndex(item.Key) > labelIndex && ContainsWeekdayLabel(item.Value))
            .Select(item => item.Key)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(ColumnLetterToIndex)
            .ToList();

        var candidateColumns = weekdayColumns.Count > 0
            ? weekdayColumns
            : DetectDishValueColumns(rows, labelColumn);

        return candidateColumns
            .Take(7)
            .Select((column, index) => new WeeklyMenuImportDayColumn(
                column,
                start.Value.AddDays(index),
                ResolveDayKeyForColumn(rows, column, index),
                FormatDayColumnLabel(column, start.Value.AddDays(index))))
            .ToList();
    }

    private static string ResolveDayKeyForColumn(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string column,
        int fallbackIndex)
    {
        foreach (var row in rows.Take(60))
        {
            var dayKey = ParseWeekdayDayKey(GetColumnValue(row, column));
            if (dayKey is not null)
            {
                return dayKey;
            }
        }

        return fallbackIndex >= 0 && fallbackIndex < MenuDayKeys.Length
            ? MenuDayKeys[fallbackIndex]
            : "t2";
    }

    private static DateOnly ResolveDayColumnDate(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string column,
        DateOnly parsedDate,
        int fallbackIndex,
        DateOnly? weekStart)
    {
        var dayKey = ResolveDayKeyForColumn(rows, column, fallbackIndex);
        if (weekStart is null || DayOfWeekForKey(dayKey) == parsedDate.DayOfWeek)
        {
            return parsedDate;
        }

        return weekStart.Value.AddDays(fallbackIndex);
    }

    private static DayOfWeek? DayOfWeekForKey(string dayKey)
        => dayKey switch
        {
            "t2" => DayOfWeek.Monday,
            "t3" => DayOfWeek.Tuesday,
            "t4" => DayOfWeek.Wednesday,
            "t5" => DayOfWeek.Thursday,
            "t6" => DayOfWeek.Friday,
            "t7" => DayOfWeek.Saturday,
            "cn" => DayOfWeek.Sunday,
            _ => null
        };

    private static List<string> DetectDishValueColumns(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string labelColumn)
    {
        var labelIndex = ColumnLetterToIndex(labelColumn);
        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var inSection = false;
        foreach (var row in rows.Take(100))
        {
            var label = GetColumnValue(row, labelColumn);
            if (IsWeeklyMenuSection(label))
            {
                inSection = true;
                continue;
            }

            if (!inSection || ResolveWeeklyMenuSlot(label) is null)
            {
                continue;
            }

            foreach (var (column, value) in row)
            {
                if (ColumnLetterToIndex(column) > labelIndex && !string.IsNullOrWhiteSpace(value))
                {
                    columns.Add(column);
                }
            }
        }

        return columns
            .OrderBy(ColumnLetterToIndex)
            .ToList();
    }

    private static DateOnly? ExtractWeekStart(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string fileName,
        DateOnly? weekStartFallback)
    {
        foreach (var value in rows.Take(30).SelectMany(row => row.Values).Concat([fileName]))
        {
            var parsed = ParseDateRangeStart(value, weekStartFallback?.Year);
            if (parsed is not null)
            {
                return parsed;
            }
        }

        return weekStartFallback;
    }

    private static void ParseMenuRows(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string labelColumn,
        IReadOnlyList<WeeklyMenuImportDayColumn> dayColumns,
        WeeklyMenuImportPlan plan)
    {
        WeeklyMenuSection? currentSection = null;
        var sourceOrder = 0;

        foreach (var row in rows)
        {
            var label = GetColumnValue(row, labelColumn);
            if (string.IsNullOrWhiteSpace(label))
            {
                plan.RowsSkipped++;
                continue;
            }

            if (TryParseWeeklyMenuSection(label, out var section))
            {
                currentSection = section;
                if (!plan.Sections.Contains(section.SectionLabel, StringComparer.OrdinalIgnoreCase))
                {
                    plan.Sections.Add(section.SectionLabel);
                }

                if (!string.Equals(section.SourceShift, section.DbShiftName, StringComparison.OrdinalIgnoreCase))
                {
                    AddWarning(plan, $"Quy đổi ca {section.SourceShiftLabel} sang {ToVietnameseShift(section.DbShiftName)} vì DB hiện chỉ có ca sáng/chiều.");
                }

                continue;
            }

            if (currentSection is null)
            {
                plan.RowsSkipped++;
                continue;
            }

            var slot = ResolveWeeklyMenuSlot(label);
            if (slot is null)
            {
                plan.RowsSkipped++;
                continue;
            }

            foreach (var dayColumn in dayColumns)
            {
                var dishName = NormalizeDishCell(GetColumnValue(row, dayColumn.Column));
                if (string.IsNullOrWhiteSpace(dishName))
                {
                    continue;
                }

                if (IsHolidayCell(dishName))
                {
                    plan.RowsSkipped++;
                    continue;
                }

                plan.Items.Add(new ParsedWeeklyMenuItem
                {
                    SourceOrder = ++sourceOrder,
                    ServiceDate = dayColumn.ServiceDate,
                    DayKey = dayColumn.DayKey,
                    SectionLabel = currentSection.SectionLabel,
                    SectionKey = currentSection.SectionKey,
                    SourceShift = currentSection.SourceShift,
                    SourceShiftLabel = currentSection.SourceShiftLabel,
                    DbShiftName = currentSection.DbShiftName,
                    VariantKey = currentSection.VariantKey,
                    VariantLabel = currentSection.VariantLabel,
                    Slot = slot,
                    SlotLabel = label.Trim(),
                    DishName = dishName
                });
            }
        }
    }

    private static bool TryParseWeeklyMenuSection(string value, out WeeklyMenuSection section)
    {
        section = default!;
        if (!IsWeeklyMenuSection(value))
        {
            return false;
        }

        var normalized = NormalizeText(value);
        var sourceShift = normalized.Contains("CHIEU", StringComparison.OrdinalIgnoreCase)
            ? "AFTERNOON"
            : normalized.Contains("TOI", StringComparison.OrdinalIgnoreCase)
                ? "DINNER"
                : normalized.Contains("TRUA", StringComparison.OrdinalIgnoreCase)
                    ? "LUNCH"
                    : "MORNING";
        var dbShift = sourceShift is "AFTERNOON" or "DINNER" ? "AFTERNOON" : "MORNING";
        var variantKey = normalized.Contains("CHAY", StringComparison.OrdinalIgnoreCase) ? "vegetarian" : "savory";
        var variantLabel = variantKey == "vegetarian" ? "Chay" : "Mặn";
        var shiftLabel = sourceShift switch
        {
            "AFTERNOON" => "Ca chiều",
            "DINNER" => "Ca tối",
            "LUNCH" => "Ca trưa",
            _ => "Ca sáng"
        };

        section = new WeeklyMenuSection(
            value.Trim(),
            $"{variantKey}-{sourceShift.ToLowerInvariant()}",
            sourceShift,
            shiftLabel,
            dbShift,
            variantKey,
            variantLabel);
        return true;
    }

    private static bool IsWeeklyMenuSection(string? value)
    {
        var normalized = NormalizeText(value);
        return normalized.Contains("MENU", StringComparison.OrdinalIgnoreCase) &&
               (normalized.Contains("MAN", StringComparison.OrdinalIgnoreCase) ||
                normalized.Contains("CHAY", StringComparison.OrdinalIgnoreCase)) &&
               (normalized.Contains("SANG", StringComparison.OrdinalIgnoreCase) ||
                normalized.Contains("CHIEU", StringComparison.OrdinalIgnoreCase) ||
                normalized.Contains("TRUA", StringComparison.OrdinalIgnoreCase) ||
                normalized.Contains("TOI", StringComparison.OrdinalIgnoreCase));
    }

    private static string? ResolveWeeklyMenuSlot(string? value)
    {
        var normalized = NormalizeText(value);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        foreach (var (slot, keywords) in WeeklyMenuSlotRules)
        {
            if (keywords.Any(keyword => normalized.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
            {
                return slot;
            }
        }

        return string.Equals(normalized, "MON", StringComparison.OrdinalIgnoreCase) ? "main" : null;
    }

    private static DateOnly? ParseImportDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (double.TryParse(value.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var serial) &&
            serial > 30000 &&
            serial < 60000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        }

        var parsedRange = ParseDateRangeStart(value, null);
        if (parsedRange is not null)
        {
            return parsedRange;
        }

        return ParseDate(value);
    }

    private static DateOnly? ParseDayColumnDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (double.TryParse(trimmed, NumberStyles.Number, CultureInfo.InvariantCulture, out var serial) &&
            serial > 30000 &&
            serial < 60000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        }

        if (Regex.IsMatch(NormalizeText(trimmed), @"[A-Z]", RegexOptions.IgnoreCase))
        {
            return null;
        }

        return ParseDate(trimmed);
    }

    private static DateOnly? ParseDateRangeStart(string? value, int? fallbackYear)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var match = Regex.Match(value, @"(?<!\d)(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?(?!\d)");
        if (!match.Success)
        {
            return null;
        }

        var year = fallbackYear ?? DateTime.UtcNow.Year;
        if (match.Groups[3].Success)
        {
            year = int.Parse(match.Groups[3].Value, CultureInfo.InvariantCulture);
            if (year < 100)
            {
                year += 2000;
            }
        }

        var day = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
        var month = int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture);
        return month is >= 1 and <= 12 && day is >= 1 and <= 31
            ? new DateOnly(year, month, day)
            : null;
    }

    private static bool ContainsWeekdayLabel(string? value)
    {
        return ParseWeekdayDayKey(value) is not null;
    }

    private static string? ParseWeekdayDayKey(string? value)
    {
        var normalized = NormalizeText(value);
        if (normalized.Contains("CHU NHAT", StringComparison.OrdinalIgnoreCase))
        {
            return "cn";
        }

        var match = Regex.Match(normalized, @"\bTHU\s*([2-7])\b", RegexOptions.IgnoreCase);
        return match.Success ? $"t{match.Groups[1].Value}" : null;
    }

    private static void BuildImportedWeeklyMenu(
        WeeklyMenuImportResultDto result,
        IReadOnlyList<ParsedWeeklyMenuItem> parsedItems)
    {
        foreach (var dayKey in MenuDayKeys)
        {
            result.ImportedWeeklyMenu[dayKey] = new ImportedDayMenuDto();
        }

        foreach (var item in parsedItems)
        {
            var dayMenu = result.ImportedWeeklyMenu[item.DayKey];
            var slotDto = GetImportedSlot(dayMenu, item.DbShiftName, item.VariantKey);
            if (slotDto.Portions == 0)
            {
                slotDto.Portions = DefaultImportPortions(item.DbShiftName, item.VariantKey);
            }

            if (item.Slot == "main" && !string.IsNullOrWhiteSpace(item.DishId))
            {
                slotDto.DishId = item.DishId;
            }

            ApplyImportedComponent(slotDto.CustomComponents, item.Slot, item.DishName);
        }
    }

    private static ImportedMenuSlotDto GetImportedSlot(
        ImportedDayMenuDto day,
        string dbShiftName,
        string variantKey)
        => (dbShiftName, variantKey) switch
        {
            ("MORNING", "vegetarian") => day.MorningVegetarian,
            ("AFTERNOON", "vegetarian") => day.AfternoonVegetarian,
            ("AFTERNOON", _) => day.AfternoonSavory,
            _ => day.MorningSavory
        };

    private static void ApplyImportedComponent(ImportedCustomComponentsDto components, string slot, string dishName)
    {
        switch (slot)
        {
            case "main":
                components.Main = dishName;
                break;
            case "sub1":
                components.Sub1 = dishName;
                break;
            case "sub2":
                components.Sub2 = dishName;
                break;
            case "rau":
                components.Rau = dishName;
                break;
            case "canh":
                components.Canh = dishName;
                break;
            case "fruit":
                components.Fruit = dishName;
                break;
        }
    }

    private static int DefaultImportPortions(string dbShiftName, string variantKey)
        => (dbShiftName, variantKey) switch
        {
            ("MORNING", "vegetarian") => 150,
            ("AFTERNOON", "vegetarian") => 150,
            ("AFTERNOON", _) => 870,
            _ => 840
        };

    private static (string VariantKey, string VariantLabel, string Slot, string SlotLabel) ParsePersistedDishSlot(string? dishSlot)
    {
        var parts = (dishSlot ?? string.Empty).Split('-', 2, StringSplitOptions.TrimEntries);
        var variantKey = parts.Length > 0 && string.Equals(parts[0], "vegetarian", StringComparison.OrdinalIgnoreCase)
            ? "vegetarian"
            : "savory";
        var slot = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1])
            ? parts[1]
            : "main";

        var slotLabel = slot switch
        {
            "sub1" => "Phụ 1",
            "sub2" => "Phụ 2",
            "rau" => "Rau",
            "canh" => "Canh",
            "fruit" => "Trái cây",
            _ => "Món chính"
        };

        return (variantKey, variantKey == "vegetarian" ? "Chay" : "Mặn", slot, slotLabel);
    }

    private static void ApplyCommittedDishIds(
        WeeklyMenuImportResultDto result,
        IReadOnlyList<ParsedWeeklyMenuItem> parsedItems)
    {
        var idsByKey = parsedItems
            .Where(item => !string.IsNullOrWhiteSpace(item.DishId))
            .GroupBy(item => $"{item.ServiceDate:yyyyMMdd}|{item.DbShiftName}|{item.VariantKey}|{item.Slot}|{NormalizeDishMatchKey(item.DishName)}")
            .ToDictionary(group => group.Key, group => group.First().DishId);

        foreach (var row in result.Rows)
        {
            var key = $"{row.ServiceDate:yyyyMMdd}|{row.DbShiftName}|{(row.Variant == "Chay" ? "vegetarian" : "savory")}|{row.Slot}|{NormalizeDishMatchKey(row.DishName)}";
            if (idsByKey.TryGetValue(key, out var dishId))
            {
                row.DishId = dishId;
            }
        }

        result.ImportedWeeklyMenu.Clear();
        BuildImportedWeeklyMenu(result, parsedItems);
    }

    private Dish EnsureImportedMenuDish(
        string dishName,
        string dishGroup,
        string dishType,
        List<Dish> dishes,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var normalized = NormalizeDishMatchKey(dishName);
        var existing = dishes.FirstOrDefault(item =>
            string.Equals(NormalizeDishMatchKey(item.DishName), normalized, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.DishGroup = string.IsNullOrWhiteSpace(dishGroup) ? existing.DishGroup : dishGroup.Trim();
            existing.DishType = string.IsNullOrWhiteSpace(dishType) ? existing.DishType : dishType.Trim();
            existing.IsActive = true;
            counts.DishesUpdated++;
            return existing;
        }

        return EnsureDish(dishName, dishGroup, dishType, dishes, dryRun, counts);
    }

    private static string GetColumnValue(IReadOnlyDictionary<string, string> row, string column)
        => row.TryGetValue(column, out var value) ? value.Trim() : string.Empty;

    private static string NormalizeDishCell(string value)
        => Regex.Replace(value.Trim(), @"\s+", " ");

    private static string NormalizeText(string? value)
        => Regex.Replace(RemoveDiacritics(value ?? string.Empty).Trim().ToUpperInvariant(), @"\s+", " ");

    private static string NormalizeDishMatchKey(string? value)
    {
        var normalized = RemoveDiacritics(value ?? string.Empty)
            .Replace('Đ', 'D')
            .Replace('đ', 'd')
            .Trim()
            .ToUpperInvariant();
        normalized = Regex.Replace(normalized, @"\b\d+\s*(G|GRAM)\b", " ", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\s+", " ");
        return normalized.Trim();
    }

    private static bool IsHolidayCell(string value)
    {
        var normalized = NormalizeText(value);
        return normalized.Contains("NGHI LE", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("NGHI", StringComparison.OrdinalIgnoreCase);
    }

    private static string FormatDayColumnLabel(string column, DateOnly serviceDate)
        => $"{column} - {serviceDate:dd/MM/yyyy}";

    private static string DayKey(DayOfWeek dayOfWeek)
        => dayOfWeek switch
        {
            DayOfWeek.Monday => "t2",
            DayOfWeek.Tuesday => "t3",
            DayOfWeek.Wednesday => "t4",
            DayOfWeek.Thursday => "t5",
            DayOfWeek.Friday => "t6",
            DayOfWeek.Saturday => "t7",
            DayOfWeek.Sunday => "cn",
            _ => "t2"
        };

    private static int ColumnLetterToIndex(string column)
    {
        var result = 0;
        foreach (var character in column.ToUpperInvariant())
        {
            result = (result * 26) + character - 'A' + 1;
        }

        return result;
    }

    private static void AddWarning(WeeklyMenuImportPlan plan, string warning)
    {
        if (!plan.Warnings.Contains(warning, StringComparer.OrdinalIgnoreCase))
        {
            plan.Warnings.Add(warning);
        }
    }

    private static async Task<string> SaveTempWorkbookAsync(Stream fileStream, CancellationToken cancellationToken)
    {
        var tempFilePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        await using var fileOut = new FileStream(tempFilePath, FileMode.CreateNew, FileAccess.Write);
        await fileStream.CopyToAsync(fileOut, cancellationToken);
        return tempFilePath;
    }

    private static void DeleteTempWorkbook(string tempFilePath)
    {
        if (File.Exists(tempFilePath))
        {
            File.Delete(tempFilePath);
        }
    }

    private sealed record WeeklyMenuSheetCandidate(
        string SheetName,
        IReadOnlyList<IReadOnlyDictionary<string, string>> Rows,
        int Score);

    private sealed record WeeklyMenuImportDayColumn(
        string Column,
        DateOnly ServiceDate,
        string DayKey,
        string Label);

    private sealed record WeeklyMenuSection(
        string SectionLabel,
        string SectionKey,
        string SourceShift,
        string SourceShiftLabel,
        string DbShiftName,
        string VariantKey,
        string VariantLabel);

    private sealed class WeeklyMenuImportPlan
    {
        public WeeklyMenuImportPlan(
            string fileName,
            string sheetName,
            string labelColumn,
            DateOnly weekStartDate,
            DateOnly weekEndDate,
            int rowsScanned,
            IReadOnlyList<WeeklyMenuImportDayColumn> dayColumns)
        {
            FileName = fileName;
            SheetName = sheetName;
            LabelColumn = labelColumn;
            WeekStartDate = weekStartDate;
            WeekEndDate = weekEndDate;
            RowsScanned = rowsScanned;
            DayColumns = dayColumns;
        }

        public string FileName { get; }
        public string SheetName { get; }
        public string LabelColumn { get; }
        public DateOnly WeekStartDate { get; }
        public DateOnly WeekEndDate { get; }
        public int RowsScanned { get; }
        public int RowsSkipped { get; set; }
        public IReadOnlyList<WeeklyMenuImportDayColumn> DayColumns { get; }
        public List<string> Sections { get; } = [];
        public List<string> Warnings { get; } = [];
        public List<ParsedWeeklyMenuItem> Items { get; } = [];
    }

    private sealed class ParsedWeeklyMenuItem
    {
        public int SourceOrder { get; set; }
        public DateOnly ServiceDate { get; set; }
        public string DayKey { get; set; } = string.Empty;
        public string SectionLabel { get; set; } = string.Empty;
        public string SectionKey { get; set; } = string.Empty;
        public string SourceShift { get; set; } = string.Empty;
        public string SourceShiftLabel { get; set; } = string.Empty;
        public string DbShiftName { get; set; } = string.Empty;
        public string VariantKey { get; set; } = string.Empty;
        public string VariantLabel { get; set; } = string.Empty;
        public string Slot { get; set; } = string.Empty;
        public string SlotLabel { get; set; } = string.Empty;
        public string DishName { get; set; } = string.Empty;
        public string? DishId { get; set; }
        public bool ExistingDish { get; set; }
    }
}
