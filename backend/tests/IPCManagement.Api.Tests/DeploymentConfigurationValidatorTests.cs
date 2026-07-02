using FluentAssertions;
using IPCManagement.Api.Helpers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace IPCManagement.Api.Tests;

public class DeploymentConfigurationValidatorTests
{
    [Fact]
    public void Validate_Should_SkipDevelopmentConfiguration()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "server=localhost;database=ipcmanagement;user=root;password=123456789;",
            ["JwtSettings:SecretKey"] = "SJ0sKATrwiXa!8lfV7ygOW$bqYMLPRnE4xc2GIe@#t3uFDvm",
            ["Cors:AllowedOrigins:0"] = "http://localhost:5173",
            ["AllowedHosts"] = "*"
        });

        var act = () => DeploymentConfigurationValidator.Validate(configuration, new TestEnvironment("Development"));

        act.Should().NotThrow();
    }

    [Fact]
    public void Validate_Should_RejectPlaceholderProductionConfiguration()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "server=localhost;database=ipcmanagement;user=root;password=123456789;",
            ["JwtSettings:SecretKey"] = "GENERATE_A_STRONG_SECRET_KEY_AT_LEAST_32_CHARS_LONG",
            ["Cors:AllowedOrigins:0"] = "http://localhost:5173",
            ["AllowedHosts"] = "*"
        });

        var act = () => DeploymentConfigurationValidator.Validate(configuration, new TestEnvironment("Production"));

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*DefaultConnection*SecretKey*AllowedOrigins*AllowedHosts*");
    }

    [Fact]
    public void Validate_Should_AcceptProductionConfiguration()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "server=db.internal;database=ipcmanagement;user=ipc_app;password=strong-password;",
            ["JwtSettings:SecretKey"] = "production-secret-key-with-at-least-32-characters",
            ["Cors:AllowedOrigins:0"] = "https://ipc.example.com",
            ["AllowedHosts"] = "api.ipc.example.com"
        });

        var act = () => DeploymentConfigurationValidator.Validate(configuration, new TestEnvironment("Production"));

        act.Should().NotThrow();
    }

    private static IConfiguration BuildConfiguration(Dictionary<string, string?> values)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();

    private sealed class TestEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;

        public string ApplicationName { get; set; } = "IPCManagement.Api.Tests";

        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
