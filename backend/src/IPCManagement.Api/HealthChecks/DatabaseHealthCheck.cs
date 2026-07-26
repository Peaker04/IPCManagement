using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace IPCManagement.Api.HealthChecks;

/// <summary>
/// Readiness check: mở kết nối thật tới MySQL thay vì chỉ trả 200 như <c>MapGet("/")</c>.
/// MySQL chết thì <c>/health/ready</c> phải trả 503 để harness/loadbalancer rút API khỏi vòng phục vụ.
/// Dùng <see cref="RelationalDatabaseFacadeExtensions.CanConnectAsync"/> thay cho package
/// AddDbContextCheck để không phải thêm dependency mới.
/// </summary>
public sealed class DatabaseHealthCheck : IHealthCheck
{
    private readonly IpcManagementContext _context;
    private readonly ILogger<DatabaseHealthCheck> _logger;

    public DatabaseHealthCheck(IpcManagementContext context, ILogger<DatabaseHealthCheck> logger)
    {
        _context = context;
        _logger  = logger;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await _context.Database.CanConnectAsync(cancellationToken);

            return canConnect
                ? HealthCheckResult.Healthy("Kết nối MySQL bình thường.")
                : HealthCheckResult.Unhealthy("Không mở được kết nối tới MySQL.");
        }
        catch (Exception ex)
        {
            // Không để exception thoát ra ngoài: readiness luôn phải trả về một trạng thái.
            _logger.LogError(ex, "Readiness check thất bại khi kết nối MySQL");
            return HealthCheckResult.Unhealthy("Không mở được kết nối tới MySQL.", ex);
        }
    }
}
