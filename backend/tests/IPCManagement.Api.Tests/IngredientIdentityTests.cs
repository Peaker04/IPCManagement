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
