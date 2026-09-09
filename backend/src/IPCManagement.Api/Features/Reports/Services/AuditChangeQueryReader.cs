using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

internal sealed class AuditChangeQueryReader
{
    private readonly IpcManagementContext _context;

    internal AuditChangeQueryReader(IpcManagementContext context)
    {
        _context = context;
    }

    internal async Task<List<AuditChangeReportDto>> ReadInitialSourcesAsync(
        DateTime? dateFrom,
        DateTime? dateToExclusive,
        DateTime? cursorDate,
        bool ascending,
        int sourceLimit,
        string? actorFilter,
        string? businessAreaFilter,
        string? entityNameFilter,
        string? fieldNameFilter)
    {
        var changes = _context.Auditlogs
            .AsNoTracking()
            .Include(item => item.ChangedByNavigation)
            .AsQueryable();

        if (dateFrom is not null)
        {
            changes = changes.Where(item => item.ChangedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            changes = changes.Where(item => item.ChangedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            changes = ascending
                ? changes.Where(item => item.ChangedAt > cursorDate)
                : changes.Where(item => item.ChangedAt < cursorDate);
        }

        if (actorFilter is not null)
        {
            changes = changes.Where(item => item.ChangedByNavigation.FullName.Contains(actorFilter) || item.ChangedByNavigation.Username.Contains(actorFilter));
        }

        if (businessAreaFilter is not null)
        {
            changes = changes.Where(item =>
                (item.EntityName == nameof(MealQuantityPlan) &&
                 item.FieldName == nameof(MealQuantityPlan.Status) &&
                 item.NewValue == "COMPLETED"
                    ? "Signoff"
                    : item.BusinessArea).Contains(businessAreaFilter));
        }

        if (entityNameFilter is not null)
        {
            changes = changes.Where(item => item.EntityName != null && item.EntityName.Contains(entityNameFilter));
        }

        if (fieldNameFilter is not null)
        {
            changes = changes.Where(item => item.FieldName != null && item.FieldName.Contains(fieldNameFilter));
        }

        var orderedChanges = ascending
            ? changes.OrderBy(item => item.ChangedAt).ThenBy(item => item.AuditId)
            : changes.OrderByDescending(item => item.ChangedAt).ThenByDescending(item => item.AuditId);

        var auditRows = await orderedChanges
            .Take(sourceLimit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.AuditId),
                ChangedAt = item.ChangedAt,
                ChangedBy = GuidHelper.ToGuidString(item.ChangedBy),
                ChangedByName = item.ChangedByNavigation.FullName ?? item.ChangedByNavigation.Username ?? "System",
                BusinessArea = item.EntityName == nameof(MealQuantityPlan)
                    && item.FieldName == nameof(MealQuantityPlan.Status)
                    && item.NewValue == "COMPLETED"
                        ? "Signoff"
                        : item.BusinessArea,
                EntityName = item.EntityName,
                EntityId = item.EntityId == null ? null : GuidHelper.ToGuidString(item.EntityId),
                FieldName = item.FieldName,
                OldValue = item.OldValue,
                NewValue = item.NewValue,
                Reason = item.Reason,
                CorrelationId = item.CorrelationId
            })
            .ToListAsync();

        var importBatches = _context.Quantityimportbatches
            .AsNoTracking()
            .Include(item => item.ImportedByNavigation)
            .Include(item => item.Mealquantityplans)
            .AsQueryable();

        if (dateFrom is not null)
        {
            importBatches = importBatches.Where(item => item.ImportedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            importBatches = importBatches.Where(item => item.ImportedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            importBatches = ascending
                ? importBatches.Where(item => item.ImportedAt > cursorDate)
                : importBatches.Where(item => item.ImportedAt < cursorDate);
        }

        if (actorFilter is not null)
        {
            var matchesImporterFallback = SourceMatchesConstant("Sample Data Importer", actorFilter);
            importBatches = importBatches.Where(item =>
                (item.ImportedByNavigation != null &&
                 (item.ImportedByNavigation.FullName.Contains(actorFilter) || item.ImportedByNavigation.Username.Contains(actorFilter))) ||
                (item.ImportedBy == null && matchesImporterFallback));
        }
        if (!SourceMatchesConstant("Import", businessAreaFilter) || !SourceMatchesConstant(nameof(QuantityImportBatch), entityNameFilter))
        {
            importBatches = importBatches.Where(_ => false);
        }
        if (fieldNameFilter is not null)
        {
            importBatches = importBatches.Where(item => item.SourceType.Contains(fieldNameFilter));
        }

        var orderedImportBatches = ascending
            ? importBatches.OrderBy(item => item.ImportedAt).ThenBy(item => item.ImportBatchId)
            : importBatches.OrderByDescending(item => item.ImportedAt).ThenByDescending(item => item.ImportBatchId);

        var importRows = await orderedImportBatches
            .Take(sourceLimit)
            .Select(item => new AuditChangeReportDto
            {
                AuditId = GuidHelper.ToGuidString(item.ImportBatchId),
                ChangedAt = item.ImportedAt,
                ChangedBy = item.ImportedBy == null ? string.Empty : GuidHelper.ToGuidString(item.ImportedBy),
                ChangedByName = item.ImportedByNavigation == null
                    ? "Sample Data Importer"
                    : item.ImportedByNavigation.FullName ?? item.ImportedByNavigation.Username ?? "Sample Data Importer",
                BusinessArea = "Import",
                EntityName = nameof(QuantityImportBatch),
                EntityId = GuidHelper.ToGuidString(item.ImportBatchId),
                FieldName = item.SourceType,
                OldValue = null,
                NewValue = $"{item.BatchCode} - {item.Status}; {item.Mealquantityplans.Count} plans",
                Reason = item.SourceCompanyName
            })
            .ToListAsync();

        var menuImports = _context.Menuversions
            .AsNoTracking()
            .AsQueryable();

        if (dateFrom is not null)
        {
            menuImports = menuImports.Where(item => item.CreatedAt >= dateFrom);
        }

        if (dateToExclusive is not null)
        {
            menuImports = menuImports.Where(item => item.CreatedAt < dateToExclusive);
        }

        if (cursorDate is not null)
        {
            menuImports = ascending
                ? menuImports.Where(item => item.CreatedAt > cursorDate)
                : menuImports.Where(item => item.CreatedAt < cursorDate);
        }

        if (!SourceMatchesConstant("Import", businessAreaFilter) ||
            !SourceMatchesConstant(nameof(MenuVersion), entityNameFilter) ||
            !SourceMatchesConstant("WeeklyMenu", fieldNameFilter))
        {
            menuImports = menuImports.Where(_ => false);
        }
        if (actorFilter is not null)
        {
            var matchesImporterFallback = SourceMatchesConstant("Sample Data Importer", actorFilter);
            menuImports = menuImports.Where(item =>
                (item.CreatedBy == null && matchesImporterFallback) ||
                (item.CreatedBy != null && _context.Users.Any(user =>
                    user.UserId == item.CreatedBy && (user.FullName.Contains(actorFilter) || user.Username.Contains(actorFilter)))));
        }

        var orderedMenuImports = ascending
            ? menuImports.OrderBy(item => item.CreatedAt).ThenBy(item => item.MenuVersionId)
            : menuImports.OrderByDescending(item => item.CreatedAt).ThenByDescending(item => item.MenuVersionId);

        var menuImportVersions = await orderedMenuImports
            .Take(sourceLimit)
            .ToListAsync();
        var menuImportActorKeys = menuImportVersions
            .Where(item => item.CreatedBy is not null)
            .Select(item => item.CreatedBy!)
            .ToList();
        var menuImportActors = (await _context.Users
                .AsNoTracking()
                .Where(user => menuImportActorKeys.Contains(user.UserId))
                .ToListAsync())
            .ToDictionary(user => GuidHelper.ToGuidString(user.UserId), user => user.FullName, StringComparer.OrdinalIgnoreCase);
        var menuImportRows = menuImportVersions
            .Select(item =>
            {
                var actorId = item.CreatedBy is null ? string.Empty : GuidHelper.ToGuidString(item.CreatedBy);
                return new AuditChangeReportDto
                {
                    AuditId = GuidHelper.ToGuidString(item.MenuVersionId),
                    ChangedAt = item.CreatedAt,
                    ChangedBy = actorId,
                    ChangedByName = !string.IsNullOrWhiteSpace(actorId) && menuImportActors.TryGetValue(actorId, out var actorName)
                        ? actorName
                        : "Sample Data Importer",
                    BusinessArea = "Import",
                    EntityName = nameof(MenuVersion),
                    EntityId = GuidHelper.ToGuidString(item.MenuVersionId),
                    FieldName = "WeeklyMenu",
                    OldValue = item.SourceFileName,
                    NewValue = $"{item.SourceImportBatch ?? $"V{item.VersionNo}"} - {item.Status}",
                    Reason = item.SourceChecksum
                };
            })
            .ToList();

        return auditRows
            .Concat(importRows)
            .Concat(menuImportRows)
            .ToList();
    }

    private static bool SourceMatchesConstant(string value, string? filter)
        => filter is null || value.Contains(filter, StringComparison.OrdinalIgnoreCase);
}
