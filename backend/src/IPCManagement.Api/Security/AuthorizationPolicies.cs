namespace IPCManagement.Api.Security;

public static class AuthorizationPolicies
{
    public const string AdminAccess = "AdminAccess";
    public const string CatalogAccess = "CatalogAccess";
    public const string CoordinationAccess = "CoordinationAccess";
    public const string InventoryAccess = "InventoryAccess";
    public const string ProductionAccess = "ProductionAccess";
    public const string DemandGenerateAccess = "DemandGenerateAccess";
    public const string PurchaseAccess = "PurchaseAccess";
    public const string PurchaseGenerateAccess = "PurchaseGenerateAccess";
    public const string WarehouseAccess = "WarehouseAccess";

    public static readonly string[] AdminRoles =
    [
        "Admin", "ADMIN"
    ];

    public static readonly string[] CatalogRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý"
    ];

    public static readonly string[] CoordinationRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý",
        "Coordinator", "COORDINATOR", "Điều phối"
    ];

    public static readonly string[] InventoryRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý",
        "ProcurementStaff", "Procurement Staff",
        "WarehouseManager", "Warehouse Manager", "WarehouseStaff", "Warehouse Staff", "Thủ kho",
        "Purchasing", "PURCHASING", "PurchaseStaff", "Purchase Staff", "Nhân viên mua hàng", "Thu mua"
    ];

    public static readonly string[] ProductionRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý",
        "Chef", "HeadChef", "Head Chef", "Kitchen", "Bếp trưởng"
    ];

    public static readonly string[] PurchaseRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý",
        "Purchasing", "PURCHASING", "PurchaseStaff", "Purchase Staff", "Nhân viên mua hàng", "Thu mua"
    ];

    public static readonly string[] WarehouseRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý",
        "ProcurementStaff", "Procurement Staff",
        "WarehouseManager", "Warehouse Manager", "WarehouseStaff", "Warehouse Staff", "Thủ kho"
    ];

    public const string AuthProfileRead = "auth.profile.read";
    public const string DashboardRead = "dashboard.read";
    public const string CatalogRead = "catalog.read";
    public const string CatalogWrite = "catalog.write";
    public const string CoordinationRead = "coordination.read";
    public const string CoordinationOrderLock = "coordination.order.lock";
    public const string CoordinationOrderAdjust = "coordination.order.adjust";
    public const string CoordinationOrderSignoff = "coordination.order.signoff";
    public const string DemandGenerate = "demand.generate";
    public const string InventoryRead = "inventory.read";
    public const string PurchaseRead = "purchase.read";
    public const string PurchaseGenerate = "purchase.generate";
    public const string PurchaseRequestApprove = "purchase.request.approve";
    public const string PurchaseQuotationManage = "purchase.quotation.manage";
    public const string InventoryReceiptApprove = "inventory.receipt.approve";
    public const string InventoryIssueApprove = "inventory.issue.approve";
    public const string InventoryAdjustmentApprove = "inventory.adjustment.approve";
    public const string ProductionRead = "production.read";
    public const string WarehouseRead = "warehouse.read";
    public const string ReportRead = "report.read";

    public static readonly string[] AllPermissions =
    [
        AuthProfileRead,
        DashboardRead,
        CatalogRead,
        CatalogWrite,
        CoordinationRead,
        CoordinationOrderLock,
        CoordinationOrderAdjust,
        CoordinationOrderSignoff,
        DemandGenerate,
        InventoryRead,
        PurchaseRead,
        PurchaseGenerate,
        PurchaseRequestApprove,
        PurchaseQuotationManage,
        InventoryReceiptApprove,
        InventoryIssueApprove,
        InventoryAdjustmentApprove,
        ProductionRead,
        WarehouseRead,
        ReportRead
    ];

    private static readonly string[] ManagerPermissions =
    [
        AuthProfileRead,
        DashboardRead,
        CatalogRead,
        CatalogWrite,
        CoordinationRead,
        CoordinationOrderLock,
        CoordinationOrderAdjust,
        CoordinationOrderSignoff,
        DemandGenerate,
        InventoryRead,
        PurchaseRead,
        PurchaseGenerate,
        PurchaseRequestApprove,
        PurchaseQuotationManage,
        InventoryReceiptApprove,
        InventoryIssueApprove,
        InventoryAdjustmentApprove,
        ProductionRead,
        WarehouseRead,
        ReportRead
    ];

    private static readonly string[] CoordinatorPermissions =
    [
        AuthProfileRead,
        DashboardRead,
        CoordinationRead,
        CoordinationOrderLock,
        CoordinationOrderAdjust,
        CoordinationOrderSignoff,
        DemandGenerate,
        ReportRead
    ];

    private static readonly string[] ProcurementPermissions =
    [
        AuthProfileRead,
        DashboardRead,
        InventoryRead,
        PurchaseRead,
        PurchaseGenerate,
        PurchaseRequestApprove,
        PurchaseQuotationManage,
        InventoryReceiptApprove,
        ReportRead
    ];

    private static readonly string[] WarehousePermissions =
    [
        AuthProfileRead,
        DashboardRead,
        InventoryRead,
        InventoryReceiptApprove,
        InventoryIssueApprove,
        InventoryAdjustmentApprove,
        WarehouseRead,
        ReportRead
    ];

    private static readonly string[] ProductionPermissions =
    [
        AuthProfileRead,
        DashboardRead,
        ProductionRead,
        ReportRead
    ];

    public static IReadOnlyList<string> ResolvePermissions(string? roleName)
    {
        if (string.IsNullOrWhiteSpace(roleName))
        {
            return [];
        }

        if (IsAdminRole(roleName))
        {
            return AllPermissions;
        }

        if (MatchesRole(roleName, "Manager", "MANAGER", "Quản lý"))
        {
            return ManagerPermissions;
        }

        if (MatchesRole(roleName, "Coordinator", "COORDINATOR", "Điều phối"))
        {
            return CoordinatorPermissions;
        }

        if (MatchesRole(roleName, "ProcurementStaff", "Procurement Staff", "Purchasing", "PURCHASING", "PurchaseStaff", "Purchase Staff", "Nhân viên mua hàng", "Thu mua"))
        {
            return ProcurementPermissions;
        }

        if (MatchesRole(roleName, "WarehouseManager", "Warehouse Manager", "WarehouseStaff", "Warehouse Staff", "Thủ kho"))
        {
            return WarehousePermissions;
        }

        if (MatchesRole(roleName, "Chef", "HeadChef", "Head Chef", "Kitchen", "Bếp trưởng"))
        {
            return ProductionPermissions;
        }

        return [];
    }

    public static bool IsAdminRole(string? roleName)
        => MatchesRole(roleName, "Admin", "ADMIN", "Quản trị");

    private static bool MatchesRole(string? roleName, params string[] candidates)
    {
        if (string.IsNullOrWhiteSpace(roleName))
        {
            return false;
        }

        var trimmedRoleName = roleName.Trim();
        return candidates.Any(candidate =>
            string.Equals(trimmedRoleName, candidate, StringComparison.OrdinalIgnoreCase));
    }
}
