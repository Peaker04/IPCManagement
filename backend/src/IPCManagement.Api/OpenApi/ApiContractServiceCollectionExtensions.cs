using System.Text.Json;
using System.Text.Json.Serialization;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Features.SystemOperation.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi;

namespace IPCManagement.Api.OpenApi;

public static class ApiContractServiceCollectionExtensions
{
    public static IServiceCollection AddApiContractServices(this IServiceCollection services)
    {
        services.AddControllers(options => options.Filters.AddService<SystemOperationModeFilter>())
            .AddApplicationPart(typeof(Program).Assembly)
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
                options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
                options.JsonSerializerOptions.Converters.Add(new UtcDateTimeJsonConverter());
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });

        services.Configure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = ApiResponseModelStateFactory.CreateInvalidModelStateResponse;
        });

        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "IPC Management API",
                Version = "v1",
                Description = "Hệ thống quản lý bếp ăn công nghiệp (IPC Management System)"
            });

            options.SupportNonNullableReferenceTypes();
            options.NonNullableReferenceTypesAsRequired();

            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Nhập JWT token: Bearer {token}"
            });

            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecuritySchemeReference("Bearer", document),
                    []
                }
            });
        });

        return services;
    }

    public static WebApplication UseApiContractDocumentation(this WebApplication app)
    {
        app.UseSwagger();
        // Both development URLs expose the same schema used by contract generation.
        app.UseSwagger(options => options.RouteTemplate = "openapi/{documentName}.json");
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "IPC Management API v1");
            options.RoutePrefix = "swagger";
        });
        return app;
    }
}
