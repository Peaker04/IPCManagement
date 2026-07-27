using Microsoft.Extensions.Hosting;

namespace IPCManagement.Api.OpenApi;

public static class SwaggerHostFactory
{
    public static IHost CreateHost()
        => Host.CreateDefaultBuilder()
            .ConfigureWebHostDefaults(webBuilder =>
            {
                webBuilder.ConfigureServices(services => services.AddApiContractServices());
                webBuilder.Configure(_ => { });
            })
            .Build();
}
