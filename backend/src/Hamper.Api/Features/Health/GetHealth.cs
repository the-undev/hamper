using System.Reflection;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;

namespace Hamper.Api.Features.Health;

public sealed record HealthResponse(string Status, string Version);

public sealed class GetHealth : IEndpoint
{
    /// <summary>The API assembly's informational version, which the build stamps; read from it rather than the entry assembly, which is the test runner under test.</summary>
    public static readonly string Version =
        typeof(GetHealth).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? throw new InvalidOperationException("The API assembly has no informational version.");

    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/health", async (HamperDbContext db, CancellationToken ct) =>
            Respond(await db.Database.CanConnectAsync(ct)));

    /// <summary>Pure so the 503 branch is unit-testable, since a dead database cannot boot the test factory.</summary>
    public static IResult Respond(bool databaseReachable) =>
        databaseReachable
            ? Results.Ok(new HealthResponse("ok", Version))
            : Results.Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Database unreachable");
}
