using System.Data;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
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
    Func<string, string?, string?, CancellationToken, bool, Task<MenuAmendmentResultDto>> executeCoreAsync,
    Func<CreateMenuAmendmentRequest, CancellationToken, Task<MenuAmendmentResultDto>> previewAsync)
{
    public async Task<MenuAmendmentResultDto> ConfirmMrxAsync(
        CreateMenuAmendmentRequest request,
        string? actorUserId,
        CancellationToken cancellationToken = default)
    {
        RequireMrxBaseVersion(request);
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được Admin xác nhận.");
        var runner = transactionRunner ?? new EfTransactionRunner(context);
        byte[]? amendmentId = null;
        return await RunMrxTransactionAsync(runner, async token =>
        {
            var created = await createAsync(request, actorUserId, token);
            amendmentId = GuidHelper.ParseGuidString(created.MenuAmendmentId)!;
            var amendment = await context.Menuamendments.SingleAsync(item => item.MenuAmendmentId.SequenceEqual(amendmentId), token);
            var oldStatus = amendment.Status;
            amendment.Status = "APPROVED_FOR_EXECUTION";
            amendment.ReviewedBy = actorId;
            amendment.ReviewedAt = DateTime.UtcNow;
            context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = amendment.ReviewedAt.Value, ChangedBy = actorId, BusinessArea = "Reconciliation", EntityName = nameof(MenuAmendment), EntityId = amendment.MenuAmendmentId, FieldName = "Status", OldValue = oldStatus, NewValue = amendment.Status, Reason = amendment.Reason });
            await context.SaveChangesAsync(token);
            return await executeCoreAsync(created.MenuAmendmentId, actorUserId, null, token, true);
        }, async token => amendmentId is not null && await context.Menuamendments.AsNoTracking().AnyAsync(item => item.MenuAmendmentId.SequenceEqual(amendmentId) && item.Status == "EXECUTED", token), isolationLevel: IsolationLevel.Serializable, cancellationToken: cancellationToken);
    }

    public async Task<MenuAmendmentResultDto> DecideMrxAsync(
        string amendmentId,
        ReviewMenuAmendmentRequest request,
        string? actorUserId,
        CancellationToken cancellationToken = default)
    {
        var id = GuidHelper.ParseGuidString(amendmentId) ?? throw new ArgumentException("Mã yêu cầu thay đổi không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được Admin phê duyệt.");
        var expectedStatus = request.Approved ? "EXECUTED" : "REJECTED";
        var runner = transactionRunner ?? new EfTransactionRunner(context);
        return await RunMrxTransactionAsync(runner, async token =>
        {
            var amendment = await context.Menuamendments.SingleOrDefaultAsync(item => item.MenuAmendmentId.SequenceEqual(id), token)
                ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu thay đổi thực đơn.");
            if (amendment.Status is not ("PENDING_REVIEW" or "RECONCILIATION_REQUIRED"))
                throw new BusinessRuleException("Yêu cầu thay đổi không còn chờ Admin quyết định.");
            var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
            if (!request.Approved)
            {
                if (reason is null) throw new BusinessRuleException("Cần nêu lý do từ chối thay đổi.");
                var oldStatus = amendment.Status;
                amendment.Status = "REJECTED";
                amendment.ReviewedBy = actorId;
                amendment.ReviewedAt = DateTime.UtcNow;
                context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = amendment.ReviewedAt.Value, ChangedBy = actorId, BusinessArea = "Reconciliation", EntityName = nameof(MenuAmendment), EntityId = amendment.MenuAmendmentId, FieldName = "Status", OldValue = oldStatus, NewValue = amendment.Status, Reason = reason });
                await context.SaveChangesAsync(token);
                var rejected = ReadImpact(amendment.ImpactSnapshotJson);
                rejected.MenuAmendmentId = amendmentId;
                rejected.Status = amendment.Status;
                return rejected;
            }

            amendment.Status = "APPROVED_FOR_EXECUTION";
            amendment.ReviewedBy = actorId;
            amendment.ReviewedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(token);
            return await executeCoreAsync(amendmentId, actorUserId, null, token, true);
        }, token => context.Menuamendments.AsNoTracking().AnyAsync(item => item.MenuAmendmentId.SequenceEqual(id) && item.Status == expectedStatus, token), isolationLevel: IsolationLevel.Serializable, cancellationToken: cancellationToken);
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

    private Task<MenuAmendmentResultDto> RunMrxTransactionAsync(
        IEfTransactionRunner runner,
        Func<CancellationToken, Task<MenuAmendmentResultDto>> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        IsolationLevel isolationLevel,
        CancellationToken cancellationToken)
    {
        if (operationContext is null)
            return runner.ExecuteAsync(operation, verifySucceeded, isolationLevel, cancellationToken);
        if (string.IsNullOrWhiteSpace(operationContext.OperationKey) || operationContext.ExpectedModeVersion is null)
            throw new InvalidOperationException("MRX source change requires operation-mode version protection.");
        return runner.ExecuteProtectedAsync(
            operationContext.OperationKey, operationContext.ExpectedModeVersion.Value,
            operation, verifySucceeded, isolationLevel, cancellationToken);
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
