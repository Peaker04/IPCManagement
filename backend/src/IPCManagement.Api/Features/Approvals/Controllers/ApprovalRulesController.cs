using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;

namespace IPCManagement.Api.Features.Approvals.Controllers;

[ApiController]
[Route("api/approval-rules")]
[Authorize(Policy = AuthorizationPolicies.AdminAccess)]
public class ApprovalRulesController : ControllerBase
{
    private readonly IApprovalRoutingService _routingService;

    public ApprovalRulesController(IApprovalRoutingService routingService)
    {
        _routingService = routingService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ApprovalRule>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRulesAsync()
    {
        var rules = await _routingService.GetAllRulesAsync();
        return Ok(ApiResponse<IReadOnlyList<ApprovalRule>>.SuccessResult(rules));
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<ApprovalRule>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRuleByIdAsync([FromRoute] string id)
    {
        var ruleId = GuidHelper.ParseGuidString(id);
        if (ruleId == null)
        {
            return BadRequest(ApiResponse.FailResult("ID không hợp lệ."));
        }

        var rule = await _routingService.GetRuleByIdAsync(ruleId);
        if (rule == null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy rule."));
        }

        return Ok(ApiResponse<ApprovalRule>.SuccessResult(rule));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<ApprovalRule>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateRuleAsync([FromBody] ApprovalRuleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RuleName) || string.IsNullOrWhiteSpace(request.DocumentType))
        {
            return BadRequest(ApiResponse.FailResult("Tên rule và loại chứng từ không được để trống."));
        }

        var rule = new ApprovalRule
        {
            RuleName = request.RuleName,
            DocumentType = request.DocumentType,
            MinAmount = request.MinAmount,
            MaxAmount = request.MaxAmount,
            SlaHours = request.SlaHours,
            IsActive = request.IsActive
        };

        var assignments = request.Assignments.Select(a => new ApprovalAssignment
        {
            Sequence = a.Sequence,
            ApproverRole = a.ApproverRole,
            ApproverUserId = GuidHelper.ParseGuidString(a.ApproverUserId),
            IsRequired = a.IsRequired
        }).ToList();

        var createdRule = await _routingService.CreateRuleAsync(rule, assignments);
        return Ok(ApiResponse<ApprovalRule>.SuccessResult(createdRule, "Tạo rule phê duyệt thành công."));
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<ApprovalRule>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRuleAsync([FromRoute] string id, [FromBody] ApprovalRuleRequest request)
    {
        var ruleId = GuidHelper.ParseGuidString(id);
        if (ruleId == null)
        {
            return BadRequest(ApiResponse.FailResult("ID không hợp lệ."));
        }

        if (string.IsNullOrWhiteSpace(request.RuleName) || string.IsNullOrWhiteSpace(request.DocumentType))
        {
            return BadRequest(ApiResponse.FailResult("Tên rule và loại chứng từ không được để trống."));
        }

        var rule = new ApprovalRule
        {
            RuleName = request.RuleName,
            DocumentType = request.DocumentType,
            MinAmount = request.MinAmount,
            MaxAmount = request.MaxAmount,
            SlaHours = request.SlaHours,
            IsActive = request.IsActive
        };

        var assignments = request.Assignments.Select(a => new ApprovalAssignment
        {
            Sequence = a.Sequence,
            ApproverRole = a.ApproverRole,
            ApproverUserId = GuidHelper.ParseGuidString(a.ApproverUserId),
            IsRequired = a.IsRequired
        }).ToList();

        var updatedRule = await _routingService.UpdateRuleAsync(ruleId, rule, assignments);
        if (updatedRule == null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy rule cần cập nhật."));
        }

        return Ok(ApiResponse<ApprovalRule>.SuccessResult(updatedRule, "Cập nhật rule phê duyệt thành công."));
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteRuleAsync([FromRoute] string id)
    {
        var ruleId = GuidHelper.ParseGuidString(id);
        if (ruleId == null)
        {
            return BadRequest(ApiResponse.FailResult("ID không hợp lệ."));
        }

        var deleted = await _routingService.DeleteRuleAsync(ruleId);
        if (!deleted)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy rule cần xóa."));
        }

        return Ok(ApiResponse.SuccessResult("Xóa rule thành công."));
    }
}
