using System.Text.Json;
using IPCManagement.Api.Helpers;
using IPCManagement.DatabaseTool;

namespace IPCManagement.Api.Tests;

public class PreparationGroupReviewCommandTests
{
    [Theory]
    [InlineData("ipcmanagement")]
    [InlineData("ipc_mrx_evidence_20261115t115657z_d90206")]
    public void Snapshot_explicitly_accepts_source_and_canonical_evidence_clone(string database)
        => PreparationGroupReviewCommand.ValidateSnapshotTarget(database);

    [Theory]
    [InlineData("mysql")]
    [InlineData("ipc_production")]
    [InlineData("ipcmanagement`;")]
    [InlineData("ipc_mrx_evidence_bad")]
    public void Snapshot_rejects_unrelated_database(string database)
        => Assert.Throws<ArgumentException>(() => PreparationGroupReviewCommand.ValidateSnapshotTarget(database));

    [Fact]
    public void Fingerprint_is_stable_and_changes_when_a_canonical_identity_changes()
    {
        using var first = JsonDocument.Parse("{\"ingredients\":[{\"ingredientIdHex\":\"A\",\"unitCode\":\"KG\"}]}");
        using var same = JsonDocument.Parse("{\"ingredients\":[{\"ingredientIdHex\":\"A\",\"unitCode\":\"KG\"}]}");
        using var changed = JsonDocument.Parse("{\"ingredients\":[{\"ingredientIdHex\":\"B\",\"unitCode\":\"KG\"}]}");
        Assert.Equal(PreparationGroupReviewCommand.Fingerprint(first.RootElement), PreparationGroupReviewCommand.Fingerprint(same.RootElement));
        Assert.NotEqual(PreparationGroupReviewCommand.Fingerprint(first.RootElement), PreparationGroupReviewCommand.Fingerprint(changed.RootElement));
    }

    [Fact]
    public void Maintenance_group_codes_match_canonical_owner()
        => Assert.Equal(PreparationSupplyGroups.Labels.Keys.Order(), PreparationGroupReviewCommand.AllowedGroups.Order());

    [Fact]
    public void Fingerprint_ignores_json_whitespace_and_property_order()
    {
        using var a = JsonDocument.Parse("{\"b\":2,\"a\":1}");
        using var b = JsonDocument.Parse("{ \"a\": 1, \"b\": 2 }");
        Assert.Equal(PreparationGroupReviewCommand.Fingerprint(a.RootElement), PreparationGroupReviewCommand.Fingerprint(b.RootElement));
    }
}
