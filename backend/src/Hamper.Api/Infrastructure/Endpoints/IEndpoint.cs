namespace Hamper.Api.Infrastructure.Endpoints;

/// <summary>Implemented by every slice operation that exposes an HTTP endpoint, found by assembly scan and mapped at startup.</summary>
public interface IEndpoint
{
    /// <summary>Maps the operation's full route.</summary>
    void Map(IEndpointRouteBuilder app);
}
