using System.Net;
using System.Text.Json;
using IPCManagement.Api.OpenApi;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;

namespace IPCManagement.Api.Tests;

public class ApiDocumentationStartupTests
{
    [Fact]
    public async Task Development_documentation_mapping_uses_registered_services_without_a_database()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Development" });
        builder.WebHost.UseTestServer();
        builder.Services.AddApiContractServices();
        await using var app = builder.Build();
        app.MapControllers();
        app.UseApiContractDocumentation();
        await app.StartAsync();

        var response = await app.GetTestClient().GetAsync("/openapi/v1.json");
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);
        using var document = JsonDocument.Parse(body);
        Assert.True(document.RootElement.TryGetProperty("openapi", out _));
        Assert.True(document.RootElement.GetProperty("paths").TryGetProperty("/api/Auth/login", out _));
        var legacy = await app.GetTestClient().GetStringAsync("/swagger/v1/swagger.json");
        using var legacyDocument = JsonDocument.Parse(legacy);
        Assert.Equal(document.RootElement.GetProperty("paths").GetRawText(),
            legacyDocument.RootElement.GetProperty("paths").GetRawText());
    }
}
