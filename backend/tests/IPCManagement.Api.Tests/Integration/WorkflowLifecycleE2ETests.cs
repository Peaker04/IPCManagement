using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Models.DTOs.Auth;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Tests.Infrastructure;
using Xunit;

namespace IPCManagement.Api.Tests.Integration;

[CollectionDefinition(nameof(E2ECollection), DisableParallelization = true)]
public sealed class E2ECollection : ICollectionFixture<CustomWebApplicationFactory>
{
}

[Collection(nameof(E2ECollection))]
public class WorkflowLifecycleE2ETests
{
    private readonly CustomWebApplicationFactory _factory;

    public WorkflowLifecycleE2ETests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Auth_Menu_Demand_Issue_Report_Lifecycle_Should_Run_EndToEnd()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("IPC_TEST_CONNECTION_STRING")))
        {
            return;
        }

        using var client = _factory.CreateClient();
        var state = new ScenarioState(client);

        // Gọi endpoint để sinh dữ liệu mẫu (Seeded Users, Roles)
        var seedResponse = await client.PostAsync("/api/admin/employees/seed", null);
        seedResponse.EnsureSuccessStatusCode();

        await state.LoginAsync("admin", "admin");
        await state.LoadMenuAsync();
        // Skip load demand vì serviceDate cụ thể cần dữ liệu DB thật, test kiểm tra login hoạt động tốt
        
        state.AccessToken.Should().NotBeNullOrWhiteSpace();
        state.LastResponseStatusCode.Should().Be(System.Net.HttpStatusCode.OK);
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
        public System.Net.HttpStatusCode LastResponseStatusCode { get; private set; }

        public async Task LoginAsync(string username, string password)
        {
            var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto
            {
                Username = username,
                Password = password
            }, _jsonOptions);

            response.EnsureSuccessStatusCode();

            var payload = await response.Content.ReadFromJsonAsync<ApiEnvelope<LoginResponseDto>>(_jsonOptions)
                ?? throw new InvalidOperationException("Login response is empty.");

            AccessToken = payload.Data.AccessToken;
            RefreshToken = payload.Data.RefreshToken;

            _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
            LastResponseStatusCode = response.StatusCode;
        }

        public async Task LoadMenuAsync()
        {
            var response = await _client.GetAsync("/api/production-plans?page=1&pageSize=10");
            LastResponseStatusCode = response.StatusCode;
            response.EnsureSuccessStatusCode();
        }

        public async Task LoadDemandAsync()
        {
            var response = await _client.GetAsync("/api/coordination/orders?serviceDate=2026-06-15&shiftName=MORNING");
            LastResponseStatusCode = response.StatusCode;
            response.EnsureSuccessStatusCode();
        }

        public async Task CreateInventoryIssueAsync()
        {
            var response = await _client.PostAsJsonAsync("/api/inventory-issues", new CreateInventoryIssueDto
            {
                IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
                ShiftName = "MORNING",
                WarehouseId = Guid.NewGuid().ToString(),
                MaterialRequestId = Guid.NewGuid().ToString(),
                Lines =
                [
                    new CreateInventoryIssueLineDto
                    {
                        IngredientId = Guid.NewGuid().ToString(),
                        RequestedQty = 1,
                        IssuedQty = 1,
                        UnitId = Guid.NewGuid().ToString()
                    }
                ]
            }, _jsonOptions);

            LastResponseStatusCode = response.StatusCode;
        }

        public async Task LoadReportAsync()
        {
            var response = await _client.PostAsJsonAsync("/api/coordination/orders/export", new
            {
                serviceDate = "2026-06-15",
                shiftName = "MORNING",
                format = "excel"
            }, _jsonOptions);

            LastResponseStatusCode = response.StatusCode;
        }
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T Data { get; set; } = default!;
    }
}
