using System.ComponentModel.DataAnnotations;
using System.Reflection;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Validators;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Validators;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Tests;

public sealed class OperationalWarehouseCompatibilityTests
{
    private static readonly TrustBoundary[] Inventory =
    [
        new("backend/src/IPCManagement.Api/Features/Catalog/Contracts/IngredientDto.cs", "CreateIngredientRequest.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Catalog/Contracts/IngredientDto.cs", "UpdateIngredientRequest.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Catalog/Contracts/IngredientDto.cs", "IngredientDto.WarehouseId", Disposition.RetainedInternalIdentity, 10),
        new("backend/src/IPCManagement.Api/Features/Catalog/Validators/IngredientValidators.cs", "CreateIngredientDtoValidator.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Catalog/Validators/IngredientValidators.cs", "UpdateIngredientDtoValidator.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs", "CreateInventoryReceiptRequest.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs", "CreateInventoryReceiptFromPurchaseRequest.WarehouseId", Disposition.LineageInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs", "CreateInventoryIssueRequest.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs", "CreateInventoryReturnRequest.WarehouseId", Disposition.LineageInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs", "InventoryIssueFilterRequestDto.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs", "InventoryReturnFilterRequestDto.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs", "InventoryReceiptDto.WarehouseId", Disposition.RetainedInternalIdentity, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs", "InventoryIssueDto.WarehouseId", Disposition.RetainedInternalIdentity, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs", "InventoryReturnDto.WarehouseId", Disposition.RetainedInternalIdentity, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/StocktakeDto.cs", "CreateStocktakeRequest.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/StocktakeDto.cs", "StocktakeFilterRequestDto.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/StocktakeDto.cs", "StocktakeDto.WarehouseId", Disposition.RetainedInternalIdentity, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/SupplementalMaterialRequestDto.cs", "SupplementalMaterialRequestFilterDto.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Contracts/SupplementalMaterialRequestDto.cs", "SupplementalMaterialRequestDto.WarehouseId", Disposition.RetainedInternalIdentity, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Validators/InventoryValidators.cs", "CreateInventoryReceiptDtoValidator.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Validators/InventoryValidators.cs", "CreateInventoryReceiptFromPurchaseDtoValidator.WarehouseId", Disposition.LineageInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Validators/InventoryValidators.cs", "CreateInventoryIssueDtoValidator.WarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Inventory/Validators/InventoryValidators.cs", "CreateInventoryReturnDtoValidator.WarehouseId", Disposition.LineageInput, 10),
        new("backend/src/IPCManagement.Api/Features/Purchasing/Contracts/PurchaseSupplierDecisionDto.cs", "ConfirmPurchaseLineSupplierRequest.ReceivingWarehouseId", Disposition.CanonicalInput, 10),
        new("backend/src/IPCManagement.Api/Features/Purchasing/Contracts/PurchaseSupplierDecisionDto.cs", "PurchaseLineSupplierDecisionDto.ReceivingWarehouseId", Disposition.RetainedInternalIdentity, 10),
        new("backend/src/IPCManagement.Api/Features/Purchasing/Contracts/WarehousePurchaseReceiptDto.cs", "RecordWarehousePurchaseReceiptRequest.WarehouseId", Disposition.LineageInput, 10),
        new("backend/src/IPCManagement.Api/Shared/Contracts/WorkflowReportQueryDto.cs", "WorkflowReportQueryDto.WarehouseId", Disposition.CanonicalInput, 10),

        new("backend/src/IPCManagement.Api/Features/Catalog/Services/IngredientService.cs", "IngredientService.CreateAsync/UpdateAsync", Disposition.CanonicalInput, 11),
        new("backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReceiptService.cs", "InventoryReceiptService create paths", Disposition.CanonicalInput, 11),
        new("backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs", "InventoryIssueService create path", Disposition.CanonicalInput, 11),
        new("backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReturnService.cs", "InventoryReturnService source issue path", Disposition.LineageInput, 11),
        new("backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs", "StocktakeService.CreateAsync", Disposition.CanonicalInput, 11),
        new("backend/src/IPCManagement.Api/Features/Inventory/Services/SupplementalMaterialRequestService.cs", "SupplementalMaterialRequestService write paths", Disposition.CanonicalInput, 11),
        new("backend/src/IPCManagement.Api/Features/Inventory/Services/SupplementalMaterialRequestQueryPolicy.cs", "SupplementalMaterialRequestQueryPolicy warehouse scope", Disposition.CanonicalInput, 11),
        new("backend/src/IPCManagement.Api/Data/Repositories/InventoryIssueRepository.cs", "InventoryIssueRepository warehouse filter", Disposition.RetainedInternalIdentity, 11),
        new("backend/src/IPCManagement.Api/Data/Repositories/InventoryReturnRepository.cs", "InventoryReturnRepository warehouse filter", Disposition.RetainedInternalIdentity, 11),
        new("backend/src/IPCManagement.Api/Data/Repositories/StocktakeRepository.cs", "StocktakeRepository warehouse filter", Disposition.RetainedInternalIdentity, 11),

        new("backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseSupplierDecisionService.cs", "PurchaseSupplierDecisionService receiving identity/fingerprint", Disposition.CanonicalInput, 12),
        new("backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseReceivingService.cs", "PurchaseReceivingService order warehouse path", Disposition.LineageInput, 12),
        new("backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseReceivingQueries.cs", "PurchaseReceivingQueries warehouse validation", Disposition.LineageInput, 12),
        new("backend/src/IPCManagement.Api/Features/Catalog/Services/DishBomImportService.cs", "DishBomImportService warehouse resolution", Disposition.CanonicalInput, 12),
        new("backend/src/IPCManagement.Api/Features/SampleData/Services/SampleBomImportService.cs", "SampleBomImportService warehouse resolution", Disposition.CanonicalInput, 12),
        new("backend/src/IPCManagement.Api/Features/Inventory/Controllers/WarehousesController.cs", "WarehousesController operational selector", Disposition.CanonicalInput, 12),
        new("backend/src/IPCManagement.Api/Features/Inventory/Controllers/WarehousesController.cs", "WarehousesController catalog/detail", Disposition.HistoricalDetail, 12),
        new("backend/src/IPCManagement.Api/Features/Inventory/Services/WarehouseService.cs", "WarehouseService operational selector", Disposition.CanonicalInput, 12),
        new("backend/src/IPCManagement.Api/Features/Inventory/Services/WarehouseService.cs", "WarehouseService catalog/detail", Disposition.HistoricalDetail, 12),
        new("backend/src/IPCManagement.Api/Security/CurrentUserService.cs", "CurrentUserService.GetWarehouseId", Disposition.CanonicalInput, 12),

        new("frontend/src/shared/api/contracts/openapi.json", "generated warehouse request/response contracts", Disposition.RetainedInternalIdentity, 13),
        new("frontend/src/shared/api/contracts/schema.ts", "generated warehouse request/response types", Disposition.RetainedInternalIdentity, 13),
        new("docs/API-CONTRACTS.md", "single-warehouse compatibility contract", Disposition.HistoricalDetail, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/Warehouse.cs", "Warehouse.WarehouseId/IsOperationalActive", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/Ingredient.cs", "Ingredient.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/InventoryReceipt.cs", "InventoryReceipt.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/InventoryIssue.cs", "InventoryIssue.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/InventoryReturn.cs", "InventoryReturn.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/SupplementalMaterialRequest.cs", "SupplementalMaterialRequest.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/StockMovement.cs", "StockMovement.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/CurrentStock.cs", "CurrentStock.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/CurrentStockLot.cs", "CurrentStockLot.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/StockSnapshot.cs", "StockSnapshot.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/Stocktake.cs", "Stocktake.WarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/PurchaseLineSupplierDecision.cs", "PurchaseLineSupplierDecision.ReceivingWarehouseId", Disposition.RetainedInternalIdentity, 13),
        new("backend/src/IPCManagement.Api/Models/Entities/PurchaseOrder.cs", "PurchaseOrder.ReceivingWarehouseId", Disposition.RetainedInternalIdentity, 13),
    ];

    [Fact]
    public void TrustSurfaceInventory_AssignsEveryBoundaryExactlyOnce()
    {
        var errors = Validate(Inventory);

        Assert.True(errors.Count == 0, string.Join(Environment.NewLine, errors));
    }

    [Fact]
    public void TrustSurfaceInventory_RejectsMissingDuplicateExtraAndUndispositionedRows()
    {
        var baseline = Inventory.Where(row => row.Disposition != Disposition.Unresolved).ToArray();
        var missing = baseline.Skip(1).ToArray();
        var duplicate = baseline.Append(baseline[0]).ToArray();
        var extra = baseline.Append(new("extra.cs", "Extra.Symbol", Disposition.CanonicalInput, 10)).ToArray();
        var unresolved = baseline.Append(new("unresolved.cs", "Unresolved.Symbol", Disposition.Unresolved, 10)).ToArray();
        var invalidOwner = baseline.Append(new("owner.cs", "Invalid.Owner", Disposition.CanonicalInput, 14)).ToArray();

        Assert.Contains(Validate(missing), error => error.StartsWith("missing inventory row", StringComparison.Ordinal));
        Assert.Contains(Validate(duplicate), error => error.StartsWith("duplicate inventory row", StringComparison.Ordinal));
        Assert.Contains(Validate(extra), error => error.StartsWith("extra inventory row", StringComparison.Ordinal));
        Assert.Contains(Validate(unresolved), error => error.StartsWith("undispositioned inventory row", StringComparison.Ordinal));
        Assert.Contains(Validate(invalidOwner), error => error.StartsWith("invalid owner plan", StringComparison.Ordinal));
    }

    [Fact]
    public void TrustSurfaceInventory_PrintsOwnerAndDispositionTotals()
    {
        var ownerTotals = Inventory.GroupBy(row => row.OwnerPlan).ToDictionary(group => group.Key, group => group.Count());
        var dispositionTotals = Inventory.GroupBy(row => row.Disposition).ToDictionary(group => group.Key, group => group.Count());

        Assert.Equal(4, ownerTotals.Count);
        Assert.Equal(Inventory.Length, ownerTotals.Values.Sum());
        Assert.Equal(Inventory.Length, dispositionTotals.Values.Sum());
        Assert.True(ownerTotals.All(pair => pair.Key is >= 10 and <= 13 && pair.Value > 0));
        Assert.True(dispositionTotals.Where(pair => pair.Key != Disposition.Unresolved).All(pair => pair.Value > 0));
    }

    [Fact]
    public void DtoValidatorFilter_OrdinaryCompatibilityInputsAreOptional()
    {
        AssertOptionalWarehouseProperty<CreateIngredientRequest>(nameof(CreateIngredientRequest.WarehouseId));
        AssertOptionalWarehouseProperty<UpdateIngredientRequest>(nameof(UpdateIngredientRequest.WarehouseId));
        AssertOptionalWarehouseProperty<CreateInventoryReceiptRequest>(nameof(CreateInventoryReceiptRequest.WarehouseId));
        AssertOptionalWarehouseProperty<CreateInventoryReceiptFromPurchaseRequest>(nameof(CreateInventoryReceiptFromPurchaseRequest.WarehouseId));
        AssertOptionalWarehouseProperty<CreateInventoryIssueRequest>(nameof(CreateInventoryIssueRequest.WarehouseId));
        AssertOptionalWarehouseProperty<CreateInventoryReturnRequest>(nameof(CreateInventoryReturnRequest.WarehouseId));
        AssertOptionalWarehouseProperty<CreateStocktakeRequest>(nameof(CreateStocktakeRequest.WarehouseId));
        AssertOptionalWarehouseProperty<ConfirmPurchaseLineSupplierRequest>(nameof(ConfirmPurchaseLineSupplierRequest.ReceivingWarehouseId));
        AssertOptionalWarehouseProperty<RecordWarehousePurchaseReceiptRequest>(nameof(RecordWarehousePurchaseReceiptRequest.WarehouseId));

        Assert.Null(new InventoryIssueFilterRequestDto().WarehouseId);
        Assert.Null(new InventoryReturnFilterRequestDto().WarehouseId);
        Assert.Null(new StocktakeFilterRequestDto().WarehouseId);
        Assert.Null(new SupplementalMaterialRequestFilterDto().WarehouseId);
        Assert.Null(new WorkflowReportQueryDto().WarehouseId);
    }

    [Fact]
    public void DtoValidatorFilter_OmittedCompatibilityInputsPassFormatValidation()
    {
        Assert.DoesNotContain(new CreateIngredientDtoValidator().Validate(new CreateIngredientRequest()).Errors,
            error => error.PropertyName == nameof(CreateIngredientRequest.WarehouseId));
        Assert.DoesNotContain(new UpdateIngredientDtoValidator().Validate(new UpdateIngredientRequest()).Errors,
            error => error.PropertyName == nameof(UpdateIngredientRequest.WarehouseId));
        Assert.DoesNotContain(new CreateInventoryReceiptDtoValidator().Validate(new CreateInventoryReceiptRequest()).Errors,
            error => error.PropertyName == nameof(CreateInventoryReceiptRequest.WarehouseId));
        Assert.DoesNotContain(new CreateInventoryReceiptFromPurchaseDtoValidator().Validate(new CreateInventoryReceiptFromPurchaseRequest()).Errors,
            error => error.PropertyName == nameof(CreateInventoryReceiptFromPurchaseRequest.WarehouseId));
        Assert.DoesNotContain(new CreateInventoryIssueDtoValidator().Validate(new CreateInventoryIssueRequest()).Errors,
            error => error.PropertyName == nameof(CreateInventoryIssueRequest.WarehouseId));
        Assert.DoesNotContain(new CreateInventoryReturnDtoValidator().Validate(new CreateInventoryReturnRequest()).Errors,
            error => error.PropertyName == nameof(CreateInventoryReturnRequest.WarehouseId));
    }

    [Fact]
    public void DtoValidatorFilter_SuppliedCompatibilityInputsMustBeGuidShaped()
    {
        AssertWarehouseFormatRejected(new CreateIngredientDtoValidator(), new CreateIngredientRequest { WarehouseId = "arbitrary" }, nameof(CreateIngredientRequest.WarehouseId));
        AssertWarehouseFormatRejected(new UpdateIngredientDtoValidator(), new UpdateIngredientRequest { WarehouseId = "arbitrary" }, nameof(UpdateIngredientRequest.WarehouseId));
        AssertWarehouseFormatRejected(new CreateInventoryReceiptDtoValidator(), new CreateInventoryReceiptRequest { WarehouseId = "arbitrary" }, nameof(CreateInventoryReceiptRequest.WarehouseId));
        AssertWarehouseFormatRejected(new CreateInventoryReceiptFromPurchaseDtoValidator(), new CreateInventoryReceiptFromPurchaseRequest { WarehouseId = "arbitrary" }, nameof(CreateInventoryReceiptFromPurchaseRequest.WarehouseId));
        AssertWarehouseFormatRejected(new CreateInventoryIssueDtoValidator(), new CreateInventoryIssueRequest { WarehouseId = "arbitrary" }, nameof(CreateInventoryIssueRequest.WarehouseId));
        AssertWarehouseFormatRejected(new CreateInventoryReturnDtoValidator(), new CreateInventoryReturnRequest { WarehouseId = "arbitrary" }, nameof(CreateInventoryReturnRequest.WarehouseId));
    }

    [Fact]
    public void DtoValidatorFilter_ResponseAndInternalIdentitiesRemainRequiredStrings()
    {
        Assert.Equal(typeof(string), typeof(IngredientDto).GetProperty(nameof(IngredientDto.WarehouseId))!.PropertyType);
        Assert.Equal(typeof(string), typeof(InventoryReceiptDto).GetProperty(nameof(InventoryReceiptDto.WarehouseId))!.PropertyType);
        Assert.Equal(typeof(string), typeof(InventoryIssueDto).GetProperty(nameof(InventoryIssueDto.WarehouseId))!.PropertyType);
        Assert.Equal(typeof(string), typeof(InventoryReturnDto).GetProperty(nameof(InventoryReturnDto.WarehouseId))!.PropertyType);
        Assert.Equal(typeof(string), typeof(StocktakeDto).GetProperty(nameof(StocktakeDto.WarehouseId))!.PropertyType);
        Assert.Equal(typeof(string), typeof(SupplementalMaterialRequestDto).GetProperty(nameof(SupplementalMaterialRequestDto.WarehouseId))!.PropertyType);
        Assert.Equal(typeof(string), typeof(PurchaseLineSupplierDecisionDto).GetProperty(nameof(PurchaseLineSupplierDecisionDto.ReceivingWarehouseId))!.PropertyType);
    }

    private static void AssertOptionalWarehouseProperty<T>(string propertyName)
    {
        var property = typeof(T).GetProperty(propertyName)!;
        var nullability = new NullabilityInfoContext().Create(property);

        Assert.Equal(typeof(string), property.PropertyType);
        Assert.Equal(NullabilityState.Nullable, nullability.WriteState);
        Assert.Empty(property.GetCustomAttributes(typeof(RequiredAttribute), inherit: true));
        Assert.Null(property.GetValue(Activator.CreateInstance<T>()));
    }

    private static void AssertWarehouseFormatRejected<T>(FluentValidation.IValidator<T> validator, T request, string propertyName)
    {
        Assert.Contains(validator.Validate(request).Errors, error => error.PropertyName == propertyName);
    }

    private static IReadOnlyList<string> Validate(IReadOnlyCollection<TrustBoundary> rows)
    {
        var errors = new List<string>();
        var expectedKeys = Inventory.Select(row => row.Key).ToHashSet(StringComparer.Ordinal);
        var actualKeys = rows.Select(row => row.Key).ToArray();

        errors.AddRange(expectedKeys.Except(actualKeys, StringComparer.Ordinal).Select(key => $"missing inventory row: {key}"));
        errors.AddRange(actualKeys.Except(expectedKeys, StringComparer.Ordinal).Select(key => $"extra inventory row: {key}"));
        errors.AddRange(actualKeys.GroupBy(key => key, StringComparer.Ordinal).Where(group => group.Count() != 1).Select(group => $"duplicate inventory row: {group.Key}"));
        errors.AddRange(rows.Where(row => row.Disposition == Disposition.Unresolved).Select(row => $"undispositioned inventory row: {row.Key}"));
        errors.AddRange(rows.Where(row => row.OwnerPlan is < 10 or > 13).Select(row => $"invalid owner plan: {row.Key}"));
        return errors;
    }

    public sealed record TrustBoundary(string File, string Symbol, Disposition Disposition, int OwnerPlan)
    {
        public string Key => $"{File}::{Symbol}";
    }

    public enum Disposition
    {
        Unresolved,
        CanonicalInput,
        LineageInput,
        HistoricalDetail,
        RetainedInternalIdentity,
    }
}
