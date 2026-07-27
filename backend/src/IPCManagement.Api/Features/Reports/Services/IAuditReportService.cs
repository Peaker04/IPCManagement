using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IAuditReportService
{
    Task<IReadOnlyList<AuditChangeReportDto>> GetAuditChangesAsync(WorkflowReportQueryDto query);
    Task<CursorPageDto<AuditChangeReportDto>> GetAuditChangePageAsync(WorkflowReportQueryDto query);
    Task<ReportFileContent> ExportAuditChangesCsvAsync(WorkflowReportQueryDto query);
}

public sealed record ReportFileContent(byte[] Content, string ContentType, string FileName);
