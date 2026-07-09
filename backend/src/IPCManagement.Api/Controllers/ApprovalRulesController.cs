using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services.Approvals;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/approval-rules")]
[Authorize]
public class ApprovalRulesController : ControllerBase
{
    private readonly IApprovalRoutingService _routingService;

    public ApprovalRulesController(IApprovalRoutingService routingService)
    {
        _routingService = routingService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<Approvalrule>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRules()
    {
        var rules = await _routingService.GetAllRulesAsync();
        return Ok(ApiResponse<IReadOnlyList<Approvalrule>>.SuccessResult(rules));
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<Approvalrule>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRuleById([FromRoute] string id)
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

        return Ok(ApiResponse<Approvalrule>.SuccessResult(rule));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Approvalrule>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateRule([FromBody] ApprovalRuleRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.RuleName) || string.IsNullOrWhiteSpace(request.DocumentType))
        {
            return BadRequest(ApiResponse.FailResult("Tên rule và loại chứng từ không được để trống."));
        }

        var rule = new Approvalrule
        {
            RuleName = request.RuleName,
            DocumentType = request.DocumentType,
            MinAmount = request.MinAmount,
            MaxAmount = request.MaxAmount,
            SlaHours = request.SlaHours,
            IsActive = request.IsActive
        };

        var assignments = request.Assignments.Select(a => new Approvalassignment
        {
            Sequence = a.Sequence,
            ApproverRole = a.ApproverRole,
            ApproverUserId = GuidHelper.ParseGuidString(a.ApproverUserId),
            IsRequired = a.IsRequired
        }).ToList();

        var createdRule = await _routingService.CreateRuleAsync(rule, assignments);
        return Ok(ApiResponse<Approvalrule>.SuccessResult(createdRule, "Tạo rule phê duyệt thành công."));
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<Approvalrule>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRule([FromRoute] string id, [FromBody] ApprovalRuleRequestDto request)
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

        var rule = new Approvalrule
        {
            RuleName = request.RuleName,
            DocumentType = request.DocumentType,
            MinAmount = request.MinAmount,
            MaxAmount = request.MaxAmount,
            SlaHours = request.SlaHours,
            IsActive = request.IsActive
        };

        var assignments = request.Assignments.Select(a => new Approvalassignment
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

        return Ok(ApiResponse<Approvalrule>.SuccessResult(updatedRule, "Cập nhật rule phê duyệt thành công."));
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteRule([FromRoute] string id)
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
