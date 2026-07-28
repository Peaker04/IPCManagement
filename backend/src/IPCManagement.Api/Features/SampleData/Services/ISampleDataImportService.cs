
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.SampleData.Contracts;

namespace IPCManagement.Api.Features.SampleData.Services;

public interface ISampleDataImportService
{
    Task<IReadOnlyList<CoordinationCustomerOptionDto>> GetActiveCustomersAsync(
        CancellationToken cancellationToken = default);

    Task<WeeklyMenuImportResultDto?> GetCommittedWeeklyMenuAsync(
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default);

    Task<(byte[] Content, string CustomerCode)> BuildWeeklyMenuTemplateAsync(
        string? customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default);

    Task<WeeklyMenuImportResultDto> PreviewWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        decimal? priceTierAmount,
        CancellationToken cancellationToken = default);

    Task<WeeklyMenuImportResultDto> CommitWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        decimal? priceTierAmount,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<WeeklyMenuImportHistoryItemDto>> GetWeeklyMenuImportHistoryAsync(
        string? customerId,
        CancellationToken cancellationToken = default);

    Task<RollbackWeeklyMenuImportResultDto> RollbackWeeklyMenuImportAsync(
        string menuVersionId,
        string? actorUserId,
        CancellationToken cancellationToken = default);

    Task<CustomerImportMappingDto?> GetCustomerImportMappingAsync(
        string customerId,
        CancellationToken cancellationToken = default);

    Task<CustomerImportMappingDto> SaveCustomerImportMappingAsync(
        string customerId,
        SaveCustomerImportMappingRequest request,
        CancellationToken cancellationToken = default);

    Task<(bool Success, string Message, List<string> Warnings)> BulkUpdateWeeklyMenuAsync(
        BulkUpdateWeeklyMenuRequest request,
        CancellationToken cancellationToken = default);
}
