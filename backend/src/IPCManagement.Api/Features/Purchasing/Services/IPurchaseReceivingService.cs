
using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public interface IPurchaseReceivingService
{
    Task<WarehousePurchaseReceiptResultDto> RecordAsync(
        RecordWarehousePurchaseReceiptRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<WarehousePurchaseReceiptResultDto> AcceptQualityAsync(
        string receiptId,
        ReceiptQualityDecisionRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<WarehousePurchaseReceiptResultDto> PostAsync(
        string receiptId,
        ReceiptPostRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<WarehousePurchaseReceiptResultDto> ReworkAsync(
        string receiptId,
        ReceiptReworkRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<WarehousePurchaseReceiptResultDto> VoidAsync(
        string receiptId,
        ReceiptVoidRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<ReceiptCorrectionResultDto> CreateCorrectionAsync(
        string receiptId,
        CreateReceiptCorrectionRequest request,
        string? userId,
        CancellationToken cancellationToken = default);
}
