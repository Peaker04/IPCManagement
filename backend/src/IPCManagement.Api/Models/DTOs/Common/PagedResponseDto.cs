namespace IPCManagement.Api.Models.DTOs.Common;

/// <summary>Generic paged response bọc danh sách kết quả và metadata phân trang.</summary>
public class PagedResponseDto<T>
{
    public IEnumerable<T> Items      { get; set; } = Enumerable.Empty<T>();
    public int            TotalCount { get; set; }
    public int            PageNumber { get; set; }
    public int            PageSize   { get; set; }
    public int            TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool           HasPrev    => PageNumber > 1;
    public bool           HasNext    => PageNumber < TotalPages;

    public static PagedResponseDto<T> Create(IEnumerable<T> items, int totalCount, int pageNumber, int pageSize)
        => new()
        {
            Items      = items,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize   = pageSize
        };
}
