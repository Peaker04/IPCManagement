using FluentAssertions;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Xunit;
using IPCManagement.Api.Features.Catalog.Controllers;
using IPCManagement.Api.Features.Inventory.Controllers;
using IPCManagement.Api.Features.Purchasing.Controllers;
using IPCManagement.Api.Features.Reconciliation.Controllers;

namespace IPCManagement.Api.Tests;

public class AuthorizationPoliciesTests
{
    [Fact]
    public void ResolvePermissions_Should_AllowCoordinatorToGenerateDemandOnly()
    {
        var permissions = AuthorizationPolicies.ResolvePermissions("Điều phối");

        permissions.Should().Contain(AuthorizationPolicies.DemandGenerate);
        permissions.Should().Contain(AuthorizationPolicies.CatalogRead);
        permissions.Should().NotContain(AuthorizationPolicies.PurchaseGenerate);
    }

    [Fact]
    public void ReceiptLifecycleReads_Should_IncludeCoordinatorWithoutGrantingInventoryWrites()
    {
        AuthorizationPolicies.PurchaseOrderReadRoles.Should().Contain("Coordinator");
        AuthorizationPolicies.InventoryReceiptReadRoles.Should().Contain("Coordinator");
        AuthorizationPolicies.WarehouseSelectorRoles.Should().Contain("Coordinator");
        AuthorizationPolicies.InventoryRoles.Should().NotContain("Coordinator");

        typeof(InventoryReceiptsController).GetMethod(nameof(InventoryReceiptsController.GetAllAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.InventoryReceiptReadAccess);
        typeof(InventoryReceiptsController).GetMethod(nameof(InventoryReceiptsController.CreateAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.InventoryAccess);
        typeof(WarehousesController).GetMethod(nameof(WarehousesController.GetSelectorAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.WarehouseSelectorAccess);
    }

    [Fact]
    public void ResolvePermissions_Should_AllowChefToReadCatalogWithoutCatalogWrite()
    {
        var permissions = AuthorizationPolicies.ResolvePermissions("CHEF");

        permissions.Should().Contain(AuthorizationPolicies.CatalogRead);
        permissions.Should().NotContain(AuthorizationPolicies.CatalogWrite);
    }

    [Fact]
    public void ControllerPolicies_Should_SeparateOperationalReadsFromWrites()
    {
        typeof(DishesController).GetMethod(nameof(DishesController.GetCatalogAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.CatalogReadAccess);
        typeof(DishesController).GetMethod(nameof(DishesController.CreateAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.CatalogAccess);
        typeof(PurchaseOrdersController).GetMethod(nameof(PurchaseOrdersController.GetPageAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.PurchaseOrderReadAccess);
        typeof(PurchaseOrdersController).GetMethod(nameof(PurchaseOrdersController.CreateFromRequestAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.PurchaseAccess);
        AuthorizationPolicies.PurchaseOrderReadRoles.Should().Contain("WarehouseStaff");
        AuthorizationPolicies.PurchaseRoles.Should().NotContain("WarehouseStaff");
    }

    [Fact]
    public void ResolvePermissions_Should_AllowPurchasingToGeneratePurchaseOnly()
    {
        var permissions = AuthorizationPolicies.ResolvePermissions("Thu mua");

        permissions.Should().Contain(AuthorizationPolicies.PurchaseRead);
        permissions.Should().Contain(AuthorizationPolicies.PurchaseGenerate);
        permissions.Should().NotContain(AuthorizationPolicies.DemandGenerate);
        AuthorizationPolicies.WarehouseCatalogRoles.Should().Contain("Thu mua");
        AuthorizationPolicies.WarehouseRoles.Should().NotContain("Thu mua");
    }

    [Fact]
    public void Supplemental_request_reads_include_purchasing_without_granting_warehouse_commands()
    {
        AuthorizationPolicies.SupplementalMaterialRequestReadRoles.Should().Contain("Purchasing");
        AuthorizationPolicies.InventoryRoles.Should().NotContain("Purchasing");

        var controller = typeof(SupplementalMaterialRequestsController);
        controller.GetMethod(nameof(SupplementalMaterialRequestsController.GetAllAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.SupplementalMaterialRequestReadAccess);
        controller.GetMethod(nameof(SupplementalMaterialRequestsController.CreateAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.InventoryIssueAccess);
        controller.GetMethod(nameof(SupplementalMaterialRequestsController.FulfillAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.InventoryAccess);
        controller.GetMethod(nameof(SupplementalMaterialRequestsController.RouteToPurchasingAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.InventoryAccess);
        controller.GetMethod(nameof(SupplementalMaterialRequestsController.RejectAsync))!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.InventoryAccess);
    }

    [Fact]
    public void Reconciliation_endpoint_policy_matrix_separates_read_coordinate_actual_and_decision_access()
    {
        var batches = typeof(ReconciliationBatchesController);
        Policy(batches, nameof(ReconciliationBatchesController.List)).Should().Be(AuthorizationPolicies.ReportAccess);
        Policy(batches, nameof(ReconciliationBatchesController.Get)).Should().Be(AuthorizationPolicies.ReportAccess);
        Policy(batches, nameof(ReconciliationBatchesController.DraftSources)).Should().Be(AuthorizationPolicies.CoordinationAccess);
        Policy(batches, nameof(ReconciliationBatchesController.Create)).Should().Be(AuthorizationPolicies.CoordinationAccess);
        Policy(batches, nameof(ReconciliationBatchesController.Ready)).Should().Be(AuthorizationPolicies.CoordinationAccess);
        Policy(batches, nameof(ReconciliationBatchesController.Complete)).Should().Be(AuthorizationPolicies.ReconciliationCompleteAccess);

        var actuals = typeof(ReconciliationActualsController);
        Policy(actuals, nameof(ReconciliationActualsController.Purchased)).Should().Be(AuthorizationPolicies.PurchaseAccess);
        Policy(actuals, nameof(ReconciliationActualsController.Issued)).Should().Be(AuthorizationPolicies.WarehouseAccess);
        Policy(actuals, nameof(ReconciliationActualsController.Disposition)).Should().Be(AuthorizationPolicies.ReconciliationDispositionAccess);
        AuthorizationPolicies.ReconciliationDecisionRoles.Should().Contain(["Manager", "Admin"]);
        AuthorizationPolicies.ReconciliationDecisionRoles.Should().NotContain(["Coordinator", "Purchasing", "WarehouseStaff"]);
    }

    private static string? Policy(Type controller, string action) => controller.GetMethod(action)!
        .GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()
        .Single().Policy;

    [Fact]
    public void ResolvePermissions_Should_TreatVietnameseAdminRoleAsFullAccess()
    {
        AuthorizationPolicies.IsAdminRole("Quản trị").Should().BeTrue();
        AuthorizationPolicies.ResolvePermissions("Quản trị").Should().BeEquivalentTo(AuthorizationPolicies.AllPermissions);
    }
}
