using FluentAssertions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using NSubstitute;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class IngredientIdentityTests
{
    [Theory]
    [InlineData("RICE")]
    [InlineData("NOODLES")]
    [InlineData("EGGS")]
    [InlineData("DAIRY")]
    [InlineData("BAKERY")]
    [InlineData("BEVERAGES")]
    [InlineData("PACKAGING")]
    [InlineData("ICE")]
    public async Task Create_preserves_separate_preparation_groups(string group)
    {
        var repo = Substitute.For<IIngredientRepository>();
        repo.GetActiveByUnitAsync(Arg.Any<byte[]>()).Returns([]);
        var warehouse = Substitute.For<IOperationalWarehouseResolver>();
        warehouse.ResolveAsync(Arg.Any<CancellationToken>()).Returns(GuidHelper.NewId());
        await using var context = NewContext();
        var service = new IngredientService(repo, warehouse, context, new EfTransactionRunner(context));
        var created = await service.CreateAsync(new CreateIngredientRequest
            { IngredientName = "Nguyên liệu thử", UnitId = GuidHelper.ToGuidString(GuidHelper.NewId()), PreparationGroupCode = group });
        Assert.Equal(group, created.PreparationGroupCode);
        await repo.Received(1).AddAsync(Arg.Is<Ingredient>(i => i.PreparationGroupCode == group));
    }

    [Fact]
    public async Task Invalid_supply_group_is_rejected_before_any_catalog_write()
    {
        var repo = Substitute.For<IIngredientRepository>();
        var warehouse = Substitute.For<IOperationalWarehouseResolver>();
        await using var context = NewContext();
        var service = new IngredientService(repo, warehouse, context, new EfTransactionRunner(context));
        await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateAsync(new() { PreparationGroupCode = "guessed from name" }));
        await Assert.ThrowsAsync<BusinessRuleException>(() => service.UpdateAsync(Guid.NewGuid().ToString(), new() { PreparationGroupCode = "FISH" }));
        await repo.DidNotReceive().AddAsync(Arg.Any<Ingredient>());
        await repo.DidNotReceive().UpdateAsync(Arg.Any<Ingredient>());
    }
    [Fact]
    public async Task CreateAsync_AllocatesCodeWhenCallerDoesNotSupplyOne()
    {
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var repo = Substitute.For<IIngredientRepository>();
        repo.GetActiveByUnitAsync(Arg.Any<byte[]>()).Returns([]);
        var warehouse = Substitute.For<IOperationalWarehouseResolver>();
        warehouse.ResolveAsync(Arg.Any<CancellationToken>()).Returns(warehouseId);
        await using var context = NewContext();
        var service = new IngredientService(repo, warehouse, context, new EfTransactionRunner(context));

        var created = await service.CreateAsync(new CreateIngredientRequest
        {
            IngredientName = "Rau răm", UnitId = GuidHelper.ToGuidString(unitId)
        });

        created.IngredientCode.Should().StartWith("ING-");
        created.IngredientCode.Should().HaveLength(20);
        await repo.Received(1).AddAsync(Arg.Is<Ingredient>(item => item.IngredientCode == created.IngredientCode));
        new IPCManagement.Api.Features.Catalog.Validators.CreateIngredientDtoValidator()
            .Validate(new CreateIngredientRequest { IngredientName = "Rau răm", UnitId = GuidHelper.ToGuidString(unitId) })
            .IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectCaseVariantWithSameUnitEvenWhenCodeDiffers()
    {
        var unitId = GuidHelper.NewId();
        var existing = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-RAU", IngredientName = "Rau răm", UnitId = unitId, IsActive = true };
        var repo = Substitute.For<IIngredientRepository>();
        repo.GetActiveByUnitAsync(Arg.Any<byte[]>()).Returns([existing]);
        var warehouse = Substitute.For<IOperationalWarehouseResolver>();
        await using var context = NewContext();
        var service = new IngredientService(repo, warehouse, context, new EfTransactionRunner(context));

        var act = () => service.CreateAsync(new CreateIngredientRequest
        {
            IngredientCode = "ING-RAU-2", IngredientName = " RAU RĂM ", UnitId = GuidHelper.ToGuidString(unitId)
        });

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("*ING-RAU*");
        await repo.DidNotReceive().AddAsync(Arg.Any<Ingredient>());
    }

    [Fact]
    public async Task UpdateAsync_ShouldRejectRenamingToAnotherActiveIngredient()
    {
        var unitId = GuidHelper.NewId();
        var subjectId = GuidHelper.NewId();
        var subject = new Ingredient { IngredientId = subjectId, IngredientCode = "ING-1", IngredientName = "Cà chua", UnitId = unitId, IsActive = true };
        var existing = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-2", IngredientName = "Thịt gà", UnitId = unitId, IsActive = true };
        var repo = Substitute.For<IIngredientRepository>();
        repo.GetByIdAsync(Arg.Any<byte[]>()).Returns(subject);
        repo.GetActiveByUnitAsync(Arg.Any<byte[]>()).Returns([subject, existing]);
        await using var context = NewContext();
        var service = new IngredientService(repo, Substitute.For<IOperationalWarehouseResolver>(), context, new EfTransactionRunner(context));

        var act = () => service.UpdateAsync(GuidHelper.ToGuidString(subjectId), new UpdateIngredientRequest { IngredientName = "THỊT GÀ" });

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("*ING-2*");
        await repo.DidNotReceive().UpdateAsync(Arg.Any<Ingredient>());
    }

    private static IpcManagementContext NewContext()
        => new(new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"ingredient-identity-{Guid.NewGuid():N}").Options);
}
