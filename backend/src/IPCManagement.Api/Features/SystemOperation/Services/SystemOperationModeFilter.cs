using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace IPCManagement.Api.Features.SystemOperation.Services;

public sealed class SystemOperationModeFilter(SystemOperationModeGuard guard, SystemOperationRequestContext requestContext) : IAsyncAuthorizationFilter, IOrderedFilter
{
    public int Order => int.MinValue + 100;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.ActionDescriptor is not ControllerActionDescriptor action) return;
        var explicitMetadata = action.MethodInfo.GetCustomAttributes(true).OfType<SystemOperationAttribute>().FirstOrDefault()
            ?? action.ControllerTypeInfo.GetCustomAttributes(true).OfType<SystemOperationAttribute>().FirstOrDefault();
        var neutral = action.MethodInfo.IsDefined(typeof(SystemOperationNeutralAttribute), true)
            || action.ControllerTypeInfo.IsDefined(typeof(SystemOperationNeutralAttribute), true);
        var controller = action.ControllerName;
        var disposition = neutral ? OperationDisposition.Neutral : explicitMetadata?.Disposition ?? SystemOperationEligibility.Classify(controller, action.ActionName);
        if (disposition == OperationDisposition.Neutral) return;

        try
        {
            var snapshot = await guard.ReadRequiredAsync(context.HttpContext.RequestAborted);
            if (!SystemOperationEligibility.IsAllowed(snapshot.Mode, disposition))
            {
                context.Result = new ObjectResult(new { success = false, code = "MODE_UNAVAILABLE", message = "Chức năng này không sử dụng trong chế độ Đối chiếu nguyên liệu." }) { StatusCode = StatusCodes.Status409Conflict };
                return;
            }
            requestContext.OperationKey = explicitMetadata?.OperationKey ?? SystemOperationEligibility.OperationKey(controller, action.ActionName);
            requestContext.ExpectedModeVersion = snapshot.Version;
            requestContext.Disposition = disposition;
        }
        catch (SystemOperationAuthorityException exception)
        {
            context.Result = new ObjectResult(new { success = false, code = "MODE_AUTHORITY_INVALID", message = exception.Message }) { StatusCode = StatusCodes.Status503ServiceUnavailable };
        }
    }
}
