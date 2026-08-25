using Xunit;
namespace IPCManagement.Api.Tests;
public sealed class Phase29MigrationTests
{
    [Fact]
    public void Migration_is_schema_only_and_has_no_database_lane_commands()
    {
        var root = FindRoot(); var file = Directory.GetFiles(Path.Combine(root,"backend","src","IPCManagement.Api","Migrations"),"*AddSystemOperationModeAndReconciliation.cs").Single(); var sql=File.ReadAllText(file);
        Assert.DoesNotContain("USE ",sql,StringComparison.OrdinalIgnoreCase); Assert.DoesNotContain("CreateDatabase",sql); Assert.DoesNotContain("DropDatabase",sql); Assert.Contains("systemoperationmodes",sql); Assert.Contains("reconciliationbatches",sql);
    }
    private static string FindRoot(){var d=new DirectoryInfo(AppContext.BaseDirectory);while(d!=null&&!Directory.Exists(Path.Combine(d.FullName,".git")))d=d.Parent;return d?.FullName??throw new DirectoryNotFoundException();}
}
