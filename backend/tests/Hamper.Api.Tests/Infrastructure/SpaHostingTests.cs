using System.Net;
using Microsoft.AspNetCore.Hosting;

namespace Hamper.Api.Tests.Infrastructure;

public sealed class SpaHostingTests
{
    /// <summary>The app against a stub of the production wwwroot: the shell and one hashed asset.</summary>
    private sealed class WebRootFactory(string webRoot) : HamperApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseWebRoot(webRoot);
        }
    }

    private const string Shell = "<!doctype html><title>hamper</title><div id=\"root\"></div>";

    private static WebRootFactory BuildWebRoot(TempDirectory temp)
    {
        var root = temp.Sub("wwwroot");
        Directory.CreateDirectory(Path.Combine(root, "assets"));
        File.WriteAllText(Path.Combine(root, "index.html"), Shell);
        File.WriteAllText(Path.Combine(root, "assets", "app-abc123.js"), "console.log(1);");
        return new WebRootFactory(root);
    }

    [Fact]
    public async Task Root_serves_the_shell()
    {
        using var temp = new TempDirectory();
        using var factory = BuildWebRoot(temp);
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(Shell, await response.Content.ReadAsStringAsync(ct));
        Assert.True(response.Headers.CacheControl?.NoCache);
    }

    [Fact]
    public async Task Deep_client_routes_serve_the_shell()
    {
        using var temp = new TempDirectory();
        using var factory = BuildWebRoot(temp);
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/meals/some-meal", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(Shell, await response.Content.ReadAsStringAsync(ct));
    }

    [Fact]
    public async Task Hashed_assets_are_cached_for_a_year_and_the_shell_never_is()
    {
        using var temp = new TempDirectory();
        using var factory = BuildWebRoot(temp);
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var asset = await client.GetAsync(new Uri("/assets/app-abc123.js", UriKind.Relative), ct);
        var shell = await client.GetAsync(new Uri("/index.html", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.OK, asset.StatusCode);
        Assert.True(asset.Headers.CacheControl?.Public);
        Assert.Equal(TimeSpan.FromDays(365), asset.Headers.CacheControl?.MaxAge);
        Assert.Contains("immutable", asset.Headers.CacheControl?.ToString(), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, shell.StatusCode);
        Assert.True(shell.Headers.CacheControl?.NoCache);
    }

    [Fact]
    public async Task Unknown_api_paths_stay_problem_json_404()
    {
        using var temp = new TempDirectory();
        using var factory = BuildWebRoot(temp);
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/api/does-not-exist", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Unknown_images_paths_stay_problem_json_404()
    {
        using var temp = new TempDirectory();
        using var factory = BuildWebRoot(temp);
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/images/not-an-id/thumb", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Unknown_sync_paths_stay_problem_json_404()
    {
        using var temp = new TempDirectory();
        using var factory = BuildWebRoot(temp);
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/sync/does-not-exist", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }
}
