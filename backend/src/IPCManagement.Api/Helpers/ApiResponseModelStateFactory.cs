using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Helpers;

public static class ApiResponseModelStateFactory
{
    public static IActionResult CreateInvalidModelStateResponse(ActionContext context)
    {
        var errors = context.ModelState
            .Where(item => item.Value?.Errors.Count > 0)
            .ToDictionary(
                item => string.IsNullOrWhiteSpace(item.Key) ? "request" : item.Key,
                item => item.Value!.Errors
                    .Select(error => string.IsNullOrWhiteSpace(error.ErrorMessage)
                        ? "Dữ liệu không hợp lệ."
                        : error.ErrorMessage)
                    .ToArray());

        return new BadRequestObjectResult(ApiResponse.FailResult(
            "Dữ liệu gửi lên không hợp lệ.",
            errors));
    }
}
