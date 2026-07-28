using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IDemandReportService
{
    Task<IReadOnlyList<IngredientDemandReportDto>> GetIngredientDemandAsync(WorkflowReportQueryDto query);
    Task<IngredientDemandPageDto> GetIngredientDemandPageAsync(IngredientDemandPageQueryDto query);
    Task<IngredientDemandAggregatePageDto> GetIngredientDemandAggregatePageAsync(IngredientDemandAggregatePageQueryDto query);
    Task<MaterialRequestCandidatePageDto> GetMaterialRequestCandidatePageAsync(MaterialRequestCandidatePageQueryDto query);
}
