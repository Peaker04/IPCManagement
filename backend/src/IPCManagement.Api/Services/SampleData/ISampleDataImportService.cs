using IPCManagement.Api.Models.DTOs.SampleData;

namespace IPCManagement.Api.Services.SampleData;

public interface ISampleDataImportService
{
    Task<SampleDataImportResultDto> ImportAsync(
        SampleDataImportRequestDto request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CoordinationCustomerOptionDto>> GetActiveCustomersAsync(
        CancellationToken cancellationToken = default);

    Task<WeeklyMenuImportResultDto?> GetCommittedWeeklyMenuAsync(
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default);

    Task<WeeklyMenuImportResultDto> PreviewWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default);

    Task<WeeklyMenuImportResultDto> CommitWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default);

    Task<CustomerImportMappingDto?> GetCustomerImportMappingAsync(
        string customerId,
        CancellationToken cancellationToken = default);

    Task<CustomerImportMappingDto> SaveCustomerImportMappingAsync(
        string customerId,
        SaveCustomerImportMappingDto request,
        CancellationToken cancellationToken = default);
}
