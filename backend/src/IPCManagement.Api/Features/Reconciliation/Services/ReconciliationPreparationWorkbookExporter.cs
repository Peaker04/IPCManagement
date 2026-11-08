using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationPreparationWorkbookExporter(
    IpcManagementContext context,
    SystemOperationRequestContext? requestContext = null)
{
    public async Task<ReconciliationPreparationWorkbookDto> GetWorkbookAsync(
        ReconciliationPreparationWorkbookQuery query,
        CancellationToken token = default)
    {
        EnsureReconciliationMode();
        var (start, end) = query.GetDateRange();

        var dailyQuery = context.Reconciliationbatchdailylines.AsNoTracking()
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Ingredient).ThenInclude(i => i.Unit)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.CanonicalUnit)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Batch)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Contributors.Where(contributor => contributor.InvalidatedAt == null))
            .Where(d => d.RequiredQuantity > 0);

        dailyQuery = dailyQuery.Where(d => d.ServiceDate >= start && d.ServiceDate <= end);

        if (query.BatchIds is not null && query.BatchIds.Count > 0)
        {
            var parsedBatchBytes = query.BatchIds.Select(ReconciliationBatchService.RequiredId).ToList();
            dailyQuery = dailyQuery.Where(d => parsedBatchBytes.Contains(d.BatchId));
        }

        var dailyLines = await dailyQuery.ToListAsync(token);
        if (dailyLines.Count == 0)
        {
            return new ReconciliationPreparationWorkbookDto([], [], [], 0m, 0m);
        }

        var distinctBatchIds = dailyLines.Select(d => d.BatchId).Distinct(ByteArrayComparer.Instance).ToList();
        var batches = await context.Reconciliationbatches.AsNoTracking()
            .Where(b => distinctBatchIds.Contains(b.BatchId))
            .ToListAsync(token);

        var menuVersionIds = batches.Select(b => b.MenuVersionId).Distinct(ByteArrayComparer.Instance).ToList();
        var menuVersions = await context.Menuversions.AsNoTracking()
            .Include(mv => mv.Customer)
            .Where(mv => menuVersionIds.Contains(mv.MenuVersionId))
            .ToDictionaryAsync(mv => Convert.ToHexString(mv.MenuVersionId), StringComparer.Ordinal, token);

        if (query.CustomerIds is not null && query.CustomerIds.Count > 0)
        {
            var targetCustomerIds = query.CustomerIds.Select(ReconciliationBatchService.RequiredId).ToList();
            batches = batches.Where(b =>
            {
                var mvHex = Convert.ToHexString(b.MenuVersionId);
                return menuVersions.TryGetValue(mvHex, out var mv) && mv?.CustomerId != null && targetCustomerIds.Any(c => c.SequenceEqual(mv.CustomerId));
            }).ToList();

            var allowedBatchIds = batches.Select(b => b.BatchId).ToList();
            dailyLines = dailyLines.Where(d => allowedBatchIds.Any(b => b.SequenceEqual(d.BatchId))).ToList();
        }

        if (dailyLines.Count == 0)
        {
            return new ReconciliationPreparationWorkbookDto([], [], [], 0m, 0m);
        }

        var existingIssues = await context.Inventoryissues.AsNoTracking()
            .Include(i => i.Inventoryissuelines)
            .Where(i => i.ReconciliationBatchId != null && distinctBatchIds.Contains(i.ReconciliationBatchId))
            .ToListAsync(token);

        var issueLinesByDailyLineId = existingIssues
            .SelectMany(i => i.Inventoryissuelines)
            .Where(l => l.ReconciliationBatchDailyLineId != null)
            .GroupBy(l => Convert.ToHexString(l.ReconciliationBatchDailyLineId!))
            .ToDictionary(g => g.Key, g => g.Sum(l => l.IssuedQty), StringComparer.Ordinal);

        var ingredientIds = dailyLines.Select(d => d.IngredientId).Distinct(ByteArrayComparer.Instance).ToList();
        var quotations = await context.Supplierquotations.AsNoTracking()
            .Include(sq => sq.Supplier)
            .Where(sq => ingredientIds.Contains(sq.IngredientId) && (sq.IsActive == null || sq.IsActive == true) && (sq.Supplier.IsActive == null || sq.Supplier.IsActive == true))
            .ToListAsync(token);

        string ResolveSupplierName(byte[] ingredientId, DateOnly serviceDate)
        {
            var matching = quotations.Where(q => q.IngredientId.SequenceEqual(ingredientId)
                && q.EffectiveFrom <= serviceDate
                && (q.EffectiveTo == null || q.EffectiveTo >= serviceDate)).ToList();

            var distinctSuppliers = matching.Select(q => q.Supplier.SupplierName).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            return distinctSuppliers.Count == 1 ? distinctSuppliers[0] : "Chưa xác định nhà cung cấp";
        }

        var detailRows = new List<ReconciliationPreparationDetailRowDto>();

        foreach (var daily in dailyLines)
        {
            var bHex = Convert.ToHexString(daily.BatchId);
            var batch = batches.FirstOrDefault(b => b.BatchId.SequenceEqual(daily.BatchId));
            if (batch is null) continue;

            var mvHex = Convert.ToHexString(batch.MenuVersionId);
            menuVersions.TryGetValue(mvHex, out var menuVersion);

            var supplier = ResolveSupplierName(daily.IngredientId, daily.ServiceDate);
            if (!string.IsNullOrWhiteSpace(query.SupplierName) && !string.Equals(supplier, query.SupplierName.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var dailyHex = Convert.ToHexString(daily.DailyLineId);
            var issued = issueLinesByDailyLineId.TryGetValue(dailyHex, out var issVal) ? issVal : (decimal?)null;
            if (query.IsSupplemental == true)
            {
                continue;
            }

            var shiftName = daily.BatchLine.Contributors
                .Where(c => c.InvalidatedAt == null
                    && c.DailyLineId != null && c.DailyLineId.SequenceEqual(daily.DailyLineId))
                .Select(c => c.FrozenShiftName)
                .Distinct()
                .FirstOrDefault() ?? "Cả ngày";

            var issueStatus = ReconciliationDailyIssuePolicy.ResolveLineStatus(daily.RequiredQuantity, issued, false).QuantityStatus;

            detailRows.Add(new ReconciliationPreparationDetailRowDto(
                menuVersion?.CustomerId is null ? string.Empty : GuidHelper.ToGuidString(menuVersion.CustomerId),
                menuVersion?.Customer?.CustomerCode ?? string.Empty,
                menuVersion?.Customer?.CustomerName ?? "Chưa rõ khách hàng",
                GuidHelper.ToGuidString(daily.BatchId),
                daily.ServiceDate,
                shiftName,
                GuidHelper.ToGuidString(daily.IngredientId),
                daily.BatchLine.Ingredient.IngredientCode,
                daily.BatchLine.Ingredient.IngredientName,
                GuidHelper.ToGuidString(daily.CanonicalUnitId),
                daily.BatchLine.CanonicalUnit.UnitName,
                daily.RequiredQuantity,
                "Xuất ban đầu",
                issueStatus,
                supplier));
        }

        if (query.IsSupplemental != false)
        {
            var deltaQuery = context.Reconciliationsourcedeltas.AsNoTracking()
                .Include(d => d.DailyLine).ThenInclude(dl => dl!.BatchLine).ThenInclude(bl => bl.Ingredient)
                .Include(d => d.DailyLine).ThenInclude(dl => dl!.BatchLine).ThenInclude(bl => bl.CanonicalUnit)
                .Where(d => d.WorkKind == "SUPPLEMENTAL_ISSUE" && d.DeltaQuantity > 0);

            deltaQuery = deltaQuery.Where(d => d.ServiceDate >= start && d.ServiceDate <= end);

            if (query.BatchIds is not null && query.BatchIds.Count > 0)
            {
                var parsedBatchBytes = query.BatchIds.Select(ReconciliationBatchService.RequiredId).ToList();
                deltaQuery = deltaQuery.Where(d => parsedBatchBytes.Contains(d.BatchId));
            }

            var deltas = await deltaQuery.ToListAsync(token);
            foreach (var delta in deltas)
            {
                var batch = batches.FirstOrDefault(b => b.BatchId.SequenceEqual(delta.BatchId));
                if (batch is null) continue;

                var mvHex = Convert.ToHexString(batch.MenuVersionId);
                menuVersions.TryGetValue(mvHex, out var menuVersion);

                var supplier = ResolveSupplierName(delta.IngredientId, delta.ServiceDate);
                if (!string.IsNullOrWhiteSpace(query.SupplierName) && !string.Equals(supplier, query.SupplierName.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var shiftName = "Cả ngày";
                var issueStatus = delta.Status == "RESOLVED" ? "Đã xuất bổ sung" : "Chờ xuất bổ sung";

                detailRows.Add(new ReconciliationPreparationDetailRowDto(
                    menuVersion?.CustomerId is null ? string.Empty : GuidHelper.ToGuidString(menuVersion.CustomerId),
                    menuVersion?.Customer?.CustomerCode ?? string.Empty,
                    menuVersion?.Customer?.CustomerName ?? "Chưa rõ khách hàng",
                    GuidHelper.ToGuidString(delta.BatchId),
                    delta.ServiceDate,
                    shiftName,
                    GuidHelper.ToGuidString(delta.IngredientId),
                    delta.DailyLine?.BatchLine?.Ingredient?.IngredientCode ?? string.Empty,
                    delta.DailyLine?.BatchLine?.Ingredient?.IngredientName ?? "Nguyên liệu",
                    GuidHelper.ToGuidString(delta.CanonicalUnitId),
                    delta.DailyLine?.BatchLine?.CanonicalUnit?.UnitName ?? string.Empty,
                    delta.DeltaQuantity,
                    "Xuất bổ sung",
                    issueStatus,
                    supplier));
            }
        }

        var menuRows = new List<ReconciliationPreparationMenuRowDto>();
        var customerDefinitionsById = new Dictionary<string, ReconciliationPreparationCustomerColumnDto>(StringComparer.Ordinal);
        static void RegisterCustomer(
            Dictionary<string, ReconciliationPreparationCustomerColumnDto> map,
            string customerId,
            string customerCode,
            string customerName)
        {
            if (string.IsNullOrWhiteSpace(customerId) || string.IsNullOrWhiteSpace(customerCode))
                throw new InvalidOperationException("Thiếu hoặc không khớp định danh khách hàng trong bảng chuẩn bị.");
            if (map.TryGetValue(customerId, out var existing))
            {
                if (!string.Equals(existing.CustomerCode, customerCode, StringComparison.Ordinal) ||
                    !string.Equals(existing.CustomerName, customerName, StringComparison.Ordinal))
                {
                    throw new InvalidOperationException("Thiếu hoặc không khớp định danh khách hàng trong bảng chuẩn bị.");
                }
                return;
            }
            map[customerId] = new ReconciliationPreparationCustomerColumnDto(customerId, customerCode, customerName);
        }

        foreach (var row in detailRows)
            RegisterCustomer(customerDefinitionsById, row.CustomerId, row.CustomerCode, row.CustomerName);

        if (query.IncludeMenus)
        {
            var cooking = new ReconciliationKitchenExportService(context);
            foreach (var batch in batches.OrderBy(item => Convert.ToHexString(item.BatchId), StringComparer.Ordinal))
            {
                var batchId = GuidHelper.ToGuidString(batch.BatchId);
                var document = await cooking.GetAsync(batchId, token)
                    ?? throw new BusinessRuleException("Không tìm thấy nguồn thực đơn đóng băng cho lô đã chọn.");
                var version = menuVersions[Convert.ToHexString(batch.MenuVersionId)];
                if (version.CustomerId is null || version.Customer is null)
                    throw new BusinessRuleException("Thiếu khách hàng nguồn của thực đơn đóng băng.");
                var customerId = GuidHelper.ToGuidString(version.CustomerId);
                RegisterCustomer(customerDefinitionsById, customerId, version.Customer.CustomerCode, version.Customer.CustomerName);
                var dishes = document.Rows.Where(row => row.ServiceDate >= start && row.ServiceDate <= end)
                    .GroupBy(row => new { row.ServiceDate, row.ShiftName, row.MenuVariant, row.DishCode });
                foreach (var dish in dishes)
                {
                    var first = dish.First();
                    if (dish.Any(row => row.Servings != first.Servings || row.DishName != first.DishName))
                        throw new BusinessRuleException("Các đóng góp của món không thống nhất số suất hoặc tên đóng băng.");
                    menuRows.Add(new ReconciliationPreparationMenuRowDto(
                        customerId, version.Customer.CustomerName, batchId,
                        first.ServiceDate, first.ShiftName switch { "Ca sáng" => "Sáng", "Ca chiều" => "Chiều", _ => first.ShiftName },
                        first.MenuVariant, first.DishCode, first.DishName, first.Servings));
                }
            }
        }

        var customerDefinitions = customerDefinitionsById.Values
            .OrderBy(customer => customer.CustomerCode, StringComparer.Ordinal)
            .ThenBy(customer => customer.CustomerId, StringComparer.Ordinal).ToList();
        var customerColumns = customerDefinitions.Select(customer => $"{customer.CustomerCode} · {customer.CustomerName}").ToList();

        var summaryRows = detailRows
            .GroupBy(d => new { d.SupplierName, d.IngredientId, d.CanonicalUnitId })
            .Select(g =>
            {
                var first = g.First();
                var customerQtys = new Dictionary<string, decimal>(StringComparer.Ordinal);
                foreach (var customer in customerDefinitions)
                    customerQtys[customer.CustomerId] = g.Where(row => row.CustomerId == customer.CustomerId).Sum(row => row.Quantity);

                var totalQty = customerQtys.Values.Sum();
                return new ReconciliationPreparationSummaryRowDto(
                    first.SupplierName,
                    first.IngredientId,
                    first.IngredientCode,
                    first.IngredientName,
                    first.CanonicalUnitId,
                    first.CanonicalUnitName,
                    customerQtys,
                    totalQty);
            })
            .OrderBy(s => s.SupplierName)
            .ThenBy(s => s.IngredientName)
            .ToList();

        var summaryTotal = summaryRows.Sum(s => s.TotalQuantity);
        var detailTotal = detailRows.Sum(d => d.Quantity);

        return new ReconciliationPreparationWorkbookDto(customerColumns, summaryRows, detailRows, summaryTotal, detailTotal)
        {
            CustomerColumnDefinitions = customerDefinitions,
            ScopeStartDate = start, ScopeEndDate = end,
            MenuRows = menuRows.OrderBy(row => row.CustomerName, StringComparer.Ordinal)
                .ThenBy(row => row.ServiceDate).ThenBy(row => row.ShiftName, StringComparer.Ordinal)
                .ThenBy(row => row.MenuVariant, StringComparer.Ordinal).ThenBy(row => row.DishCode, StringComparer.Ordinal).ToList()
        };
    }

    public async Task<byte[]> ExportWorkbookXlsxAsync(
        ReconciliationPreparationWorkbookQuery query,
        CancellationToken token = default)
    {
        var workbook = await GetWorkbookAsync(query, token);
        return PreparationWorkbookBuilder.BuildXlsx(workbook);
    }

    private void EnsureReconciliationMode()
    {
        if (requestContext is not null && !string.Equals(requestContext.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal))
        {
            throw new BusinessRuleException("Chuẩn bị nguyên liệu chỉ được thực hiện trong chế độ đối chiếu nguyên liệu.");
        }
    }

    private sealed class ByteArrayComparer : IEqualityComparer<byte[]>
    {
        public static readonly ByteArrayComparer Instance = new();
        public bool Equals(byte[]? x, byte[]? y) => System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(x, y);
        public int GetHashCode(byte[] obj) => System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(obj);
    }
}
