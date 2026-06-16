namespace IPCManagement.Api.Models.DTOs.Common;

/// <summary>Query parameters cho API có phân trang.</summary>
public class PagedRequestDto
{
    private int _pageNumber = 1;
    private int _pageSize   = 20;

    public int PageNumber
    {
        get => _pageNumber;
        set => _pageNumber = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value > 100 ? 100 : (value < 1 ? 1 : value);
    }

    public string? SearchKeyword { get; set; }
    public string? SortBy        { get; set; }
    public bool    SortDesc      { get; set; } = false;
}
