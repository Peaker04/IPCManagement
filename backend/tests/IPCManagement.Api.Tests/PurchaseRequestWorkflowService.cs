using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Tests;

// Compatibility harness for characterization tests; production has no workflow facade.
internal sealed class PurchaseRequestWorkflowService
{
    private readonly PurchaseWorkbenchService _workbench;
    private readonly PurchaseRequestGenerationService _generation;
    private readonly PurchaseSupplierDecisionService _supplierDecision;
    private readonly PurchaseRequestSubmissionService _submission;

    public PurchaseRequestWorkflowService(
        IpcManagementContext context,
        ISupplierQuotationService _)
    {
        _workbench = new PurchaseWorkbenchService(context);
        _generation = new PurchaseRequestGenerationService(context);
        _supplierDecision = new PurchaseSupplierDecisionService(context, new EfTransactionRunner(context));
        _submission = new PurchaseRequestSubmissionService(context);
    }

    public Task<PurchaseWorkbenchWeekDto> GetWorkbenchWeekAsync(
        PurchaseWorkbenchQueryDto query,
        CancellationToken cancellationToken = default)
        => _workbench.GetWorkbenchWeekAsync(query, cancellationToken);

    public Task<PurchaseRequestWorkflowResultDto?> GenerateFromDemandAsync(
        GeneratePurchaseRequestFromDemandRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _generation.GenerateFromDemandAsync(request, userId, cancellationToken);

    public Task<SupplierEvidenceResultDto> GetSupplierEvidenceAsync(
        string requestId,
        string lineId,
        CancellationToken cancellationToken = default)
        => _supplierDecision.GetSupplierEvidenceAsync(requestId, lineId, cancellationToken);

    public Task<PurchaseLineSupplierDecisionDto> ConfirmLineSupplierAsync(
        string requestId,
        string lineId,
        ConfirmPurchaseLineSupplierRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _supplierDecision.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            request,
            userId,
            cancellationToken);

    public Task<PurchaseRequestWorkflowResultDto?> SubmitAsync(
        string requestId,
        string? userId,
        CancellationToken cancellationToken = default)
        => _submission.SubmitAsync(requestId, userId, cancellationToken);
}
