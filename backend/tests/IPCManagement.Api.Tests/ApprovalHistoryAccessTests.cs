using System.Security.Claims;
using IPCManagement.Api.Features.Approvals.Controllers;
using IPCManagement.Api.Features.Approvals.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class ApprovalHistoryAccessTests
{
    [Theory]
    [InlineData("Chef", "material-demand")]
    [InlineData("WarehouseStaff", "inventory-issue")]
    [InlineData("Manager", "unregistered")]
    public async Task Legacy_history_does_not_reveal_target_events_to_unauthorized_actor(string role, string type)
    {
        var query = Substitute.For<IApprovalHistoryQueryService>();
        var controller = new ApprovalHistoryController(query) { ControllerContext = new ControllerContext {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([
                new Claim(ClaimTypes.Role, role)], "test")) } } };
        var response = await controller.GetHistoryAsync(type, Guid.NewGuid().ToString());
        Assert.Equal(403, Assert.IsType<ObjectResult>(response).StatusCode);
        Assert.Empty(query.ReceivedCalls());
    }
}
