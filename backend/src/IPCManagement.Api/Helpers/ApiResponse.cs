namespace IPCManagement.Api.Helpers;

/// <summary>
/// Chuẩn hóa response trả về cho tất cả API endpoints.
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public object? Errors { get; set; }

    public static ApiResponse<T> SuccessResult(T data, string message = "Success")
        => new() { Success = true, Message = message, Data = data };

    public static ApiResponse<T> FailResult(string message, object? errors = null)
        => new() { Success = false, Message = message, Errors = errors };
}

/// <summary>
/// Non-generic wrapper cho các response không cần Data.
/// </summary>
public class ApiResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public object? Errors { get; set; }

    public static ApiResponse SuccessResult(string message = "Success")
        => new() { Success = true, Message = message };

    public static ApiResponse FailResult(string message, object? errors = null)
        => new() { Success = false, Message = message, Errors = errors };
}
