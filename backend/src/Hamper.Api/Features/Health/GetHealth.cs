using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;

namespace Hamper.Api.Features.Health;

public sealed record HealthResponse(string Status);

public sealed class GetHealth : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/health", async (HamperDbContext db, CancellationToken ct) =>
            Respond(await db.Database.CanConnectAsync(ct)));

    /// <summary>Pure so the 503 branch is unit-testable, since a dead database cannot boot the test factory.</summary>
    public static IResult Respond(bool databaseReachable) =>
        databaseReachable
            ? Results.Ok(new HealthResponse("ok"))
            : Results.Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Database unreachable");
}
