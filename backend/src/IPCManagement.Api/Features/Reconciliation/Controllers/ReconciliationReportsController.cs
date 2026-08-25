using System.Globalization;
using System.Text;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/reports"), Authorize(Policy = AuthorizationPolicies.ReportAccess)]
public sealed class ReconciliationReportsController(ReconciliationBatchService service) : ControllerBase
{
    [HttpGet("{id}"), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Get(string id, CancellationToken token) { var batch = await service.GetAsync(id, token); return batch is null ? NotFound(ApiResponse.FailResult("Không tìm thấy báo cáo đối chiếu.")) : Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(batch)); }

    [HttpGet("{id}/export")]
    [Produces("text/csv")]
    public async Task<IActionResult> Export(string id, CancellationToken token)
    {
        var batch = await service.GetAsync(id, token);
        if (batch is null) return NotFound(ApiResponse.FailResult("Không tìm thấy báo cáo đối chiếu."));
        var csv = new StringBuilder("batchLineId,ingredientId,canonicalUnitId,requiredQuantity,purchasedQuantity,issuedQuantity,purchasedRequiredDifference,issuedRequiredDifference,purchasedIssuedDifference,status,dispositionCategory,dispositionReason\r\n");
        foreach (var line in batch.Lines)
        {
            csv.AppendJoin(',', Csv(line.BatchLineId), Csv(line.IngredientId), Csv(line.CanonicalUnitId), Number(line.RequiredQuantity), Number(line.PurchasedQuantity), Number(line.IssuedQuantity), Number(line.PurchasedRequiredDifference), Number(line.IssuedRequiredDifference), Number(line.PurchasedIssuedDifference), Csv(line.Status), Csv(line.Disposition?.Category), Csv(line.Disposition?.Reason)).Append("\r\n");
        }
        return File(new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetBytes(csv.ToString()), "text/csv; charset=utf-8", $"reconciliation-{batch.BatchId}.csv");
    }

    private static string Number(decimal? value) => value?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;
    private static string Csv(string? value) => $"\"{(value ?? string.Empty).Replace("\"", "\"\"")}\"";
}
