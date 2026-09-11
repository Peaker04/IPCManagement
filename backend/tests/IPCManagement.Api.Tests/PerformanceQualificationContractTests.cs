using FluentAssertions;

namespace IPCManagement.Api.Tests;

public class PerformanceQualificationContractTests
{
    [Fact]
    public void Read_only_probe_should_fail_on_dropped_work_and_disclaim_full_D04_qualification()
    {
        var root = FindRepositoryRoot();
        var script = File.ReadAllText(Path.Combine(root, "tools", "perf", "k6", "read-only-throughput-probe.js"));
        var runbook = File.ReadAllText(Path.Combine(root, "tools", "perf", "RUNBOOK.md"));

        script.Should().Contain("rate: 10")
            .And.Contain("duration: '15m'")
            .And.Contain("rate: 30")
            .And.Contain("duration: '60s'")
            .And.Contain("preAllocatedVUs: 20")
            .And.Contain("maxVUs: 50")
            .And.Contain("dropped_iterations: ['count==0']")
            .And.Contain("K6_RUN_ID is required")
            .And.Contain("results-readonly-${__ENV.K6_RUN_ID}.json")
            .And.Contain("does not certify authenticated-user count");
        runbook.Should().Contain("chưa phải D04 qualification")
            .And.Contain("Không** dùng probe này để claim 50 authenticated users");
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
        {
            directory = directory.Parent;
        }
        return directory?.FullName ?? throw new InvalidOperationException("Workspace root not found.");
    }
}
