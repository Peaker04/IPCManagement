using FluentAssertions;
using IPCManagement.Api.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing;

namespace IPCManagement.Api.Tests;

public class ApiResponseModelStateFactoryTests
{
    [Fact]
    public void CreateInvalidModelStateResponse_Should_Return_ApiResponseEnvelope()
    {
        var modelState = new ModelStateDictionary();
        modelState.AddModelError("request", "The request field is required.");
        var actionContext = new ActionContext(
            new DefaultHttpContext(),
            new RouteData(),
            new Microsoft.AspNetCore.Mvc.Abstractions.ActionDescriptor(),
            modelState);

        var result = ApiResponseModelStateFactory.CreateInvalidModelStateResponse(actionContext);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var response = badRequest.Value.Should().BeOfType<ApiResponse>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Be("Dữ liệu gửi lên không hợp lệ.");
        response.Errors.Should().NotBeNull();
    }
}
