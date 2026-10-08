using System.Net;
using Hamper.Api.Features.Health;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Hamper.Api.Tests.Features.Health;

public sealed class GetHealthTests(HamperApiFactory factory) : IClassFixture<HamperApiFactory>
{
    [Fact]
    public async Task Returns_ok_when_database_is_reachable()
    {
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/health", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("""{"status":"ok"}""", await response.Content.ReadAsStringAsync(ct));
    }

    [Fact]
    public void Unhealthy_maps_to_a_503_problem()
    {
        var result = GetHealth.Respond(databaseReachable: false);

        var problem = Assert.IsType<ProblemHttpResult>(result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, problem.StatusCode);
        Assert.Equal("application/problem+json", problem.ContentType);
        Assert.Equal("Database unreachable", problem.ProblemDetails.Title);
    }

    [Fact]
    public void Healthy_keeps_the_contract_body()
    {
        var result = GetHealth.Respond(databaseReachable: true);

        var ok = Assert.IsType<Ok<HealthResponse>>(result);
        Assert.Equal(new HealthResponse("ok"), ok.Value);
    }
}
