namespace IPCManagement.Api.Security;

public static class AuthorizationPolicies
{
    public const string CatalogAccess = "CatalogAccess";
    public const string CoordinationAccess = "CoordinationAccess";
    public const string InventoryAccess = "InventoryAccess";
    public const string ProductionAccess = "ProductionAccess";
    public const string PurchaseAccess = "PurchaseAccess";
    public const string WarehouseAccess = "WarehouseAccess";

    public static readonly string[] CatalogRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý"
    ];

    public static readonly string[] CoordinationRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý",
        "Coordinator", "COORDINATOR"
    ];

    public static readonly string[] InventoryRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý",
        "WarehouseManager", "Warehouse Manager", "WarehouseStaff", "Warehouse Staff", "Thủ kho"
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
        "Purchasing", "PURCHASING", "PurchaseStaff", "Purchase Staff", "Nhân viên mua hàng"
    ];

    public static readonly string[] WarehouseRoles =
    [
        "Admin", "ADMIN",
        "Manager", "MANAGER", "Quản lý",
        "WarehouseManager", "Warehouse Manager", "WarehouseStaff", "Warehouse Staff", "Thủ kho"
    ];
}
