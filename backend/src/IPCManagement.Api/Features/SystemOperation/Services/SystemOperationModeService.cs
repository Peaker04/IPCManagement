using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SystemOperation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SystemOperation.Services;

public sealed class SystemOperationModeService(IpcManagementContext context, SystemOperationModeGuard guard)
{
    public async Task<SystemOperationModeDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var snapshot = await guard.ReadRequiredAsync(cancellationToken);
        return new(snapshot.Mode, Label(snapshot.Mode), snapshot.Version, snapshot.UpdatedAt, await HasWorkInProgressAsync(cancellationToken));
    }

    public async Task<SystemOperationModeDto> ChangeAsync(ChangeSystemOperationModeRequest request, string actorId, CancellationToken cancellationToken = default)
    {
        if (!request.Confirmed) throw new ArgumentException("Cần xác nhận thay đổi chế độ vận hành.");
        if (!SystemOperationEligibility.IsValidMode(request.Mode)) throw new ArgumentException("Chế độ vận hành không hợp lệ.");
        var actor = GuidHelper.ParseGuidString(actorId) ?? throw new ArgumentException("Không xác định được người thực hiện.");
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        var rows = await context.Systemoperationmodes.Take(2).ToListAsync(cancellationToken);
        if (rows.Count != 1 || rows[0].Id != 1 || rows[0].Version < 1 || !SystemOperationEligibility.IsValidMode(rows[0].Mode))
            throw new SystemOperationAuthorityException("Cấu hình chế độ vận hành không hợp lệ.");
        var row = rows[0];
        if (row.Version != request.ExpectedVersion) throw new SystemOperationConflictException("Chế độ vận hành đã thay đổi. Vui lòng tải lại.");
        context.Entry(row).Property(x => x.Version).OriginalValue = request.ExpectedVersion;
        var reasonRequired = await HasWorkInProgressAsync(cancellationToken);
        if (reasonRequired && string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Cần nhập lý do vì hệ thống đang có công việc chưa hoàn tất.");
        if (row.Mode != request.Mode)
        {
            var oldMode = row.Mode;
            row.Mode = request.Mode;
            row.Version++;
            row.UpdatedAt = DateTime.UtcNow;
            row.UpdatedBy = actor;
            row.Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
            context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = row.UpdatedAt, ChangedBy = actor, BusinessArea = "SYSTEM_OPERATION", EntityName = "SystemOperationMode", FieldName = "Mode", OldValue = oldMode, NewValue = row.Mode, Reason = row.Reason });
            try
            {
                await context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new SystemOperationConflictException("Chế độ vận hành đã thay đổi. Vui lòng tải lại.");
            }
        }
        await transaction.CommitAsync(cancellationToken);
        return new(row.Mode, Label(row.Mode), row.Version, row.UpdatedAt, reasonRequired);
    }

    private Task<bool> HasWorkInProgressAsync(CancellationToken cancellationToken) =>
        context.Reconciliationbatches.AsNoTracking().AnyAsync(x => x.Status == "DRAFT" || x.Status == "READY" || x.Status == "IN_PROGRESS", cancellationToken);

    public static string Label(string mode) => mode == SystemOperationEligibility.MaterialReconciliation ? "Đối chiếu nguyên liệu" : "Mặc định";
}
