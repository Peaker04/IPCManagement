using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.SampleData.Services;

public interface IWeeklyMenuQueryService
{
    Task<IReadOnlyList<CoordinationCustomerOptionDto>> GetActiveCustomersAsync(
        CancellationToken cancellationToken = default);

    Task<WeeklyMenuImportResultDto?> GetCommittedWeeklyMenuAsync(
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default);
}

public interface IWeeklyMenuTemplateService
{
    Task<(byte[] Content, string CustomerCode)> BuildWeeklyMenuTemplateAsync(
        string? customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default);
}

public interface ICustomerImportMappingService
{
    Task<CustomerImportMappingDto?> GetCustomerImportMappingAsync(
        string customerId,
        CancellationToken cancellationToken = default);

    Task<CustomerImportMappingDto> SaveCustomerImportMappingAsync(
        string customerId,
        SaveCustomerImportMappingRequest request,
        CancellationToken cancellationToken = default);
}

public interface IWeeklyMenuImportService
{
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
        string? previewToken,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<WeeklyMenuImportResultDto>> CommitWeeklyMenuImportBatchAsync(
        IReadOnlyList<WeeklyMenuImportBatchItem> items,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);
}

public sealed record WeeklyMenuImportBatchItem(
    Stream FileStream,
    string FileName,
    string CustomerId,
    DateOnly? WeekStartDate,
    decimal? PriceTierAmount,
    string? PreviewToken);

internal interface IWeeklyMenuImportPersistence
{
    Task<WeeklyMenuImportResultDto> CommitAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        decimal priceTierAmount,
        string? actorUserId,
        CancellationToken cancellationToken);
}

public interface IWeeklyMenuImportHistoryService
{
    Task<IReadOnlyList<WeeklyMenuImportHistoryItemDto>> GetWeeklyMenuImportHistoryAsync(
        string? customerId,
        CancellationToken cancellationToken = default);

    Task<RollbackWeeklyMenuImportResultDto> RollbackWeeklyMenuImportAsync(
        string menuVersionId,
        string? actorUserId,
        CancellationToken cancellationToken = default);
}

public interface IWeeklyMenuBulkEditService
{
    Task<(bool Success, string Message, List<string> Warnings)> BulkUpdateWeeklyMenuAsync(
        BulkUpdateWeeklyMenuRequest request,
        CancellationToken cancellationToken = default);
}

public interface IMenuAmendmentService
{
    Task<MenuAmendmentResultDto> CreateAsync(
        CreateMenuAmendmentRequest request,
        string? actorUserId,
        CancellationToken cancellationToken = default);

    Task<MenuAmendmentResultDto> ReviewAsync(string amendmentId, ReviewMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default);
    Task<MenuAmendmentResultDto> ExecuteAsync(string amendmentId, string? actorUserId, CancellationToken cancellationToken = default);
    Task<MenuAmendmentResultDto> BreakGlassExecuteAsync(string amendmentId, BreakGlassMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default);
    Task<MenuAmendmentDecisionItemDto> ExecuteDecisionAsync(string decisionItemId, MenuAmendmentDecisionCommandRequest request, string? actorUserId, CancellationToken cancellationToken = default);
    Task<MenuAmendmentDecisionPageDto> GetDecisionPageAsync(string? customerId, bool allCustomers, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<MenuAmendmentInboxItemDto>> GetInboxAsync(string? status, CancellationToken cancellationToken = default);
}
