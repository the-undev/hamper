using System.Reflection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hamper.Api.Infrastructure.Endpoints;

public static class EndpointExtensions
{
    /// <summary>Registers every concrete <see cref="IEndpoint"/> in the assembly.</summary>
    public static IServiceCollection AddEndpoints(this IServiceCollection services, Assembly assembly)
    {
        services.TryAddEnumerable(
            assembly.DefinedTypes
                .Where(t => t is { IsAbstract: false, IsInterface: false }
                    && t.IsAssignableTo(typeof(IEndpoint)))
                .Select(t => ServiceDescriptor.Transient(typeof(IEndpoint), t)));
        return services;
    }

    /// <summary>Maps every registered <see cref="IEndpoint"/>.</summary>
    public static WebApplication MapEndpoints(this WebApplication app)
    {
        foreach (var endpoint in app.Services.GetServices<IEndpoint>())
        {
            endpoint.Map(app);
        }

        return app;
    }
}
