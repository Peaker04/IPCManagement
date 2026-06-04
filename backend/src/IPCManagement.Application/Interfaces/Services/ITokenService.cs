namespace IPCManagement.Application.Interfaces.Services;

public interface ITokenService
{
    string GenerateToken(string userId, string username, string fullName, string roleName);
    int GetExpirySeconds();
}
