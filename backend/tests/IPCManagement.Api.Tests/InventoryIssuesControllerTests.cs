using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class InventoryIssuesControllerTests
{
    private readonly IInventoryIssueService _inventoryIssueService = Substitute.For<IInventoryIssueService>();
    private readonly ICurrentUserService _currentUserService = Substitute.For<ICurrentUserService>();

    [Fact]
    public async Task GetAll_Should_ReturnForbidden_WhenKitchenRoleHasNoWarehouseClaim()
    {
        _currentUserService.GetRoleNames(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns(["Chef"]);

        var controller = CreateController();

        var result = await controller.GetAll(new InventoryIssueFilterRequestDto());

        var forbidden = result.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task GetAll_Should_ApplyWarehouseClaim_ForKitchenRole()
    {
        var warehouseId = Guid.NewGuid().ToString();
        _currentUserService.GetRoleNames(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns(["Chef"]);
        _currentUserService.GetWarehouseId(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns(warehouseId);
        _inventoryIssueService.GetPagedAsync(Arg.Is<InventoryIssueFilterRequestDto>(request =>
                request.WarehouseId == warehouseId))
            .Returns(PagedResponseDto<InventoryIssueDto>.Create([], 0, 1, 20));

        var controller = CreateController();

        var result = await controller.GetAll(new InventoryIssueFilterRequestDto());

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task GetById_Should_ReturnForbidden_WhenKitchenWarehouseDoesNotMatchIssue()
    {
        var ownWarehouseId = Guid.NewGuid().ToString();
        var otherWarehouseId = Guid.NewGuid().ToString();
        _currentUserService.GetRoleNames(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns(["Chef"]);
        _currentUserService.GetWarehouseId(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns(ownWarehouseId);
        _inventoryIssueService.GetByIdAsync("issue-id")
            .Returns(new InventoryIssueDto
            {
                IssueId = "issue-id",
                WarehouseId = otherWarehouseId
            });

        var controller = CreateController();

        var result = await controller.GetById("issue-id");

        var forbidden = result.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    private InventoryIssuesController CreateController()
        => new(_inventoryIssueService, _currentUserService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
}
