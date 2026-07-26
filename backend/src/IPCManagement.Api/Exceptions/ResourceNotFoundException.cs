namespace IPCManagement.Api.Exceptions;

/// <summary>
/// Không tìm thấy tài nguyên nghiệp vụ được yêu cầu (map HTTP 404).
/// </summary>
public class ResourceNotFoundException : Exception
{
    public ResourceNotFoundException(string message)
        : base(message)
    {
    }

    public ResourceNotFoundException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
