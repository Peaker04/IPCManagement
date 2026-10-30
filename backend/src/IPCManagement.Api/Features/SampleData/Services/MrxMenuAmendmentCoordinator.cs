using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class MrxMenuAmendmentCoordinator(
    IpcManagementContext context,
    IEfTransactionRunner? transactionRunner,
    SystemOperationRequestContext? operationContext,
    Func<CreateMenuAmendmentRequest, string?, CancellationToken, Task<MenuAmendmentResultDto>> createAsync,
    Func<CreateMenuAmendmentRequest, CancellationToken, Task<MenuAmendmentResultDto>> previewAsync)
{
    private MrxSourceChangeApplier Applier => new(context, transactionRunner, operationContext);

    /// <summary>BR-MRX-EDIT-1: Admin/Quản lý áp dụng trực tiếp (ApplyMode DIRECT) qua <see cref="MrxSourceChangeApplier"/>.</summary>
    public async Task<MenuAmendmentResultDto> ApplyMrxAsync(
        CreateMenuAmendmentRequest request,
        string? actorUserId,
        IReadOnlyCollection<string> actorRoles,
        CancellationToken cancellationToken = default)
    {
        RequireMrxBaseVersion(request);
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được người áp dụng thay đổi.");
        var actorRole = MrxSourceChangeApplier.ResolveActorRole(actorRoles);
        var preview = await previewAsync(request, cancellationToken);
        var amendmentId = GuidHelper.NewId();
        var amendment = new MenuAmendment
        {
            MenuAmendmentId = amendmentId,
            CustomerId = GuidHelper.ParseGuidString(request.CustomerId)!,
            WeekStartDate = request.WeekStartDate,
            BaseMenuVersionId = GuidHelper.ParseGuidString(request.ExpectedBaseMenuVersionId),
            Status = "APPROVED_FOR_EXECUTION",
            Reason = request.Reason.Trim(),
            ImpactSnapshotJson = JsonSerializer.Serialize(preview),
            CreatedBy = actorId,
            CreatedAt = DateTime.UtcNow,
            Lines = preview.ImpactLines.Select(line => new MenuAmendmentLine
            {
                MenuAmendmentLineId = GuidHelper.NewId(), MenuAmendmentId = amendmentId, ServiceDate = line.ServiceDate,
                ShiftName = line.ShiftName, DishSlot = line.DishSlot,
                OldDishId = GuidHelper.ParseGuidString(line.OldDishId), NewDishId = GuidHelper.ParseGuidString(line.NewDishId)!
            }).ToList()
        };
        return await Applier.ApplyAsync(amendment, actorId, actorRole, MrxSourceChangeApplier.DirectMode, request.ExpectedBatchVersion, cancellationToken);
    }

    public async Task<MenuAmendmentResultDto> DecideMrxAsync(
        string amendmentId,
        ReviewMenuAmendmentRequest request,
        string? actorUserId,
        IReadOnlyCollection<string> actorRoles,
        CancellationToken cancellationToken = default)
    {
        var id = GuidHelper.ParseGuidString(amendmentId) ?? throw new ArgumentException("Mã yêu cầu thay đổi không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được người duyệt.");
        var actorRole = MrxSourceChangeApplier.ResolveActorRole(actorRoles);
        var runner = transactionRunner ?? new EfTransactionRunner(context);
        if (!request.Approved)
        {
            return await MrxSourceChangeApplier.RunMrxTransactionAsync(runner, operationContext, async token =>
            {
                var amendment = await LoadPendingAsync(id, token);
                var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
                if (reason is null) throw new BusinessRuleException("Cần nêu lý do từ chối thay đổi.");
                SetReviewStatus(amendment, "REJECTED", actorId, reason);
                await context.SaveChangesAsync(token);
                var rejected = ReadImpact(amendment.ImpactSnapshotJson);
                rejected.MenuAmendmentId = amendmentId;
                rejected.Status = amendment.Status;
                return rejected;
            }, token => context.Menuamendments.AsNoTracking().AnyAsync(item => item.MenuAmendmentId.SequenceEqual(id) && item.Status == "REJECTED", token), cancellationToken);
        }

        var pending = await context.Menuamendments.AsNoTracking().Include(item => item.Lines)
            .SingleOrDefaultAsync(item => item.MenuAmendmentId.SequenceEqual(id), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu thay đổi thực đơn.");
        try
        {
            return await Applier.ApplyAsync(pending, actorId, actorRole, MrxSourceChangeApplier.ApprovedRequestMode, null, cancellationToken);
        }
        catch (MrxSourceChangeException error) when (error.Code == MrxErrorCodes.DayLocked)
        {
            // BR-MRX-EDIT-9: ngày đã khóa từ lúc gửi → trả yêu cầu về CORRECTION_REQUIRED (giao dịch riêng, giao dịch áp dụng đã rollback).
            context.ChangeTracker.Clear();
            await MrxSourceChangeApplier.RunMrxTransactionAsync(runner, operationContext, async token =>
            {
                var amendment = await LoadPendingAsync(id, token);
                SetReviewStatus(amendment, "CORRECTION_REQUIRED", actorId, error.Message);
                await context.SaveChangesAsync(token);
                return true;
            }, token => context.Menuamendments.AsNoTracking().AnyAsync(item => item.MenuAmendmentId.SequenceEqual(id) && item.Status == "CORRECTION_REQUIRED", token), cancellationToken);
            throw;
        }
    }

    private async Task<MenuAmendment> LoadPendingAsync(byte[] id, CancellationToken token)
    {
        var amendment = await context.Menuamendments.SingleOrDefaultAsync(item => item.MenuAmendmentId.SequenceEqual(id), token)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu thay đổi thực đơn.");
        if (amendment.Status is not ("PENDING_REVIEW" or "RECONCILIATION_REQUIRED"))
            throw new BusinessRuleException("Yêu cầu thay đổi không còn chờ duyệt.");
        return amendment;
    }

    private void SetReviewStatus(MenuAmendment amendment, string status, byte[] actorId, string reason)
    {
        var oldStatus = amendment.Status;
        amendment.Status = status;
        amendment.ReviewedBy = actorId;
        amendment.ReviewedAt = DateTime.UtcNow;
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = amendment.ReviewedAt.Value, ChangedBy = actorId, BusinessArea = "Reconciliation", EntityName = nameof(MenuAmendment), EntityId = amendment.MenuAmendmentId, FieldName = "Status", OldValue = oldStatus, NewValue = status, Reason = reason });
    }

    public Task<MenuAmendmentResultDto> PreviewMrxAsync(CreateMenuAmendmentRequest request, CancellationToken cancellationToken = default)
    {
        RequireMrxBaseVersion(request);
        return previewAsync(request, cancellationToken);
    }

    public Task<MenuAmendmentResultDto> SubmitMrxAsync(CreateMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)
    {
        RequireMrxBaseVersion(request);
        return createAsync(request, actorUserId, cancellationToken);
    }

    public async Task<IReadOnlyList<MenuAmendmentInboxItemDto>> GetMrxInboxAsync(CancellationToken cancellationToken = default)
    {
        var items = await context.Menuamendments.AsNoTracking()
            .Include(item => item.Lines)
            .Include(item => item.Customer)
            .Where(item => item.Status == "PENDING_REVIEW" || item.Status == "RECONCILIATION_REQUIRED")
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);
        return items.Select(MapMrxInboxItem).ToList();
    }

    private static void RequireMrxBaseVersion(CreateMenuAmendmentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ExpectedBaseMenuVersionId))
            throw new ArgumentException("MRX source change requires ExpectedBaseMenuVersionId.");
    }

    private static MenuAmendmentResultDto ReadImpact(string? json)
        => string.IsNullOrWhiteSpace(json)
            ? new MenuAmendmentResultDto()
            : JsonSerializer.Deserialize<MenuAmendmentResultDto>(json) ?? new MenuAmendmentResultDto();

    private static MenuAmendmentInboxItemDto MapMrxInboxItem(MenuAmendment item)
    {
        var result = ReadImpact(item.ImpactSnapshotJson);
        return new MenuAmendmentInboxItemDto
        {
            MenuAmendmentId = GuidHelper.ToGuidString(item.MenuAmendmentId),
            CustomerId = GuidHelper.ToGuidString(item.CustomerId),
            CustomerName = item.Customer?.CustomerName ?? string.Empty,
            WeekStartDate = item.WeekStartDate,
            Status = item.Status,
            Reason = item.Reason,
            CreatedAt = item.CreatedAt,
            RequiresReconciliation = result.RequiresReconciliation,
            HasPurchaseOrder = result.HasPurchaseOrder,
            HasReceipt = result.HasReceipt,
            HasIssue = result.HasIssue,
            AffectedDemandCount = result.AffectedDemandCount,
            AffectedPurchaseRequestCount = result.AffectedPurchaseRequestCount,
            AffectedReconciliationBatchIds = result.AffectedReconciliationBatchIds,
            ImpactLines = result.ImpactLines
        };
    }
}
