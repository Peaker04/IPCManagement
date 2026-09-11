using FluentAssertions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class OperationalWarehouseInvariantTests
{
    [Fact]
    public async Task ResolveAsync_Should_Return_Original_Configured_Active_Id()
    {
        var id = Guid.NewGuid().ToByteArray();
        var warehouse = Warehouse(id);
        var (resolver, repository) = CreateResolver(id, warehouse);

        var resolved = await resolver.ResolveAsync();

        resolved.Should().BeSameAs(id);
        await repository.Received(1).GetOperationalCandidatesAsync(2);
        await repository.DidNotReceive().GetByIdAsync(Arg.Any<byte[]>());
    }

    [Fact]
    public async Task ResolveAsync_Should_Reject_Missing_Configuration_Before_Querying_Data()
    {
        var repository = Substitute.For<IWarehouseRepository>();
        var resolver = new OperationalWarehouseResolver(repository, BuildConfiguration(null));

        var act = () => resolver.ResolveAsync();

        await act.Should().ThrowAsync<OperationalWarehouseInvariantException>()
            .Where(exception => exception.Reason == OperationalWarehouseInvariantFailure.MissingConfiguration);
        await repository.DidNotReceive().GetOperationalCandidatesAsync(Arg.Any<int>());
    }

    [Fact]
    public async Task ResolveAsync_Should_Reject_Zero_Active_Warehouses()
    {
        var (resolver, repository) = CreateResolver(Guid.NewGuid().ToByteArray());

        var act = () => resolver.ResolveAsync();

        await act.Should().ThrowAsync<OperationalWarehouseInvariantException>()
            .Where(exception => exception.Reason == OperationalWarehouseInvariantFailure.ZeroActiveWarehouses);
        await repository.DidNotReceive().GetByIdAsync(Arg.Any<byte[]>());
    }

    [Fact]
    public async Task ResolveAsync_Should_Reject_Multiple_Active_Warehouses_Without_Truncating_To_A_Choice()
    {
        var configuredId = Guid.NewGuid().ToByteArray();
        var (resolver, repository) = CreateResolver(
            configuredId,
            Warehouse(configuredId),
            Warehouse(Guid.NewGuid().ToByteArray()));

        var act = () => resolver.ResolveAsync();

        await act.Should().ThrowAsync<OperationalWarehouseInvariantException>()
            .Where(exception => exception.Reason == OperationalWarehouseInvariantFailure.MultipleActiveWarehouses);
        await repository.Received(1).GetOperationalCandidatesAsync(2);
        await repository.DidNotReceive().GetByIdAsync(Arg.Any<byte[]>());
    }

    [Fact]
    public async Task ResolveAsync_Should_Distinguish_Missing_Configured_Row_From_Active_Mismatch()
    {
        var configuredId = Guid.NewGuid().ToByteArray();
        var active = Warehouse(Guid.NewGuid().ToByteArray());
        var (resolver, repository) = CreateResolver(configuredId, active);
        repository.GetByIdAsync(Arg.Is<byte[]>(id => id.SequenceEqual(configuredId)))
            .Returns((Warehouse?)null);

        var act = () => resolver.ResolveAsync();

        await act.Should().ThrowAsync<OperationalWarehouseInvariantException>()
            .Where(exception => exception.Reason == OperationalWarehouseInvariantFailure.ConfiguredWarehouseMissing);
    }

    [Fact]
    public async Task ResolveAsync_Should_Reject_When_Configured_Row_Exists_But_Is_Not_The_Active_Row()
    {
        var configuredId = Guid.NewGuid().ToByteArray();
        var configured = Warehouse(configuredId);
        var active = Warehouse(Guid.NewGuid().ToByteArray());
        var (resolver, repository) = CreateResolver(configuredId, active);
        repository.GetByIdAsync(Arg.Is<byte[]>(id => id.SequenceEqual(configuredId)))
            .Returns(configured);

        var act = () => resolver.ResolveAsync();

        await act.Should().ThrowAsync<OperationalWarehouseInvariantException>()
            .Where(exception => exception.Reason == OperationalWarehouseInvariantFailure.ConfiguredWarehouseInactiveMismatch);
    }

    private static (OperationalWarehouseResolver Resolver, IWarehouseRepository Repository) CreateResolver(
        byte[] configuredId,
        params Warehouse[] activeWarehouses)
    {
        var repository = Substitute.For<IWarehouseRepository>();
        repository.GetOperationalCandidatesAsync(2).Returns(activeWarehouses);
        var resolver = new OperationalWarehouseResolver(
            repository,
            BuildConfiguration(new Guid(configuredId).ToString()));
        return (resolver, repository);
    }

    private static IConfiguration BuildConfiguration(string? warehouseId)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["OperationalWarehouse:WarehouseId"] = warehouseId
            })
            .Build();

    private static Warehouse Warehouse(byte[] id)
        => new()
        {
            WarehouseId = id,
            WarehouseCode = "TEST",
            WarehouseName = "Test warehouse",
            WarehouseType = "MAIN"
        };
}
