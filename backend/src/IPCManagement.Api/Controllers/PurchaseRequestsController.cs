using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Workflow;
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
[Route("api/purchase-requests")]
[Authorize]
public class PurchaseRequestsController : ControllerBase
{
    private readonly Data.IpcManagementContext _context;

    public PurchaseRequestsController(Data.IpcManagementContext context)
    {
        _context = context;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PurchaseRequestWorkflowResultDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPurchaseRequests([FromQuery] PurchaseRequestQueryDto query)
    {
        var status = query.Status?.Trim();
        DateOnly? dateFrom = null;
        DateOnly? dateTo = null;

        if (!string.IsNullOrWhiteSpace(query.DateFrom) && DateOnly.TryParse(query.DateFrom, out var df))
        {
            dateFrom = df;
        }
        if (!string.IsNullOrWhiteSpace(query.DateTo) && DateOnly.TryParse(query.DateTo, out var dt))
        {
            dateTo = dt;
        }

        var prQuery = _context.Purchaserequests
            .Include(r => r.Purchaserequestlines)
                .ThenInclude(l => l.Ingredient)
            .Include(r => r.Purchaserequestlines)
                .ThenInclude(l => l.Supplier)
            .Include(r => r.Purchaserequestlines)
                .ThenInclude(l => l.Unit)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statuses = status.Split(',').Select(s => s.Trim().ToUpperInvariant()).ToList();
            prQuery = prQuery.Where(r => statuses.Contains(r.Status));
        }

        if (dateFrom.HasValue)
        {
            prQuery = prQuery.Where(r => r.PurchaseForDate >= dateFrom.Value);
        }

        if (dateTo.HasValue)
        {
            prQuery = prQuery.Where(r => r.PurchaseForDate <= dateTo.Value);
        }

        var pageNumber = Math.Max(1, query.PageNumber);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var requests = await prQuery
            .OrderByDescending(r => r.PurchaseForDate)
            .ThenByDescending(r => r.PurchaseRequestCode)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = requests.Select(r => new PurchaseRequestWorkflowResultDto
        {
            PurchaseRequestId = GuidHelper.ToGuidString(r.PurchaseRequestId),
            PurchaseRequestCode = r.PurchaseRequestCode,
            MaterialRequestId = string.Empty,
            PurchaseForDate = r.PurchaseForDate.ToString("yyyy-MM-dd"),
            ShiftName = r.ShiftName,
            Status = r.Status,
            Lines = r.Purchaserequestlines.Select(l => new PurchaseRequestWorkflowLineDto
            {
                PurchaseRequestLineId = GuidHelper.ToGuidString(l.PurchaseRequestLineId),
                MaterialRequestLineId = GuidHelper.ToGuidString(l.MaterialRequestLineId),
                IngredientId = GuidHelper.ToGuidString(l.IngredientId),
                IngredientName = l.Ingredient.IngredientName,
                SupplierId = l.SupplierId is null ? null : GuidHelper.ToGuidString(l.SupplierId),
                SupplierName = l.Supplier?.SupplierName,
                UnitId = GuidHelper.ToGuidString(l.UnitId),
                UnitName = l.Unit.UnitName,
                RequiredQty = l.RequiredQty,
                CurrentStockQty = l.CurrentStockQty,
                PurchaseQty = l.PurchaseQty,
                EstimatedUnitPrice = l.EstimatedUnitPrice,
                ExpectedDeliveryDate = l.ExpectedDeliveryDate?.ToString("yyyy-MM-dd"),
                Note = l.Note
            }).ToList()
        }).ToList();

        return Ok(ApiResponse<IReadOnlyList<PurchaseRequestWorkflowResultDto>>.SuccessResult(result));
    }

    [HttpGet("page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<PurchaseRequestWorkflowResultDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPurchaseRequestsPage([FromQuery] PurchaseRequestQueryDto query)
    {
        var status = query.Status?.Trim();
        DateOnly? dateFrom = null;
        DateOnly? dateTo = null;

        if (!string.IsNullOrWhiteSpace(query.DateFrom) && DateOnly.TryParse(query.DateFrom, out var df)) dateFrom = df;
        if (!string.IsNullOrWhiteSpace(query.DateTo) && DateOnly.TryParse(query.DateTo, out var dt)) dateTo = dt;

        var prQuery = _context.Purchaserequests
            .Include(r => r.Purchaserequestlines).ThenInclude(l => l.Ingredient)
            .Include(r => r.Purchaserequestlines).ThenInclude(l => l.Supplier)
            .Include(r => r.Purchaserequestlines).ThenInclude(l => l.Unit)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statuses = status.Split(',').Select(s => s.Trim().ToUpperInvariant()).ToList();
            prQuery = prQuery.Where(r => statuses.Contains(r.Status));
        }
        if (dateFrom.HasValue) prQuery = prQuery.Where(r => r.PurchaseForDate >= dateFrom.Value);
        if (dateTo.HasValue) prQuery = prQuery.Where(r => r.PurchaseForDate <= dateTo.Value);

        var pageNumber = Math.Max(1, query.PageNumber);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var totalCount = await prQuery.CountAsync();
        var requests = await prQuery
            .OrderByDescending(r => r.PurchaseForDate)
            .ThenByDescending(r => r.PurchaseRequestCode)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = requests.Select(r => new PurchaseRequestWorkflowResultDto
        {
            PurchaseRequestId = GuidHelper.ToGuidString(r.PurchaseRequestId),
            PurchaseRequestCode = r.PurchaseRequestCode,
            MaterialRequestId = string.Empty,
            PurchaseForDate = r.PurchaseForDate.ToString("yyyy-MM-dd"),
            ShiftName = r.ShiftName,
            Status = r.Status,
            Lines = r.Purchaserequestlines.Select(l => new PurchaseRequestWorkflowLineDto
            {
                PurchaseRequestLineId = GuidHelper.ToGuidString(l.PurchaseRequestLineId),
                MaterialRequestLineId = GuidHelper.ToGuidString(l.MaterialRequestLineId),
                IngredientId = GuidHelper.ToGuidString(l.IngredientId),
                IngredientName = l.Ingredient.IngredientName,
                SupplierId = l.SupplierId is null ? null : GuidHelper.ToGuidString(l.SupplierId),
                SupplierName = l.Supplier?.SupplierName,
                UnitId = GuidHelper.ToGuidString(l.UnitId),
                UnitName = l.Unit.UnitName,
                RequiredQty = l.RequiredQty,
                CurrentStockQty = l.CurrentStockQty,
                PurchaseQty = l.PurchaseQty,
                EstimatedUnitPrice = l.EstimatedUnitPrice,
                ExpectedDeliveryDate = l.ExpectedDeliveryDate?.ToString("yyyy-MM-dd"),
                Note = l.Note
            }).ToList()
        }).ToList();

        return Ok(ApiResponse<PagedResponseDto<PurchaseRequestWorkflowResultDto>>.SuccessResult(
            PagedResponseDto<PurchaseRequestWorkflowResultDto>.Create(result, totalCount, pageNumber, pageSize)));
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<PurchaseRequestWorkflowResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPurchaseRequestById(string id)
    {
        var guid = GuidHelper.ParseGuidString(id);
        if (guid is null)
        {
            return BadRequest(ApiResponse.FailResult("Mã đề xuất không hợp lệ."));
        }

        var r = await _context.Purchaserequests
            .Include(pr => pr.Purchaserequestlines)
                .ThenInclude(l => l.Ingredient)
            .Include(pr => pr.Purchaserequestlines)
                .ThenInclude(l => l.Supplier)
            .Include(pr => pr.Purchaserequestlines)
                .ThenInclude(l => l.Unit)
            .AsNoTracking()
            .FirstOrDefaultAsync(pr => pr.PurchaseRequestId == guid);

        if (r is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy đề xuất mua hàng."));
        }

        var result = new PurchaseRequestWorkflowResultDto
        {
            PurchaseRequestId = GuidHelper.ToGuidString(r.PurchaseRequestId),
            PurchaseRequestCode = r.PurchaseRequestCode,
            MaterialRequestId = string.Empty,
            PurchaseForDate = r.PurchaseForDate.ToString("yyyy-MM-dd"),
            ShiftName = r.ShiftName,
            Status = r.Status,
            Lines = r.Purchaserequestlines.Select(l => new PurchaseRequestWorkflowLineDto
            {
                PurchaseRequestLineId = GuidHelper.ToGuidString(l.PurchaseRequestLineId),
                MaterialRequestLineId = GuidHelper.ToGuidString(l.MaterialRequestLineId),
                IngredientId = GuidHelper.ToGuidString(l.IngredientId),
                IngredientName = l.Ingredient.IngredientName,
                SupplierId = l.SupplierId is null ? null : GuidHelper.ToGuidString(l.SupplierId),
                SupplierName = l.Supplier?.SupplierName,
                UnitId = GuidHelper.ToGuidString(l.UnitId),
                UnitName = l.Unit.UnitName,
                RequiredQty = l.RequiredQty,
                CurrentStockQty = l.CurrentStockQty,
                PurchaseQty = l.PurchaseQty,
                EstimatedUnitPrice = l.EstimatedUnitPrice,
                ExpectedDeliveryDate = l.ExpectedDeliveryDate?.ToString("yyyy-MM-dd"),
                Note = l.Note
            }).ToList()
        };

        return Ok(ApiResponse<PurchaseRequestWorkflowResultDto>.SuccessResult(result));
    }
}
