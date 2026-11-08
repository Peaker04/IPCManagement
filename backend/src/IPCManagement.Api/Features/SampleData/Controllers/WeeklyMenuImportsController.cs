using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.SampleData.Controllers;

[ApiController]
[Route("api/coordination")]
[Tags("Coordination")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[EnableRateLimiting("api-general")]
public sealed partial class WeeklyMenuImportsController : ControllerBase
{
    /// <summary>
    /// Hạn mức dung lượng cho mọi file Excel tải lên luồng thực đơn tuần.
    /// Trỏ về hằng số dùng chung <see cref="XlsxSecurityLimits.MaxUploadBytes"/> để mọi endpoint
    /// nhận file Excel (thực đơn tuần, import BOM) chỉ có MỘT nguồn sự thật về hạn mức;
    /// căn cứ đo đạc xem tại chính hằng số đó.
    /// </summary>
    private const long MaxUploadBytes = XlsxSecurityLimits.MaxUploadBytes;

    private readonly IWeeklyMenuQueryService _queryService;
    private readonly IWeeklyMenuTemplateService _templateService;
    private readonly IWeeklyMenuImportService _importService;
    private readonly IWeeklyMenuImportHistoryService _historyService;
    private readonly ICustomerImportMappingService _mappingService;
    private readonly IWeeklyMenuBulkEditService _bulkEditService;
    private readonly IMenuAmendmentService _menuAmendmentService;
    private readonly ICurrentUserService _currentUserService;

    public WeeklyMenuImportsController(
        IWeeklyMenuQueryService queryService,
        IWeeklyMenuTemplateService templateService,
        IWeeklyMenuImportService importService,
        IWeeklyMenuImportHistoryService historyService,
        ICustomerImportMappingService mappingService,
        IWeeklyMenuBulkEditService bulkEditService,
        IMenuAmendmentService menuAmendmentService,
        ICurrentUserService currentUserService)
    {
        _queryService = queryService;
        _templateService = templateService;
        _importService = importService;
        _historyService = historyService;
        _mappingService = mappingService;
        _bulkEditService = bulkEditService;
        _menuAmendmentService = menuAmendmentService;
        _currentUserService = currentUserService;
    }

    private static DateOnly? ParseOptionalWeekStartDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateOnly.TryParse(value, out var parsed) ? parsed : null;
    }
}
