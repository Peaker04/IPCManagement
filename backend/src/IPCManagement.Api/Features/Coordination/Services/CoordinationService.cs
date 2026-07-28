using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Coordination.Contracts;

namespace IPCManagement.Api.Features.Coordination.Services;

public sealed class CoordinationService : ICoordinationService
{
    private readonly ICustomerContractService _customerContractService;
    private readonly IPortionRuleService _portionRuleService;
    private readonly IMenuScheduleService _menuScheduleService;
    private readonly IMealQuantityPlanService _mealQuantityPlanService;
    private readonly IOrderPlanService _orderPlanService;
    private readonly IOrderAdjustmentService _orderAdjustmentService;
    private readonly IOrderSignoffService _orderSignoffService;

    public CoordinationService(IpcManagementContext context)
        : this(
            context,
            new CustomerContractService(context),
            new PortionRuleService(context),
            new MenuScheduleService(context),
            new MealQuantityPlanService(context),
            new OrderPlanService(context),
            new OrderAdjustmentService(context),
            new OrderSignoffService(context))
    {
    }

    public CoordinationService(
        IpcManagementContext context,
        ICustomerContractService customerContractService)
        : this(
            context,
            customerContractService,
            new PortionRuleService(context),
            new MenuScheduleService(context),
            new MealQuantityPlanService(context),
            new OrderPlanService(context),
            new OrderAdjustmentService(context),
            new OrderSignoffService(context))
    {
    }

    public CoordinationService(
        IpcManagementContext context,
        ICustomerContractService customerContractService,
        IPortionRuleService portionRuleService)
        : this(
            context,
            customerContractService,
            portionRuleService,
            new MenuScheduleService(context),
            new MealQuantityPlanService(context),
            new OrderPlanService(context),
            new OrderAdjustmentService(context),
            new OrderSignoffService(context))
    {
    }

    public CoordinationService(
        IpcManagementContext context,
        ICustomerContractService customerContractService,
        IPortionRuleService portionRuleService,
        IMenuScheduleService menuScheduleService)
        : this(
            context,
            customerContractService,
            portionRuleService,
            menuScheduleService,
            new MealQuantityPlanService(context),
            new OrderPlanService(context),
            new OrderAdjustmentService(context),
            new OrderSignoffService(context))
    {
    }

    public CoordinationService(
        IpcManagementContext context,
        ICustomerContractService customerContractService,
        IPortionRuleService portionRuleService,
        IMenuScheduleService menuScheduleService,
        IMealQuantityPlanService mealQuantityPlanService)
        : this(
            context,
            customerContractService,
            portionRuleService,
            menuScheduleService,
            mealQuantityPlanService,
            new OrderPlanService(context),
            new OrderAdjustmentService(context),
            new OrderSignoffService(context))
    {
    }

    public CoordinationService(
        IpcManagementContext context,
        ICustomerContractService customerContractService,
        IPortionRuleService portionRuleService,
        IMenuScheduleService menuScheduleService,
        IMealQuantityPlanService mealQuantityPlanService,
        IOrderPlanService orderPlanService,
        IOrderAdjustmentService orderAdjustmentService,
        IOrderSignoffService orderSignoffService)
    {
        _ = context;
        _customerContractService = customerContractService;
        _portionRuleService = portionRuleService;
        _menuScheduleService = menuScheduleService;
        _mealQuantityPlanService = mealQuantityPlanService;
        _orderPlanService = orderPlanService;
        _orderAdjustmentService = orderAdjustmentService;
        _orderSignoffService = orderSignoffService;
    }

    public Task<IReadOnlyList<CoordinationOrderDto>> GetActiveOrdersAsync(CoordinationOrdersQueryDto query)
        => _orderPlanService.GetActiveOrdersAsync(query);

    public Task<IReadOnlyList<CustomerContractDto>> GetCustomerContractsAsync()
        => _customerContractService.GetCustomerContractsAsync();

    public Task<CustomerContractDto> CreateCustomerContractAsync(CreateCustomerContractRequest request, string? userId)
        => _customerContractService.CreateCustomerContractAsync(request, userId);

    public Task<CustomerContractDto?> UpdateCustomerContractAsync(
        string customerId,
        UpdateCustomerContractRequest request,
        string? userId)
        => _customerContractService.UpdateCustomerContractAsync(customerId, request, userId);

    public Task<IReadOnlyList<PortionRuleDto>> GetPortionRulesAsync(PortionRuleQueryDto query)
        => _portionRuleService.GetPortionRulesAsync(query);

    public Task<PortionRuleDto> CreatePortionRuleAsync(CreatePortionRuleRequest request, string? userId)
        => _portionRuleService.CreatePortionRuleAsync(request, userId);

    public Task<PortionRuleDto?> UpdatePortionRuleAsync(
        string portionRuleId,
        UpdatePortionRuleRequest request,
        string? userId)
        => _portionRuleService.UpdatePortionRuleAsync(portionRuleId, request, userId);

    public Task<ResolvedPortionRuleDto?> ResolvePortionRuleAsync(ResolvePortionRuleRequest request)
        => _portionRuleService.ResolvePortionRuleAsync(request);

    public Task<IReadOnlyList<MenuScheduleDto>> GetMenuSchedulesAsync(MenuScheduleQueryDto query)
        => _menuScheduleService.GetMenuSchedulesAsync(query);

    public Task<MenuScheduleDto?> UpdateMenuScheduleRulesAsync(
        string menuScheduleId,
        UpdateMenuScheduleRulesRequest request,
        string? userId)
        => _menuScheduleService.UpdateMenuScheduleRulesAsync(menuScheduleId, request, userId);

    public Task<MenuScheduleDto?> UpdateMenuScheduleVersionAsync(
        string menuScheduleId,
        UpdateMenuScheduleVersionRequest request,
        string? userId)
        => _menuScheduleService.UpdateMenuScheduleVersionAsync(menuScheduleId, request, userId);

    public Task<MenuVersionRollbackResultDto> RollbackMenuVersionAsync(
        RollbackMenuVersionRequest request,
        string? userId)
        => _menuScheduleService.RollbackMenuVersionAsync(request, userId);

    public Task<IReadOnlyList<MealQuantityPlanDto>> GetMealQuantityPlansAsync(MealQuantityPlanQueryDto query)
        => _mealQuantityPlanService.GetMealQuantityPlansAsync(query);

    public Task<MealQuantityPlanDto?> UpsertQuickServingsAsync(UpsertQuickServingsRequest request, string? userId)
        => _mealQuantityPlanService.UpsertQuickServingsAsync(request, userId);

    public Task<LockOrderPlanResultDto?> LockOrderPlanAsync(LockOrderPlanRequest request, string? userId)
        => _orderPlanService.LockOrderPlanAsync(request, userId);

    public Task<LockOrderPlanResultDto?> UnlockOrderPlanAsync(string quantityPlanId, string? userId)
        => _orderPlanService.UnlockOrderPlanAsync(quantityPlanId, userId);

    public Task<CoordinationScopeActionResultDto?> UnlockOrderPlanScopeAsync(
        CoordinationScopeActionRequest request,
        string? userId)
        => _orderPlanService.UnlockOrderPlanScopeAsync(request, userId);

    public Task<AdjustOrderAfterLockResultDto?> AdjustOrderAfterLockAsync(
        AdjustOrderAfterLockRequest request,
        string? userId)
        => _orderAdjustmentService.AdjustOrderAfterLockAsync(request, userId);

    public Task<AdjustServingsResultDto?> AdjustServingsAsync(
        string orderId,
        AdjustServingsRequest request,
        string? userId)
        => _orderAdjustmentService.AdjustServingsAsync(orderId, request, userId);

    public Task<AdjustServingsResultDto?> UpdateForecastServingsAsync(
        string orderId,
        UpdateForecastServingsRequest request,
        string? userId)
        => _orderAdjustmentService.UpdateForecastServingsAsync(orderId, request, userId);

    public Task<SignoffOrderResultDto?> SignoffOrderAsync(
        string quantityPlanId,
        SignoffOrderRequest request,
        string? userId)
        => _orderSignoffService.SignoffOrderAsync(quantityPlanId, request, userId);

    public Task<CoordinationScopeActionResultDto?> SignoffOrderScopeAsync(
        CoordinationScopeActionRequest request,
        string? userId)
        => _orderSignoffService.SignoffOrderScopeAsync(request, userId);

    public Task<ExportOrderReportResultDto> ExportOrderReportAsync(ExportOrderReportRequest request)
        => _orderPlanService.ExportOrderReportAsync(request);
}
