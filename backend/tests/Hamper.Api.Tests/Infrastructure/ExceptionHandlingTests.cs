using System.Net;
using Hamper.Api.Infrastructure.Endpoints;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Hamper.Api.Tests.Infrastructure;

public sealed class ExceptionHandlingTests
{
    [Fact]
    public async Task Unhandled_exceptions_return_problem_json()
    {
        // Endpoint registration is DI-enumerable, so a test-only endpoint is mapped like the real ones.
        using var factory = new HamperApiFactory(services =>
            services.AddTransient<IEndpoint, ThrowingEndpoint>());
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/api/test/throw", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private sealed class ThrowingEndpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapGet("/api/test/throw", () =>
            {
                throw new InvalidOperationException("boom");
#pragma warning disable CS0162 // Unreachable: the lambda needs a result type.
                return Results.Ok();
#pragma warning restore CS0162
            });
    }
}
