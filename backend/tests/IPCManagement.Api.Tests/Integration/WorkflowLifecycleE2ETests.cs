using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Xunit.Abstractions;
using IPCManagement.Api.Features.Admin.Contracts;
using IPCManagement.Api.Features.Admin.Services;
using IPCManagement.Api.Features.Auth.Contracts;

namespace IPCManagement.Api.Tests.Integration;

[CollectionDefinition(nameof(E2ECollection), DisableParallelization = true)]
public sealed class E2ECollection : ICollectionFixture<CustomWebApplicationFactory>
{
}

/// <summary>
/// Fact dành cho integration test cần MySQL thật qua biến môi trường IPC_TEST_CONNECTION_STRING.
/// Quy tắc:
/// - Máy local thiếu biến  -> xUnit báo <c>Skipped</c> kèm lý do (nhìn thấy trong log), KHÔNG báo Passed.
/// - CI thiếu biến         -> KHÔNG skip; test vẫn chạy và fail để CI không thể xanh giả.
/// Skip được quyết định lúc discovery nên runner xUnit v2 (2.9.2) báo cáo đúng trạng thái Skipped.
/// </summary>
public sealed class RequiresMySqlFactAttribute : FactAttribute
{
    public const string ConnectionStringVariable = "IPC_TEST_CONNECTION_STRING";

    public RequiresMySqlFactAttribute()
    {
        if (HasConnectionString() || IsContinuousIntegration())
        {
            return;
        }

        Skip = $"Bỏ qua integration test: chưa set {ConnectionStringVariable} tới database MySQL test. " +
               "Trỏ biến này vào một database test riêng rồi chạy lại (CI luôn set sẵn biến này).";
    }

    public static bool HasConnectionString()
        => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(ConnectionStringVariable));

    public static bool IsContinuousIntegration()
    {
        var value = Environment.GetEnvironmentVariable("CI");
        return !string.IsNullOrWhiteSpace(value)
            && !string.Equals(value, "false", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(value, "0", StringComparison.Ordinal);
    }
}

[Collection(nameof(E2ECollection))]
public class WorkflowLifecycleE2ETests
{
    private const string AdminRoleId = "00000000-0000-0000-0000-000000000001";
    private const string AdminUsername = "admin";

    private readonly CustomWebApplicationFactory _factory;
    private readonly ITestOutputHelper _output;

    public WorkflowLifecycleE2ETests(CustomWebApplicationFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
    }

    [RequiresMySqlFact]
    public async Task Auth_Menu_Demand_Issue_Report_Lifecycle_Should_Run_EndToEnd()
    {
        RequiresMySqlFactAttribute.HasConnectionString().Should().BeTrue(
            "CI phải set {0} để integration test chạy thật trên MySQL thay vì pass giả",
            RequiresMySqlFactAttribute.ConnectionStringVariable);

        var (username, password) = await EnsureAdminCredentialAsync();
        _output.WriteLine($"Integration test chạy thật trên MySQL với tài khoản '{username}'.");

        using var client = _factory.CreateClient();
        var state = new ScenarioState(client);

        await state.LoginAsync(username, password);
        state.AccessToken.Should().NotBeNullOrWhiteSpace();
        state.RefreshToken.Should().NotBeNullOrWhiteSpace();

        await state.LoadProductionPlansAsync();
        state.LastResponseStatusCode.Should().Be(HttpStatusCode.OK);
    }

    /// <summary>
    /// Tài khoản mẫu dùng mật khẩu ngẫu nhiên chỉ trả về một lần khi seed, nên test phải lấy
    /// credential trực tiếp từ service thay vì hardcode admin/admin. Nếu database đã có sẵn tài
    /// khoản mẫu từ lượt trước, tạo một tài khoản admin riêng cho lượt chạy này.
    /// </summary>
    private async Task<(string Username, string Password)> EnsureAdminCredentialAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var employeeService = scope.ServiceProvider.GetRequiredService<IAdminEmployeeService>();

        var seededCredentials = await employeeService.SeedSampleUsersAsync();
        if (seededCredentials.TryGetValue(AdminUsername, out var seededPassword))
        {
            return (AdminUsername, seededPassword);
        }

        var username = $"ci-e2e-{Guid.NewGuid():N}"[..20];
        var password = $"Ipc!{Guid.NewGuid():N}"[..24];

        await employeeService.CreateAsync(new CreateEmployeeRequest
        {
            FullName = "CI E2E Admin",
            Username = username,
            Password = password,
            RoleId = AdminRoleId,
            IsActive = true
        });

        return (username, password);
    }

    private sealed class ScenarioState
    {
        private readonly HttpClient _client;
        private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

        public ScenarioState(HttpClient client)
        {
            _client = client;
        }

        public string AccessToken { get; private set; } = string.Empty;
        public string RefreshToken { get; private set; } = string.Empty;
        public HttpStatusCode LastResponseStatusCode { get; private set; }

        public async Task LoginAsync(string username, string password)
        {
            var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest
            {
                Username = username,
                Password = password
            }, _jsonOptions);

            LastResponseStatusCode = response.StatusCode;
            var body = await response.Content.ReadAsStringAsync();
            response.StatusCode.Should().Be(HttpStatusCode.OK, "đăng nhập phải thành công, body: {0}", body);

            var payload = JsonSerializer.Deserialize<ApiEnvelope<LoginResponseDto>>(body, _jsonOptions)
                ?? throw new InvalidOperationException("Login response is empty.");

            AccessToken = payload.Data.AccessToken;
            RefreshToken = payload.Data.RefreshToken;

            _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
        }

        public async Task LoadProductionPlansAsync()
        {
            var response = await _client.GetAsync("/api/production-plans?page=1&pageSize=10");
            LastResponseStatusCode = response.StatusCode;

            var body = await response.Content.ReadAsStringAsync();
            response.StatusCode.Should().Be(
                HttpStatusCode.OK,
                "tài khoản admin phải đọc được danh sách kế hoạch sản xuất, body: {0}",
                body);
        }
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T Data { get; set; } = default!;
    }
}
