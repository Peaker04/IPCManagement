using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationSupplementalDemandControllerTests
{
    [Fact]
    public void Supplemental_endpoints_keep_mrx_read_proposal_and_manager_decision_policies_separate()
    {
        var controller = typeof(ReconciliationSupplementalDemandsController);
        var mode = Assert.Single(controller.GetCustomAttributes(typeof(SystemOperationAttribute), true).Cast<SystemOperationAttribute>());
        Assert.Equal(OperationDisposition.ReconciliationOnly, mode.Disposition);
        Assert.Equal(AuthorizationPolicies.ReconciliationSupplementalDemandReadAccess,
            Assert.Single(controller.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()).Policy);
        foreach (var name in new[] { "Create", "Update", "Submit", "Cancel" })
            Assert.Equal(AuthorizationPolicies.ReconciliationSupplementalDemandWriteAccess,
                Assert.Single(controller.GetMethod(name)!.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()).Policy);
        foreach (var name in new[] { "Approve", "Reject" })
            Assert.Equal(AuthorizationPolicies.ReconciliationSupplementalDemandApproveAccess,
                Assert.Single(controller.GetMethod(name)!.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()).Policy);
        Assert.Contains("WarehouseStaff", AuthorizationPolicies.ReconciliationSupplementalDemandWriteRoles);
        Assert.DoesNotContain("WarehouseStaff", AuthorizationPolicies.ReconciliationDecisionRoles);
        Assert.Contains("Manager", AuthorizationPolicies.ReconciliationSupplementalDemandWriteRoles);
        Assert.Contains("Quản trị", AuthorizationPolicies.ReconciliationSupplementalDemandReadRoles);
    }
}
