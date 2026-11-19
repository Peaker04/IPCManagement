using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;

namespace IPCManagement.Api.Tests;

public sealed class PreparationWorkbookSchemaTests
{
    [Fact]
    public void Supplier_demand_is_one_sheet_and_keeps_unresolved_quantities()
    {
        var document = new ReconciliationPreparationWorkbookDto(["C · Khách hàng"],
            [new("NCC A", "ingredient-a", "ING-A", "Cà rốt", "kg", "kg", new Dictionary<string, decimal> { ["c"] = 1.25m }, 1.25m) { SupplierId = "a", SupplierCode = "NCC-A" },
             new("Nhiều nhà cung cấp cùng hiệu lực", "ingredient-b", "ING-B", "Cà rốt", "kg", "kg", new Dictionary<string, decimal> { ["c"] = 2.5m }, 2.5m)],
            [], 3.75m, 3.75m) { CustomerColumnDefinitions = [new("c", "C", "Khách hàng")] };
        var bytes = PreparationWorkbookBuilder.BuildXlsx(document, supplierDemand: true);
        Validate(bytes);
        using var package = SpreadsheetDocument.Open(new MemoryStream(bytes), false);
        var workbook = Assert.IsType<WorkbookPart>(package.WorkbookPart);
        Assert.Contains("Nhu cầu theo NCC", workbook.Workbook!.OuterXml);
        var sheet = Assert.Single(workbook.WorksheetParts).Worksheet!.OuterXml;
        Assert.Contains("NCC A (NCC-A)", sheet);
        Assert.Contains("CẦN XÁC MINH NCC", sheet);
        Assert.Contains("Nhiều nhà cung cấp cùng hiệu lực", sheet);
        Assert.Contains("Cà rốt (ING-A)", sheet);
        Assert.Contains("Cà rốt (ING-B)", sheet);
        Assert.Contains(">1.25</", sheet);
        Assert.Contains(">2.5</", sheet);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Full_and_legacy_packages_pass_independent_openxml_schema(bool full)
    {
        var document = new ReconciliationPreparationWorkbookDto(["C · Khách hàng"],
            [new("NCC", "ingredient", "ING-1", "Cà rốt & rau", "kg", "Kilogram", new Dictionary<string, decimal> { ["c"] = 1.123456m }, 1.123456m)], [], 1.123456m, 1.123456m)
        {
            CustomerColumnDefinitions = [new("c", "C", "Khách hàng")],
            ScopeStartDate = new DateOnly(2026, 11, 16), ScopeEndDate = new DateOnly(2026, 11, 21),
            MenuRows = full ? [new("c", "Khách hàng", "batch", new DateOnly(2026, 11, 16), "Sáng", "Mặn", "D-1", "Món & rau", 10)] : []
        };
        Validate(PreparationWorkbookBuilder.BuildXlsx(document, full));
    }

    internal static void Validate(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var package = SpreadsheetDocument.Open(stream, false);
        var errors = new OpenXmlValidator().Validate(package).Select(error => $"{error.Part?.Uri} {error.Path?.XPath}: {error.Description}").ToArray();
        Assert.True(errors.Length == 0, string.Join(Environment.NewLine, errors));
    }

    [Fact]
    [Trait("Category", "EvidenceOwned")]
    public void Captured_api_artifact_passes_schema_when_explicitly_supplied()
    {
        var path = Environment.GetEnvironmentVariable("IPC_WORKBOOK_VALIDATION_FILE");
        Assert.False(string.IsNullOrWhiteSpace(path), "Evidence lane requires the actual downloaded workbook path.");
        Validate(File.ReadAllBytes(path));
    }
}
