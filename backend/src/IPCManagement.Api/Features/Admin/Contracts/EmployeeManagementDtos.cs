namespace IPCManagement.Api.Features.Admin.Contracts;

public class EmployeeDto
{
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string RoleId { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminRoleDto
{
    public string RoleId { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
}

public class CreateEmployeeRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string RoleId { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class UpdateEmployeeRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? Password { get; set; }
    public string RoleId { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class UpdateEmployeeStatusRequest
{
    public bool IsActive { get; set; }
}
