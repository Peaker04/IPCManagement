using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Inventory.Contracts;

namespace IPCManagement.Api.Data.Repositories;

public class InventoryIssueRepository : GenericRepository<InventoryIssue>, IInventoryIssueRepository
{
    public InventoryIssueRepository(IpcManagementContext context) : base(context)
    {
    }

    public async Task<(IEnumerable<InventoryIssue> Items, int TotalCount)> GetPagedAsync(
        InventoryIssueFilterRequestDto request)
    {
        var (pageNumber, pageSize) = NormalizePaging(request.PageNumber, request.PageSize);

        var query = _context.Inventoryissues
            .AsNoTracking()
            .Include(issue => issue.Warehouse)
            .Include(issue => issue.IssuedByNavigation)
            .Include(issue => issue.ReceivedByNavigation)
            .Include(issue => issue.Inventoryissuelines)
            .AsQueryable();

        query = ApplyExactSourceFamily(query, request.SourceFamily);

        if (!string.IsNullOrWhiteSpace(request.ReconciliationBatchId))
        {
            if (!string.Equals(request.SourceFamily, InventoryIssueSourceFamilies.MaterialReconciliation, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("ReconciliationBatchId chỉ hợp lệ với sourceFamily MATERIAL_RECONCILIATION.");
            var batchId = GuidHelper.ParseGuidString(request.ReconciliationBatchId)
                ?? throw new ArgumentException("ReconciliationBatchId không hợp lệ.");
            query = query.Where(issue => issue.ReconciliationBatchId == batchId);
        }

        if (!string.IsNullOrWhiteSpace(request.WarehouseId))
        {
            var warehouseBytes = GuidHelper.ParseGuidString(request.WarehouseId)
                ?? throw new ArgumentException("WarehouseId không hợp lệ.");
            query = query.Where(i => i.WarehouseId == warehouseBytes);
        }

        if (request.IssueDate.HasValue)
        {
            query = query.Where(i => i.IssueDate == request.IssueDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.ShiftName))
        {
            query = query.Where(i => i.ShiftName == request.ShiftName);
        }

        if (request.IsReceived.HasValue)
        {
            if (request.IsReceived.Value)
            {
                query = query.Where(i => i.ReceivedAt != null);
            }
            else
            {
                query = query.Where(i => i.ReceivedAt == null);
            }
        }

        query = query.OrderByDescending(issue => issue.CreatedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<InventoryIssue?> GetByIdWithLinesAsync(
        byte[] id,
        string? sourceFamily = null)
    {
        var query = _context.Inventoryissues
            .AsNoTracking()
            .Include(issue => issue.Warehouse)
            .Include(issue => issue.IssuedByNavigation)
            .Include(issue => issue.ReceivedByNavigation)
            .Include(issue => issue.Inventoryissuelines)
                .ThenInclude(line => line.Ingredient)
            .Include(issue => issue.Inventoryissuelines)
                .ThenInclude(line => line.Unit)
            .AsQueryable();
        if (!string.IsNullOrWhiteSpace(sourceFamily))
            query = ApplyExactSourceFamily(query, sourceFamily);
        return await query.FirstOrDefaultAsync(issue => issue.IssueId == id);
    }

    private static IQueryable<InventoryIssue> ApplyExactSourceFamily(
        IQueryable<InventoryIssue> query,
        string sourceFamily)
    {
        if (string.Equals(sourceFamily, InventoryIssueSourceFamilies.Default, StringComparison.OrdinalIgnoreCase))
        {
            return query.Where(issue =>
                issue.MaterialRequestId != null &&
                issue.ReconciliationBatchId == null &&
                issue.Inventoryissuelines.Any() &&
                issue.Inventoryissuelines.All(line =>
                    line.MaterialRequestLineId != null &&
                    line.ReconciliationBatchLineId == null));
        }

        if (string.Equals(sourceFamily, InventoryIssueSourceFamilies.MaterialReconciliation, StringComparison.OrdinalIgnoreCase))
        {
            return query.Where(issue =>
                issue.MaterialRequestId == null &&
                issue.ReconciliationBatchId != null &&
                issue.Inventoryissuelines.Any() &&
                issue.Inventoryissuelines.All(line =>
                    line.MaterialRequestLineId == null &&
                    line.ReconciliationBatchLineId != null));
        }

        if (string.Equals(sourceFamily, InventoryIssueSourceFamilies.LegacyUnclassified, StringComparison.OrdinalIgnoreCase))
        {
            return query.Where(issue => !(
                issue.MaterialRequestId != null &&
                issue.ReconciliationBatchId == null &&
                issue.Inventoryissuelines.Any() &&
                issue.Inventoryissuelines.All(line => line.MaterialRequestLineId != null && line.ReconciliationBatchLineId == null)) && !(
                issue.MaterialRequestId == null &&
                issue.ReconciliationBatchId != null &&
                issue.Inventoryissuelines.Any() &&
                issue.Inventoryissuelines.All(line => line.MaterialRequestLineId == null && line.ReconciliationBatchLineId != null)));
        }

        throw new ArgumentException("sourceFamily phải là DEFAULT, MATERIAL_RECONCILIATION hoặc LEGACY_UNCLASSIFIED.");
    }

    public async Task<MaterialRequest?> GetMaterialRequestForIssueAsync(byte[] id)
        => await _context.Materialrequests
            .Include(request => request.Materialrequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(request => request.Materialrequestlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(request => request.RequestId == id);

    public async Task<IReadOnlyList<InventoryIssueLine>> GetIssuedLinesForMaterialRequestAsync(byte[] materialRequestId)
        => await _context.Inventoryissuelines
            .AsNoTracking()
            .Include(line => line.Issue)
            .Where(line => line.Issue.MaterialRequestId == materialRequestId)
            .ToListAsync();
}
