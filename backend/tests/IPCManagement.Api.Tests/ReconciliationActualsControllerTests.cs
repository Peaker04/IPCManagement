using FluentAssertions;
using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Tests;

public class ReconciliationActualsControllerTests
{
    [Theory]
    [InlineData(nameof(ReconciliationActualsController.Purchased))]
    [InlineData(nameof(ReconciliationActualsController.Issued))]
    public void Legacy_actual_tombstone_is_mode_neutral(string action)
    {
        typeof(ReconciliationActualsController).GetMethod(action)!
            .IsDefined(typeof(SystemOperationNeutralAttribute), true)
            .Should().BeTrue();
    }

    [Theory]
    [InlineData("PURCHASED")]
    [InlineData("ISSUED")]
    public async Task Legacy_actual_mutation_is_gone_without_calling_service(string side)
    {
        var controller = new ReconciliationActualsController(null!, null!);

        var result = side == "PURCHASED"
            ? await controller.Purchased("line-1", new(1, null, false, null), CancellationToken.None)
            : await controller.Issued("line-1", new(1, null, false, null), CancellationToken.None);

        var gone = result.Should().BeOfType<ObjectResult>().Subject;
        gone.StatusCode.Should().Be(StatusCodes.Status410Gone);
        gone.Value.Should().BeOfType<ApiResponse>();
    }
}
