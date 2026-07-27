using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Approvals;

public class ApprovalRoutingService : IApprovalRoutingService
{
    private readonly IpcManagementContext _context;

    public ApprovalRoutingService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<ApprovalRule?> GetMatchingRuleAsync(string documentType, decimal? amount)
        => MatchRule(await GetActiveRulesAsync(documentType), amount);

    public async Task<IReadOnlyList<ApprovalRule>> GetActiveRulesAsync(string documentType)
    {
        var normalizedType = (documentType ?? string.Empty).Trim().ToLowerInvariant();

        return await _context.Approvalrules
            .AsNoTracking()
            .Where(r => r.IsActive && r.DocumentType.ToLower() == normalizedType)
            .ToListAsync();
    }

    /// <summary>
    /// Chọn rule khớp nhất từ danh sách đã tải — cho phép caller tải rule một lần
    /// rồi match nhiều chứng từ mà không phát sinh truy vấn theo từng chứng từ.
    /// </summary>
    public static ApprovalRule? MatchRule(IReadOnlyList<ApprovalRule>? rules, decimal? amount)
    {
        if (rules is null || rules.Count == 0)
        {
            return null;
        }

        if (amount.HasValue)
        {
            // Find the most specific rule matching the threshold
            return rules
                .Where(r => (!r.MinAmount.HasValue || amount.Value >= r.MinAmount.Value) &&
                            (!r.MaxAmount.HasValue || amount.Value <= r.MaxAmount.Value))
                .OrderByDescending(r => r.MinAmount ?? 0)
                .FirstOrDefault();
        }

        return rules.FirstOrDefault();
    }

    public async Task<IReadOnlyList<ApprovalAssignment>> GetAssignmentsForRuleAsync(byte[] ruleId)
    {
        return await _context.Approvalassignments
            .AsNoTracking()
            .Include(a => a.ApproverUser)
            .Where(a => a.RuleId.SequenceEqual(ruleId))
            .OrderBy(a => a.Sequence)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<ApprovalRule>> GetAllRulesAsync()
    {
        return await _context.Approvalrules
            .AsNoTracking()
            .Include(r => r.Approvalassignments)
                .ThenInclude(a => a.ApproverUser)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();
    }

    public async Task<ApprovalRule?> GetRuleByIdAsync(byte[] ruleId)
    {
        return await _context.Approvalrules
            .AsNoTracking()
            .Include(r => r.Approvalassignments)
                .ThenInclude(a => a.ApproverUser)
            .FirstOrDefaultAsync(r => r.RuleId.SequenceEqual(ruleId));
    }

    public async Task<ApprovalRule> CreateRuleAsync(ApprovalRule rule, IEnumerable<ApprovalAssignment> assignments)
    {
        if (rule.RuleId == null || rule.RuleId.Length == 0)
        {
            rule.RuleId = Guid.NewGuid().ToByteArray();
        }
        rule.CreatedAt = DateTime.UtcNow;
        rule.IsActive = true;

        _context.Approvalrules.Add(rule);

        foreach (var assignment in assignments)
        {
            assignment.AssignmentId = Guid.NewGuid().ToByteArray();
            assignment.RuleId = rule.RuleId;
            _context.Approvalassignments.Add(assignment);
        }

        await _context.SaveChangesAsync();
        return rule;
    }

    public async Task<ApprovalRule?> UpdateRuleAsync(byte[] ruleId, ApprovalRule rule, IEnumerable<ApprovalAssignment> assignments)
    {
        var existingRule = await _context.Approvalrules
            .Include(r => r.Approvalassignments)
            .FirstOrDefaultAsync(r => r.RuleId.SequenceEqual(ruleId));

        if (existingRule == null)
        {
            return null;
        }

        existingRule.RuleName = rule.RuleName;
        existingRule.DocumentType = rule.DocumentType;
        existingRule.MinAmount = rule.MinAmount;
        existingRule.MaxAmount = rule.MaxAmount;
        existingRule.SlaHours = rule.SlaHours;
        existingRule.IsActive = rule.IsActive;

        // Remove old assignments
        _context.Approvalassignments.RemoveRange(existingRule.Approvalassignments);

        // Add new assignments
        foreach (var assignment in assignments)
        {
            assignment.AssignmentId = Guid.NewGuid().ToByteArray();
            assignment.RuleId = ruleId;
            _context.Approvalassignments.Add(assignment);
        }

        await _context.SaveChangesAsync();
        return existingRule;
    }

    public async Task<bool> DeleteRuleAsync(byte[] ruleId)
    {
        var rule = await _context.Approvalrules.FirstOrDefaultAsync(r => r.RuleId.SequenceEqual(ruleId));
        if (rule == null)
        {
            return false;
        }

        _context.Approvalrules.Remove(rule);
        await _context.SaveChangesAsync();
        return true;
    }
}
