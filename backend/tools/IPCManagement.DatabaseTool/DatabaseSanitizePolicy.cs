namespace IPCManagement.DatabaseTool;

public static class DatabaseSanitizePolicy
{
    public static IReadOnlyList<string> TransactionTables { get; } =
    [
        "approvalassignments", "approvalhistories", "auditlogs", "inventoryreturnlines", "inventoryreturns",
        "supplementalmaterialrequests", "inventoryissuelines", "inventoryissues", "inventoryreceiptlines",
        "inventoryreceipts", "purchaseorderlines", "purchaseorders", "purchaselinesupplierdecisions",
        "purchaserequestlines", "purchaserequests", "materialrequestlines", "materialrequests",
        "productionplanlines", "productionplans", "quantityadjustments", "mealquantityplanlines",
        "mealquantityplans", "quantityimportbatches", "menuschedules", "menuversions", "stockmovements",
        "stocksnapshots", "stocktakelines", "stocktakes", "supplierquotations", "refreshtokens"
    ];
}
