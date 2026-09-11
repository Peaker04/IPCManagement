using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public sealed class UnitNormalizationReviewService(IpcManagementContext context) : IUnitNormalizationReviewService
{
    public async Task<UnitNormalizationReviewDecisionDto> DecideAsync(
        string reviewId,
        UnitNormalizationReviewDecisionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var id = GuidHelper.ParseGuidString(reviewId) ?? throw new ArgumentException("ReviewId không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được Manager.");
        var roleName = await context.Users.AsNoTracking()
            .Where(user => user.UserId.SequenceEqual(actorId))
            .Join(context.Roles.AsNoTracking(), user => user.RoleId, role => role.RoleId, (_, role) => role.RoleName)
            .SingleOrDefaultAsync(cancellationToken);
        if (!AuthorizationPolicies.MatchesManagerRole(roleName))
            throw new UnauthorizedAccessException("Chỉ Manager được disposition unit normalization review.");

        var item = await context.Unitnormalizationreviews
            .Include(review => review.SourceUnit)
            .Include(review => review.CatalogUnit)
            .SingleOrDefaultAsync(review => review.ReviewId.SequenceEqual(id), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy unit normalization review.");
        if (item.Status != "NEEDS_CONFIRMATION")
            throw new InvalidOperationException("Unit normalization review đã có terminal disposition.");

        var evidenceSource = DataQualityDispositionPolicy.RequireText(request.EvidenceSource, 500, "EvidenceSource không hợp lệ.");
        var evidenceNote = DataQualityDispositionPolicy.RequireText(request.EvidenceNote, 2000, "EvidenceNote không hợp lệ.");
        var decision = request.Decision.Trim().ToUpperInvariant();
        byte[]? recommendedUnitId = null;
        if (!string.IsNullOrWhiteSpace(request.RecommendedUnitId))
        {
            recommendedUnitId = GuidHelper.ParseGuidString(request.RecommendedUnitId)
                ?? throw new ArgumentException("RecommendedUnitId không hợp lệ.");
        }

        if (decision == "CONFIRM")
        {
            if (request.SourceToCatalogFactor is null or <= 0)
                throw new ArgumentException("CONFIRM bắt buộc có conversion factor dương.");
            if (!DataQualityPolicy.CanConvertUnits(item.SourceUnit, item.CatalogUnit))
                throw new InvalidOperationException("Source/catalog unit không cùng base-family; không được confirm factor.");
            if (recommendedUnitId is not null &&
                !recommendedUnitId.SequenceEqual(item.SourceUnitId) &&
                !recommendedUnitId.SequenceEqual(item.CatalogUnitId))
                throw new ArgumentException("Recommended unit phải là source hoặc catalog unit đã review.");

            item.Status = "CONFIRMED";
            item.Confidence = "REVIEWED";
            item.ProposedSourceToCatalogFactor = request.SourceToCatalogFactor;
            item.RecommendedUnitId = recommendedUnitId ?? item.CatalogUnitId;
        }
        else if (decision == "RETAIN_DISTINCT")
        {
            item.Status = "RETAIN_DISTINCT";
            item.Confidence = "REVIEWED";
            item.ProposedSourceToCatalogFactor = null;
            item.RecommendedUnitId = null;
        }
        else if (decision == "BLOCK")
        {
            item.Status = "BLOCKED_BUSINESS";
            item.Confidence = "BLOCKED";
        }
        else
        {
            throw new ArgumentException("Decision chỉ nhận CONFIRM, RETAIN_DISTINCT hoặc BLOCK.");
        }

        var now = DateTime.UtcNow;
        item.EvidenceSource = evidenceSource;
        item.EvidenceNote = evidenceNote;
        item.ReviewedBy = actorId;
        item.ReviewedAt = now;
        item.UpdatedAt = now;
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = now,
            ChangedBy = actorId,
            BusinessArea = "DataQuality",
            EntityName = nameof(UnitNormalizationReview),
            EntityId = item.ReviewId,
            FieldName = "Disposition",
            OldValue = "NEEDS_CONFIRMATION",
            NewValue = item.Status,
            Reason = evidenceNote
        });
        await context.SaveChangesAsync(cancellationToken);

        return new UnitNormalizationReviewDecisionDto(
            GuidHelper.ToGuidString(item.ReviewId), item.Status, item.Confidence,
            item.ProposedSourceToCatalogFactor,
            item.RecommendedUnitId is null ? null : GuidHelper.ToGuidString(item.RecommendedUnitId),
            item.EvidenceSource, item.EvidenceNote, GuidHelper.ToGuidString(actorId), now);
    }
}
