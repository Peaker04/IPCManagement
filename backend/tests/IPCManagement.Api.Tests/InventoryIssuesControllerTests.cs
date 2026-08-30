using FluentAssertions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Controllers;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Shared.Contracts;

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

        var result = await controller.GetAllAsync(new InventoryIssueFilterRequestDto());

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

        var result = await controller.GetAllAsync(new InventoryIssueFilterRequestDto());

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

        var result = await controller.GetByIdAsync("issue-id");

        var forbidden = result.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task GetById_Should_ReturnBadRequest_WhenSourceFamilyIsUnknown()
    {
        _inventoryIssueService.GetByIdAsync("issue-id", "UNKNOWN")
            .Returns<Task<InventoryIssueDto?>>(_ => throw new ArgumentException("Unknown inventory issue source family 'UNKNOWN'."));

        var result = await CreateController().GetByIdAsync("issue-id", "UNKNOWN");

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var response = badRequest.Value.Should().BeOfType<ApiResponse>().Subject;
        response.Message.Should().Be("Unknown inventory issue source family 'UNKNOWN'.");
    }

    [Fact]
    public async Task Create_Should_TargetMvcActionNameWithoutAsyncSuffix()
    {
        var userId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        _currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns(userId);
        _inventoryIssueService.CreateAsync(Arg.Any<CreateInventoryIssueRequest>(), userId)
            .Returns(new InventoryIssueCreatedDto { IssueId = issueId, IssueCode = "ISSUE-E2E" });

        var result = await CreateController().CreateAsync(new CreateInventoryIssueRequest());

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.ActionName.Should().Be("GetById");
        created.RouteValues.Should().ContainKey("id").WhoseValue.Should().Be(issueId);
        created.Value.Should().BeOfType<ApiResponse<InventoryIssueCreatedDto>>();
    }

    [Fact]
    public async Task Create_Should_ReturnConflict_WhenDemandVersionIsStale()
    {
        var userId = Guid.NewGuid().ToString();
        _currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>()).Returns(userId);
        _inventoryIssueService.CreateAsync(Arg.Any<CreateInventoryIssueRequest>(), userId)
            .Returns<Task<InventoryIssueCreatedDto?>>(_ => throw new Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException("Nhu cầu xuất kho đã thay đổi; hãy tải lại trước khi xác nhận."));

        var result = await CreateController().CreateAsync(new CreateInventoryIssueRequest());

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.StatusCode.Should().Be(StatusCodes.Status409Conflict);
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
