using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Reports.Controllers;

[ApiController]
[Route("api/workflow-reports")]
[Tags("WorkflowReports")]
[Authorize]
[EnableRateLimiting("api-general")]
public class DemandReportsController : ControllerBase
{
    private readonly IDemandReportService _reportService;

    public DemandReportsController(IDemandReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("ingredient-demand")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<IngredientDemandReportDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetIngredientDemandAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<IngredientDemandReportDto>>.SuccessResult(
            await _reportService.GetIngredientDemandAsync(query)));

    [HttpGet("ingredient-demand/page")]
    [ProducesResponseType(typeof(ApiResponse<IngredientDemandPageDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetIngredientDemandPageAsync([FromQuery] IngredientDemandPageQueryDto query)
        => Ok(ApiResponse<IngredientDemandPageDto>.SuccessResult(
            await _reportService.GetIngredientDemandPageAsync(query)));

    [HttpGet("ingredient-demand/aggregate/page")]
    [ProducesResponseType(typeof(ApiResponse<IngredientDemandAggregatePageDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetIngredientDemandAggregatePageAsync([FromQuery] IngredientDemandAggregatePageQueryDto query)
        => Ok(ApiResponse<IngredientDemandAggregatePageDto>.SuccessResult(
            await _reportService.GetIngredientDemandAggregatePageAsync(query)));

    [HttpGet("material-request-candidates/page")]
    [ProducesResponseType(typeof(ApiResponse<MaterialRequestCandidatePageDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMaterialRequestCandidatePageAsync([FromQuery] MaterialRequestCandidatePageQueryDto query)
    {
        try
        {
            return Ok(ApiResponse<MaterialRequestCandidatePageDto>.SuccessResult(
                await _reportService.GetMaterialRequestCandidatePageAsync(query)));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
