using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/approval-history")]
[Authorize]
public class ApprovalHistoryController : ControllerBase
{
    private readonly Data.IpcManagementContext _context;

    public ApprovalHistoryController(Data.IpcManagementContext context)
    {
        _context = context;
    }

    [HttpGet("{documentType}/{documentId}")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ApprovalHistoryItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHistory(string documentType, string documentId)
    {
        var guid = GuidHelper.ParseGuidString(documentId);
        if (guid is null)
        {
            return BadRequest(ApiResponse.FailResult("Mã tài liệu không hợp lệ."));
        }

        var normalizedType = documentType.Trim().ToLowerInvariant();

        var history = await _context.Approvalhistories
            .Include(h => h.ActionByNavigation)
            .AsNoTracking()
            .Where(h => h.TargetType == normalizedType && h.TargetId == guid)
            .OrderBy(h => h.ActionAt)
            .ToListAsync();

        var result = history.Select(h => new ApprovalHistoryItemDto
        {
            HistoryId = GuidHelper.ToGuidString(h.ApprovalHistoryId),
            TargetType = h.TargetType,
            TargetId = GuidHelper.ToGuidString(h.TargetId),
            Decision = h.Decision,
            OldStatus = h.OldStatus,
            NewStatus = h.NewStatus,
            Reason = h.Reason,
            ActionBy = GuidHelper.ToGuidString(h.ActionBy),
            ActionByName = h.ActionByNavigation?.FullName ?? "Unknown",
            ActionAt = h.ActionAt
        }).ToList();

        return Ok(ApiResponse<IReadOnlyList<ApprovalHistoryItemDto>>.SuccessResult(result));
    }
}

public class ApprovalHistoryItemDto
{
    public string HistoryId { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public string? OldStatus { get; set; }
    public string? NewStatus { get; set; }
    public string? Reason { get; set; }
    public string ActionBy { get; set; } = string.Empty;
    public string ActionByName { get; set; } = string.Empty;
    public DateTime ActionAt { get; set; }
}
