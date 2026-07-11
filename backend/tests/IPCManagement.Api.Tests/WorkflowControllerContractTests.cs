using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.ProductionPlan;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.Workflow;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class WorkflowControllerContractTests
{
    private readonly IMaterialDemandService _materialDemandService = Substitute.For<IMaterialDemandService>();
    private readonly IProductionPlanService _productionPlanService = Substitute.For<IProductionPlanService>();
    private readonly ICurrentUserService _currentUserService = Substitute.For<ICurrentUserService>();

    [Fact]
    public async Task MaterialDemandGenerate_Should_ReturnConflict_WhenDomainBlocksRequest()
    {
        var controller = CreateMaterialDemandController();
        _currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns("user-id");
        _materialDemandService.GenerateAsync(
                Arg.Any<GenerateMaterialDemandRequestDto>(),
                "user-id",
                Arg.Any<CancellationToken>())
            .Returns(Task.FromException<MaterialDemandResultDto?>(
                new InvalidOperationException("Giá ngoài tier cố định.")));

        var result = await controller.Generate(new GenerateMaterialDemandRequestDto
        {
            ServiceDate = "2026-07-10",
            Scope = "FULLDAY"
        }, CancellationToken.None);

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        var response = conflict.Value.Should().BeAssignableTo<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Be("Giá ngoài tier cố định.");
    }

    [Fact]
    public async Task MaterialDemandGenerate_Should_ReturnNotFound_WhenNoCompletedQuantityPlan()
    {
        var controller = CreateMaterialDemandController();
        _currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns("user-id");
        _materialDemandService.GenerateAsync(
                Arg.Any<GenerateMaterialDemandRequestDto>(),
                "user-id",
                Arg.Any<CancellationToken>())
            .Returns((MaterialDemandResultDto?)null);

        var result = await controller.Generate(new GenerateMaterialDemandRequestDto
        {
            ServiceDate = "2026-07-10",
            Scope = "FULLDAY"
        }, CancellationToken.None);

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        var response = notFound.Value.Should().BeAssignableTo<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Contain("Không tìm thấy số suất");
    }

    [Fact]
    public async Task MaterialDemandApprove_Should_ReturnBadRequest_ForInvalidId()
    {
        var controller = CreateMaterialDemandController();
        _currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns("user-id");
        _materialDemandService.ApproveAsync(
                "bad-id",
                "user-id",
                "approve",
                Arg.Any<CancellationToken>())
            .Returns(Task.FromException<MaterialDemandApprovalDto?>(
                new ArgumentException("MaterialRequestId không hợp lệ.")));

        var result = await controller.Approve(
            "bad-id",
            new MaterialDemandApproveRequestDto { Reason = "approve" },
            CancellationToken.None);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var response = badRequest.Value.Should().BeAssignableTo<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Be("MaterialRequestId không hợp lệ.");
    }

    [Fact]
    public async Task MaterialDemandApprove_Should_ReturnNotFound_WhenDemandDoesNotExist()
    {
        var controller = CreateMaterialDemandController();
        _currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns("user-id");
        _materialDemandService.ApproveAsync(
                "missing-id",
                "user-id",
                null,
                Arg.Any<CancellationToken>())
            .Returns((MaterialDemandApprovalDto?)null);

        var result = await controller.Approve("missing-id", null, CancellationToken.None);

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        var response = notFound.Value.Should().BeAssignableTo<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Contain("Không tìm thấy nhu cầu");
    }

    [Fact]
    public async Task ProductionPlansGetById_Should_ReturnNotFoundEnvelope_WhenPlanMissing()
    {
        var controller = CreateProductionPlansController();
        _productionPlanService.GetByIdAsync("missing-plan").Returns((ProductionPlanDto?)null);

        var result = await controller.GetById("missing-plan");

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        var response = notFound.Value.Should().BeAssignableTo<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Contain("missing-plan");
    }

    [Fact]
    public async Task ProductionPlansGetAll_Should_ReturnPagedApiResponse()
    {
        var controller = CreateProductionPlansController();
        var page = PagedResponseDto<ProductionPlanDto>.Create(
            [new ProductionPlanDto { PlanId = "plan-id", PlanCode = "KHSX-001" }],
            1,
            1,
            20);
        _productionPlanService.GetPagedAsync(Arg.Is<PagedRequestDto>(request =>
                request.PageNumber == 1 && request.PageSize == 20))
            .Returns(page);

        var result = await controller.GetAll(new PagedRequestDto { PageNumber = 1, PageSize = 20 });

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<ApiResponse<PagedResponseDto<ProductionPlanDto>>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.Items.Should().ContainSingle(item => item.PlanCode == "KHSX-001");
    }

    [Fact]
    public async Task ProductionPlansSendDailyToKitchen_Should_UseCurrentUser_AndReturnSuccessMessage()
    {
        var controller = CreateProductionPlansController();
        var request = new SendDailyProductionPlanRequestDto
        {
            ServiceDate = "2026-07-10",
            CustomerId = "customer-id",
            ShiftName = "MORNING",
            Reason = "Gửi bếp"
        };
        var daily = new DailyProductionPlanDto
        {
            ServiceDate = new DateOnly(2026, 7, 10),
            TotalPlans = 1,
            SentPlans = 1
        };
        _currentUserService.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>())
            .Returns("sender-id");
        _productionPlanService.SendDailyToKitchenAsync(request, "sender-id", Arg.Any<CancellationToken>())
            .Returns(daily);

        var result = await controller.SendDailyToKitchen(request, CancellationToken.None);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<ApiResponse<DailyProductionPlanDto>>().Subject;
        response.Success.Should().BeTrue();
        response.Message.Should().Be("Đã gửi kế hoạch sản xuất cho bếp.");
        response.Data!.SentPlans.Should().Be(1);
    }

    private MaterialDemandController CreateMaterialDemandController()
        => new(_materialDemandService, _currentUserService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

    private ProductionPlansController CreateProductionPlansController()
        => new(_productionPlanService, _currentUserService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
}
