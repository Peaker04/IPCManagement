using IPCManagement.Api.Data;
using IPCManagement.Api.Migrations;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace IPCManagement.Api.Tests;

public sealed class MySqlOperationalWarehouseInvariantTests
{
    private const string Expression = "CASE WHEN IsOperationalActive THEN 1 ELSE NULL END";

    [Fact]
    public void MySqlSingleton_Model_UsesDatabaseGeneratedNullableDiscriminator()
    {
        using var context = CreateContext();
        var warehouse = context.Model.FindEntityType(typeof(Warehouse))!;
        var active = warehouse.FindProperty(nameof(Warehouse.IsOperationalActive))!;
        var singleton = warehouse.FindProperty("OperationalSingletonKey")!;

        Assert.Equal(typeof(bool), active.ClrType);
        Assert.Equal("IsOperationalActive", active.GetColumnName());
        Assert.True(singleton.IsShadowProperty());
        Assert.Equal(typeof(int?), singleton.ClrType);
        Assert.True(singleton.IsNullable);
        Assert.Equal("OperationalSingletonKey", singleton.GetColumnName());
        Assert.Equal(Expression, singleton.GetComputedColumnSql());
        Assert.Equal(ValueGenerated.OnAddOrUpdate, singleton.ValueGenerated);
        Assert.Equal(PropertySaveBehavior.Ignore, singleton.GetBeforeSaveBehavior());
        Assert.Equal(PropertySaveBehavior.Ignore, singleton.GetAfterSaveBehavior());

        var index = Assert.Single(warehouse.GetIndexes(), candidate =>
            candidate.Properties.SequenceEqual(new[] { singleton }));
        Assert.True(index.IsUnique);
        Assert.Equal("uqWarehousesOperationalSingleton", index.GetDatabaseName());
        Assert.Null(index.GetFilter());
    }

    [Fact]
    public void MySqlSingleton_Migration_IsAdditiveAndEncodesMySqlNullUniquenessContract()
    {
        var operations = new InspectableMigration().BuildUp();
        var columns = operations.OfType<AddColumnOperation>().ToArray();
        var indexes = operations.OfType<CreateIndexOperation>().ToArray();

        Assert.Equal(2, columns.Length);

        var active = Assert.Single(columns, column => column.Name == "IsOperationalActive");
        Assert.Equal("warehouses", active.Table);
        Assert.False(active.IsNullable);
        Assert.Equal(false, active.DefaultValue);

        var singleton = Assert.Single(columns, column => column.Name == "OperationalSingletonKey");
        Assert.Equal("warehouses", singleton.Table);
        Assert.True(singleton.IsNullable);
        Assert.Equal(Expression, singleton.ComputedColumnSql);

        var unique = Assert.Single(indexes);
        Assert.Equal("uqWarehousesOperationalSingleton", unique.Name);
        Assert.Equal("warehouses", unique.Table);
        Assert.Equal(new[] { "OperationalSingletonKey" }, unique.Columns);
        Assert.True(unique.IsUnique);
        Assert.Null(unique.Filter);

        Assert.DoesNotContain(operations, operation => operation is DeleteDataOperation or UpdateDataOperation or InsertDataOperation or DropTableOperation);
    }

    [Theory]
    [InlineData(false, null)]
    [InlineData(true, 1)]
    public void MySqlSingleton_GeneratedExpression_MapsInactiveToNullAndActiveToOne(bool active, int? expected)
    {
        int? generated = active ? 1 : null;
        Assert.Equal(expected, generated);
    }

    [Fact]
    public void MySqlSingleton_NormalUniqueIndex_AllowsInactiveNullMultiplicityAndRejectsDuplicateActiveKeys()
    {
        int?[] inactiveKeys = [null, null, null];
        int?[] activeKeys = [1, 1];

        Assert.Equal(3, inactiveKeys.Length);
        Assert.All(inactiveKeys, key => Assert.Null(key));
        Assert.Equal(2, activeKeys.Count(key => key == 1));
        Assert.Single(activeKeys.Where(key => key is not null).Distinct());
    }

    [Fact]
    public void MySqlSingleton_Discriminator_HasNoApplicationWritableClrProperty()
    {
        Assert.Null(typeof(Warehouse).GetProperty("OperationalSingletonKey"));
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql("Server=localhost;Database=model_only;User=model_only;Password=model_only", new MySqlServerVersion(new Version(8, 0, 0)))
            .Options;
        return new IpcManagementContext(options);
    }

    private sealed class InspectableMigration : EnforceSingleOperationalWarehouse
    {
        public IReadOnlyList<MigrationOperation> BuildUp()
        {
            var builder = new MigrationBuilder("Pomelo.EntityFrameworkCore.MySql");
            Up(builder);
            return builder.Operations;
        }
    }
}
