using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public sealed class DataQualityReportService : IDataQualityReportService
{
    private const string DataQualityBusinessArea = "DataQuality";
    private const string DataQualityIssueEntityName = "DataQualityIssue";
    private const string DataQualityRemediationFieldName = "Remediation";
    private const string PublishedBomStatus = "PUBLISHED";
    private static readonly decimal[] SupportedBomPriceTiers = [25000m, 30000m, 34000m];

    private readonly IpcManagementContext _context;
    private readonly IStockLedgerReportService _stockLedgerReportService;

    public DataQualityReportService(IpcManagementContext context)
        : this(context, new StockLedgerReportService(context))
    {
    }

    public DataQualityReportService(
        IpcManagementContext context,
        IStockLedgerReportService stockLedgerReportService)
    {
        _context = context;
        _stockLedgerReportService = stockLedgerReportService;
    }

    public async Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query)
    {
        var requestedLimit = DataQualityPolicy.NormalizeLimit(query.Limit);
        var limit = requestedLimit + 1;
        var serviceDate = DataQualityPolicy.ParseDateOnly(query.ServiceDate) ?? DataQualityPolicy.ParseDateOnly(query.DateFrom) ?? ServiceCalendar.Today();
        var issues = new List<DataQualityIssueDto>();
        var operationalDishKeys = (await _context.Productionplanlines
                .AsNoTracking()
                .Where(line =>
                    line.Plan.PlanDate >= serviceDate &&
                    (line.Plan.Status == "CREATED" || line.Plan.Status == "SENTTOKITCHEN"))
                .Select(line => line.DishId)
                .Distinct()
                .ToListAsync())
            .Select(Convert.ToBase64String)
            .ToHashSet(StringComparer.Ordinal);

        var missingBomDishes = await _context.Dishes
            .AsNoTracking()
            .Where(dish => (dish.IsActive ?? true) && !_context.Dishboms.Any(bom =>
                bom.DishId == dish.DishId &&
                SupportedBomPriceTiers.Contains(bom.PriceTierAmount) &&
                bom.BomStatus == PublishedBomStatus &&
                bom.EffectiveFrom <= serviceDate &&
                (bom.EffectiveTo == null || bom.EffectiveTo >= serviceDate)))
            .OrderBy(dish => dish.DishCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(missingBomDishes.Select(dish =>
        {
            var isOperational = operationalDishKeys.Contains(Convert.ToBase64String(dish.DishId));
            return BuildDataQualityIssue(
            isOperational ? "missing_bom" : "legacy_missing_bom",
            isOperational ? "error" : "warning",
            nameof(Dish),
            GuidHelper.ToGuidString(dish.DishId),
            dish.DishCode,
            dish.DishName,
            isOperational
                ? "Món đang được dùng trong KHSX hiện tại/tương lai nhưng chưa có BOM hiệu lực."
                : "Món catalog cũ chưa có BOM hiệu lực và không được KHSX hiện tại/tương lai tham chiếu.",
            isOperational
                ? "Import BOM đúng tier trước khi tiếp tục KHSX."
                : "Bổ sung BOM trước khi dùng lại món; không chặn luồng hiện tại.",
            DataQualityPolicy.BuildMissingBomRemediationRoute(dish.DishId, serviceDate, query));
        }));

        var invalidUnitIngredients = await _context.Ingredients
            .AsNoTracking()
            .Include(item => item.Unit)
            .Where(item => (item.IsActive ?? true) && (
                item.Unit.UnitCode == "" ||
                item.Unit.UnitName == "" ||
                item.Unit.ConvertRateToBase <= 0))
            .OrderBy(item => item.IngredientCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(invalidUnitIngredients.Select(ingredient => BuildDataQualityIssue(
            "invalid_unit",
            "error",
            nameof(Ingredient),
            GuidHelper.ToGuidString(ingredient.IngredientId),
            ingredient.IngredientCode,
            ingredient.IngredientName,
            $"Nguyên liệu dùng đơn vị '{ingredient.Unit.UnitCode}' nhưng mã/tên/hệ số quy đổi không hợp lệ.",
            "Chuẩn hóa đơn vị hoặc cập nhật nguyên liệu trước khi tính BOM/kho.",
            "/admin-data")));

        var activeBomLines = await _context.Dishboms
            .AsNoTracking()
            .Include(item => item.Dish)
            .Include(item => item.Ingredient)
                .ThenInclude(ingredient => ingredient.Unit)
            .Include(item => item.Unit)
            .Where(item =>
                SupportedBomPriceTiers.Contains(item.PriceTierAmount) &&
                item.BomStatus == PublishedBomStatus &&
                item.EffectiveFrom <= serviceDate &&
                (item.EffectiveTo == null || item.EffectiveTo >= serviceDate))
            .OrderBy(item => item.Dish.DishCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(activeBomLines
            .Where(line => !DataQualityPolicy.CanConvertUnits(line.Unit, line.Ingredient.Unit))
            .Select(line => BuildDataQualityIssue(
                "missing_conversion",
                "error",
                nameof(DishBom),
                GuidHelper.ToGuidString(line.BomId),
                line.Dish.DishCode,
                line.Ingredient.IngredientName,
                $"BOM dùng đơn vị '{line.Unit.UnitName}' nhưng nguyên liệu đang theo '{line.Ingredient.Unit.UnitName}' và chưa có cấu hình quy đổi hợp lệ.",
                "Cập nhật base unit / hệ số quy đổi của đơn vị trước khi tính demand hoặc sinh mua thêm.",
                "/admin-data")));

        var legacyBomLines = await _context.Dishboms
            .AsNoTracking()
            .Include(item => item.Dish)
            .Include(item => item.Ingredient)
            .Where(item =>
                !SupportedBomPriceTiers.Contains(item.PriceTierAmount) &&
                item.BomStatus == PublishedBomStatus &&
                item.EffectiveFrom <= serviceDate &&
                (item.EffectiveTo == null || item.EffectiveTo >= serviceDate))
            .OrderBy(item => item.Dish.DishCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(legacyBomLines.Select(line => BuildDataQualityIssue(
            "legacy_bom_tier",
            "error",
            nameof(DishBom),
            GuidHelper.ToGuidString(line.BomId),
            line.Dish.DishCode,
            line.Ingredient.IngredientName,
            $"Dòng BOM đang dùng đơn giá cũ/lệch {line.PriceTierAmount:0.##}. Chỉ chấp nhận tier 25000, 30000 hoặc 34000.",
            "Tải mẫu BOM thiếu/theo món rồi import lại bằng Excel để tạo BOM theo tier mới.",
            DataQualityPolicy.BuildMissingBomRemediationRoute(line.DishId, serviceDate, query))));

        var stockUnitLines = await _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
                .ThenInclude(ingredient => ingredient.Unit)
            .Include(item => item.Unit)
            .OrderBy(item => item.Warehouse.WarehouseCode)
            .ThenBy(item => item.Ingredient.IngredientCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(stockUnitLines
            .Where(stock => !DataQualityPolicy.CanConvertUnits(stock.Unit, stock.Ingredient.Unit))
            .Select(stock => BuildDataQualityIssue(
                "missing_conversion",
                "error",
                nameof(CurrentStock),
                $"{GuidHelper.ToGuidString(stock.WarehouseId)}:{GuidHelper.ToGuidString(stock.IngredientId)}",
                stock.Warehouse.WarehouseCode,
                stock.Ingredient.IngredientName,
                $"Tồn kho đang dùng đơn vị '{stock.Unit.UnitName}' nhưng nguyên liệu đang theo '{stock.Ingredient.Unit.UnitName}' và chưa có cấu hình quy đổi hợp lệ.",
                "Cập nhật quy đổi unit hoặc chuẩn hóa đơn vị tồn kho trước khi generate demand.",
                "/admin-data")));

        var receiptUnitLines = await _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
            .Include(item => item.Ingredient)
                .ThenInclude(ingredient => ingredient.Unit)
            .Include(item => item.Unit)
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(receiptUnitLines
            .Where(line => !DataQualityPolicy.CanConvertUnits(line.Unit, line.Ingredient.Unit))
            .Select(line => BuildDataQualityIssue(
                line.Receipt.ReceiptDate < serviceDate ? "legacy_missing_conversion" : "missing_conversion",
                "warning",
                nameof(InventoryReceiptLine),
                GuidHelper.ToGuidString(line.ReceiptLineId),
                line.Receipt.ReceiptCode,
                line.Ingredient.IngredientName,
                $"Lịch sử nhập hàng dùng đơn vị '{line.Unit.UnitName}' nhưng nguyên liệu đang theo '{line.Ingredient.Unit.UnitName}' và chưa có cấu hình quy đổi hợp lệ.",
                "Bổ sung quy đổi unit để giá mua tham chiếu không lệch khi sinh purchase request.",
                "/reports")));

        var inactiveBomIngredients = await _context.Dishboms
            .AsNoTracking()
            .Include(item => item.Dish)
            .Include(item => item.Ingredient)
            .Where(item =>
                SupportedBomPriceTiers.Contains(item.PriceTierAmount) &&
                item.BomStatus == PublishedBomStatus &&
                item.EffectiveFrom <= serviceDate &&
                (item.EffectiveTo == null || item.EffectiveTo >= serviceDate) &&
                item.Ingredient.IsActive == false)
            .OrderBy(item => item.Dish.DishCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(inactiveBomIngredients.Select(line => BuildDataQualityIssue(
            "inactive_bom_ingredient",
            "warning",
            nameof(DishBom),
            GuidHelper.ToGuidString(line.BomId),
            line.Dish.DishCode,
            line.Dish.DishName,
            $"BOM đang dùng nguyên liệu đã khóa: {line.Ingredient.IngredientName}.",
            "Đổi nguyên liệu trong BOM hoặc mở lại nguyên liệu nếu vẫn dùng.",
            "/admin-data")));

        var negativeStocks = await _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .Where(item => item.CurrentQty < 0)
            .OrderBy(item => item.Warehouse.WarehouseCode)
            .ThenBy(item => item.Ingredient.IngredientCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(negativeStocks.Select(stock => BuildDataQualityIssue(
            "negative_stock",
            "error",
            nameof(CurrentStock),
            $"{GuidHelper.ToGuidString(stock.WarehouseId)}:{GuidHelper.ToGuidString(stock.IngredientId)}",
            stock.Warehouse.WarehouseCode,
            stock.Ingredient.IngredientName,
            $"Tồn kho âm {DecimalPolicy.RoundQuantity(stock.CurrentQty)} {stock.Unit.UnitName}.",
            "Kiểm tra phiếu xuất/nhập hoặc tạo điều chỉnh tồn.",
            "/admin-data")));

        var ledgerMismatches = (await _stockLedgerReportService.GetStockLedgerReconciliationAsync(new WorkflowReportQueryDto
        {
            WarehouseId = query.WarehouseId,
            IngredientId = query.IngredientId,
            Limit = limit
        }))
            .Where(item => !item.IsMatched)
            .ToList();

        issues.AddRange(ledgerMismatches.Select(item => BuildDataQualityIssue(
            "inventory_ledger_mismatch",
            "error",
            nameof(CurrentStock),
            $"{item.WarehouseId}:{item.IngredientId}",
            item.WarehouseName ?? item.WarehouseId,
            item.IngredientName ?? item.IngredientId,
            $"Current stock {item.CurrentQty} {item.UnitName} không khớp ledger {item.LedgerQty} {item.UnitName}. Lệch {item.DifferenceQty} {item.UnitName}.",
            "Đối chiếu stock movements và tạo điều chỉnh tồn qua ledger, không sửa trực tiếp current stock.",
            "/reports")));

        var stockShortageAudits = await _context.Auditlogs
            .AsNoTracking()
            .Where(log => log.BusinessArea == "StockException" && log.FieldName == "StockShortage")
            .OrderByDescending(log => log.ChangedAt)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(stockShortageAudits.Select(log => BuildDataQualityIssue(
            "stock_shortage",
            "error",
            log.EntityName,
            log.EntityId == null ? null : GuidHelper.ToGuidString(log.EntityId),
            log.ChangedAt.ToString("yyyy-MM-dd HH:mm"),
            log.NewValue ?? "Thiếu tồn kho",
            log.Reason ?? "Không đủ tồn kho để xuất nguyên liệu.",
            "Nhập kho bổ sung, giảm số lượng xuất hoặc tạo đề xuất mua thêm trước khi xuất kho.",
            "/warehouse")));

        var missingContractPlans = await _context.Productionplans
            .AsNoTracking()
            .Include(plan => plan.Customer)
            .Where(plan =>
                plan.PlanDate >= serviceDate &&
                (plan.Status == "CREATED" || plan.Status == "SENTTOKITCHEN") &&
                plan.CustomerId != null &&
                !_context.Customercontracts.Any(contract =>
                    contract.CustomerId == plan.CustomerId &&
                    contract.Status == "ACTIVE" &&
                    contract.EffectiveFrom <= plan.PlanDate &&
                    (contract.EffectiveTo == null || contract.EffectiveTo >= plan.PlanDate)))
            .OrderBy(plan => plan.PlanCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(missingContractPlans.Select(plan => BuildDataQualityIssue(
            "missing_contract",
            "error",
            nameof(ProductionPlan),
            GuidHelper.ToGuidString(plan.PlanId),
            plan.PlanCode,
            plan.Customer?.CustomerName ?? GuidHelper.ToGuidString(plan.CustomerId!),
            "KHSX có khách hàng nhưng chưa có hợp đồng hiệu lực cho ngày phục vụ.",
            "Tạo hoặc công bố hợp đồng khách hàng trước khi chốt giá và định lượng.",
            "/admin-data?view=contracts")));

        var inactiveSupplierLines = await _context.Purchaserequestlines
            .AsNoTracking()
            .Include(line => line.PurchaseRequest)
            .Include(line => line.Supplier)
            .Include(line => line.Ingredient)
            .Where(line => line.SupplierId != null && line.Supplier != null && line.Supplier.IsActive == false)
            .OrderBy(line => line.PurchaseRequest.PurchaseRequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(inactiveSupplierLines.Select(line => BuildDataQualityIssue(
            "missing_supplier",
            "error",
            nameof(PurchaseRequestLine),
            GuidHelper.ToGuidString(line.PurchaseRequestLineId),
            line.PurchaseRequest.PurchaseRequestCode,
            $"{line.Ingredient.IngredientName} / {line.Supplier!.SupplierName}",
            "Dòng mua thêm đang gán nhà cung cấp đã khóa hoặc không còn dùng được.",
            "Chọn lại nhà cung cấp active hoặc bổ sung báo giá trước khi gửi mua.",
            "/purchasing")));

        var staleDemands = await _context.Materialrequests
            .AsNoTracking()
            .Where(request => request.Status == "CANCELLED")
            .OrderBy(request => request.RequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(staleDemands.Select(request => BuildDataQualityIssue(
            "stale_demand",
            "warning",
            nameof(MaterialRequest),
            GuidHelper.ToGuidString(request.RequestId),
            request.RequestCode,
            request.RequestDate.ToString("yyyy-MM-dd"),
            "Demand đã bị hủy do menu/KHSX thay đổi và cần sinh lại trước khi mua/xuất kho.",
            "Chạy lại generate demand từ KHSX hiện tại.",
            "/weekly-menu")));

        var stalePurchaseRequests = await _context.Purchaserequests
            .AsNoTracking()
            .Where(request => request.Status == "CANCELLED")
            .OrderBy(request => request.PurchaseRequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(stalePurchaseRequests.Select(request => BuildDataQualityIssue(
            "stale_purchase_request",
            "warning",
            nameof(PurchaseRequest),
            GuidHelper.ToGuidString(request.PurchaseRequestId),
            request.PurchaseRequestCode,
            request.PurchaseForDate.ToString("yyyy-MM-dd"),
            "Đề xuất mua đã bị hủy do demand/menu thay đổi và không còn là nguồn mua hợp lệ.",
            "Sinh lại purchase request từ demand hiện tại.",
            "/purchasing")));

        var kitchenReceiptDiscrepancies = await _context.Auditlogs
            .AsNoTracking()
            .Where(log => log.BusinessArea == "KitchenReceipt" && log.FieldName == "KitchenReceiptDiscrepancy")
            .OrderByDescending(log => log.ChangedAt)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(kitchenReceiptDiscrepancies.Select(log => BuildDataQualityIssue(
            "kitchen_receipt_discrepancy",
            "warning",
            log.EntityName,
            log.EntityId == null ? null : GuidHelper.ToGuidString(log.EntityId),
            log.ChangedAt.ToString("yyyy-MM-dd HH:mm"),
            log.NewValue ?? "Bếp báo chênh lệch khi nhận nguyên liệu",
            log.Reason ?? "Bếp báo nguyên liệu nhận thực tế khác phiếu xuất.",
            "Đối chiếu phiếu xuất với bếp và tạo phiếu điều chỉnh/hoàn kho nếu cần.",
            "/chef")));

        var orphanMaterialRequests = await _context.Materialrequests
            .AsNoTracking()
            .Where(request => !_context.Productionplans.Any(plan => plan.PlanId == request.PlanId))
            .OrderBy(request => request.RequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(orphanMaterialRequests.Select(request => BuildDataQualityIssue(
            "orphan_document",
            "warning",
            nameof(MaterialRequest),
            GuidHelper.ToGuidString(request.RequestId),
            request.RequestCode,
            request.Status,
            "Yêu cầu nguyên liệu không còn KHSX gốc.",
            "Sinh lại demand từ KHSX hoặc kiểm tra dữ liệu import.",
            "/weekly-menu")));

        var orphanPurchaseLines = await _context.Purchaserequestlines
            .AsNoTracking()
            .Include(line => line.PurchaseRequest)
            .Include(line => line.Ingredient)
            .Where(line => !_context.Materialrequestlines.Any(materialLine => materialLine.RequestLineId == line.MaterialRequestLineId))
            .OrderBy(line => line.PurchaseRequest.PurchaseRequestCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(orphanPurchaseLines.Select(line => BuildDataQualityIssue(
            "orphan_document",
            "warning",
            nameof(PurchaseRequestLine),
            GuidHelper.ToGuidString(line.PurchaseRequestLineId),
            line.PurchaseRequest.PurchaseRequestCode,
            line.Ingredient.IngredientName,
            "Dòng mua thêm không còn dòng demand gốc.",
            "Sinh lại danh sách mua thêm từ demand hiện tại.",
            "/weekly-menu")));

        var orphanIssues = await _context.Inventoryissues
            .AsNoTracking()
            .Where(issue =>
                issue.MaterialRequestId != null && issue.ReconciliationBatchId == null &&
                !_context.Materialrequests.Any(request => request.RequestId == issue.MaterialRequestId))
            .OrderBy(issue => issue.IssueCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(orphanIssues.Select(issue => BuildDataQualityIssue(
            "orphan_document",
            "warning",
            nameof(InventoryIssue),
            GuidHelper.ToGuidString(issue.IssueId),
            issue.IssueCode,
            issue.IssueDate.ToString("yyyy-MM-dd"),
            "Phiếu xuất không còn demand/material request gốc.",
            "Kiểm tra lại workflow kho và demand đã sinh.",
            "/warehouse",
            sourceFamily: "DEFAULT",
            materialRequestId: GuidHelper.ToGuidString(issue.MaterialRequestId!))));

        var unitNormalizationReviews = await _context.Unitnormalizationreviews
            .AsNoTracking()
            .Include(review => review.Ingredient)
            .Include(review => review.SourceUnit)
            .Include(review => review.CatalogUnit)
            .Include(review => review.RecommendedUnit)
            .Where(review => review.Status == "NEEDS_CONFIRMATION")
            .OrderBy(review => review.Ingredient.IngredientCode)
            .Take(limit)
            .ToListAsync();

        issues.AddRange(unitNormalizationReviews.Select(review =>
        {
            var factor = review.ProposedSourceToCatalogFactor is null
                ? "chưa đủ bằng chứng để đề xuất hệ số"
                : $"hệ số đề xuất {review.ProposedSourceToCatalogFactor:0.######} " +
                  $"{review.CatalogUnit.UnitCode}/{review.SourceUnit.UnitCode}";
            var recommendedUnit = review.RecommendedUnit?.UnitCode ?? review.CatalogUnit.UnitCode;
            return BuildDataQualityIssue(
                "unit_normalization_review",
                "warning",
                nameof(UnitNormalizationReview),
                GuidHelper.ToGuidString(review.ReviewId),
                review.Ingredient.IngredientCode,
                $"{review.SourceUnit.UnitCode} → {recommendedUnit}",
                $"Cần duyệt quy cách theo từng nguyên liệu: {factor}. " +
                $"Confidence={review.Confidence}. Evidence: {review.EvidenceNote}",
                "Kiểm tra nhãn quy cách/nhà cung cấp và chỉ approve khi hệ số source-to-catalog được xác nhận; review này chưa được engine sử dụng.",
                "/admin-data?view=cleanup");
        }));

        var distinctIssues = issues
            .DistinctBy(issue => issue.IssueId, StringComparer.OrdinalIgnoreCase)
            .OrderBy(issue => issue.PriorityRank)
            .ThenBy(issue => issue.Severity == "error" ? 0 : 1)
            .ThenBy(issue => issue.Category)
            .ThenBy(issue => issue.EntityCode)
            .ToList();
        var isTruncated = distinctIssues.Count > requestedLimit;
        var sortedIssues = distinctIssues.Take(requestedLimit).ToList();

        await ApplyDataQualityRemediationStateAsync(sortedIssues);

        return new DataQualityReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            TotalIssues = sortedIssues.Count,
            IsTruncated = isTruncated,
            ErrorCount = sortedIssues.Count(issue => issue.Severity == "error" && issue.RemediationStatus != "resolved"),
            WarningCount = sortedIssues.Count(issue => issue.Severity == "warning" && issue.RemediationStatus != "resolved"),
            ResolvedIssueCount = sortedIssues.Count(issue => issue.RemediationStatus == "resolved"),
            ReopenedIssueCount = sortedIssues.Count(issue => issue.RemediationStatus == "reopened"),
            UrgentIssueCount = sortedIssues.Count(issue => issue.PriorityRank <= 2 && issue.RemediationStatus != "resolved"),
            MissingBomCount = sortedIssues.Count(issue => issue.Category == "missing_bom"),
            InvalidUnitCount = sortedIssues.Count(issue => issue.Category is "invalid_unit" or "inactive_bom_ingredient"),
            MissingConversionCount = sortedIssues.Count(issue => issue.Category == "missing_conversion"),
            NegativeStockCount = sortedIssues.Count(issue => issue.Category == "negative_stock"),
            OrphanDocumentCount = sortedIssues.Count(issue => issue.Category == "orphan_document"),
            Issues = sortedIssues
        };
    }

    public async Task<DataQualityPageDto> GetDataQualityPageAsync(DataQualityPageQueryDto query)
    {
        var sourceQuery = DataQualityPolicy.CloneQuery(query, 500);
        var report = await GetDataQualityAsync(sourceQuery);
        var searchKeyword = query.SearchKeyword?.Trim();
        var filteredIssues = string.IsNullOrWhiteSpace(searchKeyword)
            ? report.Issues
            : report.Issues.Where(issue => MatchesSearch(issue, searchKeyword)).ToList();
        var pageItems = filteredIssues
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        return new DataQualityPageDto
        {
            GeneratedAt = report.GeneratedAt,
            TotalIssues = report.TotalIssues,
            IsTruncated = report.IsTruncated,
            ErrorCount = report.ErrorCount,
            WarningCount = report.WarningCount,
            ResolvedIssueCount = report.ResolvedIssueCount,
            ReopenedIssueCount = report.ReopenedIssueCount,
            UrgentIssueCount = report.UrgentIssueCount,
            MissingBomCount = report.MissingBomCount,
            InvalidUnitCount = report.InvalidUnitCount,
            MissingConversionCount = report.MissingConversionCount,
            NegativeStockCount = report.NegativeStockCount,
            OrphanDocumentCount = report.OrphanDocumentCount,
            Issues = pageItems,
            Page = PagedResponseDto<DataQualityIssueDto>.Create(
                pageItems,
                filteredIssues.Count,
                query.PageNumber,
                query.PageSize)
        };
    }

    private static bool MatchesSearch(DataQualityIssueDto issue, string searchKeyword)
        => new[]
        {
            issue.IssueId,
            issue.Category,
            issue.Severity,
            issue.Owner,
            issue.SlaLabel,
            issue.EntityName,
            issue.EntityCode,
            issue.EntityLabel,
            issue.Message,
            issue.SuggestedAction,
            issue.RemediationStatus,
            issue.RemediationByName,
            issue.RemediationNote
        }.Any(value => value?.Contains(searchKeyword, StringComparison.OrdinalIgnoreCase) == true);

    private async Task ApplyDataQualityRemediationStateAsync(IReadOnlyList<DataQualityIssueDto> issues)
    {
        if (issues.Count == 0)
        {
            return;
        }

        var issueIds = issues.Select(issue => issue.IssueId).ToList();
        var remediationLogs = await _context.Auditlogs
            .AsNoTracking()
            .Include(log => log.ChangedByNavigation)
            .Where(log =>
                log.BusinessArea == DataQualityBusinessArea &&
                log.EntityName == DataQualityIssueEntityName &&
                log.FieldName == DataQualityRemediationFieldName &&
                log.OldValue != null &&
                issueIds.Contains(log.OldValue))
            .OrderByDescending(log => log.ChangedAt)
            .ToListAsync();

        var latestByIssue = remediationLogs
            .GroupBy(log => log.OldValue!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var issue in issues)
        {
            if (!latestByIssue.TryGetValue(issue.IssueId, out var log))
            {
                continue;
            }

            issue.RemediationStatus = DataQualityPolicy.NormalizeRemediationStatus(log.NewValue);
            issue.RemediationAt = log.ChangedAt;
            issue.RemediationByName = log.ChangedByNavigation.FullName ?? log.ChangedByNavigation.Username;
            issue.RemediationNote = log.Reason;
        }
    }

    private static DataQualityIssueDto BuildDataQualityIssue(
        string category,
        string severity,
        string entityName,
        string? entityId,
        string entityCode,
        string entityLabel,
        string message,
        string suggestedAction,
        string route,
        string? sourceFamily = null,
        string? materialRequestId = null,
        string? materialRequestLineId = null,
        string? reconciliationBatchId = null,
        string? reconciliationBatchLineId = null)
    {
        var issue = DataQualityPolicy.BuildIssue(
            category, severity, entityName, entityId, entityCode,
            entityLabel, message, suggestedAction, route, DateTime.UtcNow);
        issue.SourceFamily = sourceFamily;
        issue.MaterialRequestId = materialRequestId;
        issue.MaterialRequestLineId = materialRequestLineId;
        issue.ReconciliationBatchId = reconciliationBatchId;
        issue.ReconciliationBatchLineId = reconciliationBatchLineId;
        return issue;
    }
}
