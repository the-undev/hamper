namespace Hamper.Api.Infrastructure.Hosting;

/// <summary>Serves the built frontend from wwwroot, and serves nothing in dev, where there is none.</summary>
public static class SpaHosting
{
    private const string ApiPrefix = "/api";

    private const string IndexFile = "index.html";

    /// <summary>Vite puts content-hashed names under /assets.</summary>
    private const string HashedAssets = "/assets";

    private const string ImmutableForAYear = "public, max-age=31536000, immutable";

    /// <summary>The shell may be cached but is revalidated, so a new build takes effect on the next load.</summary>
    private const string Revalidate = "no-cache";

    /// <summary>Serves static files, hashed assets cached for a year and everything else revalidated.</summary>
    public static WebApplication UseSpaFiles(this WebApplication app)
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = served =>
                served.Context.Response.Headers.CacheControl =
                    served.Context.Request.Path.StartsWithSegments(HashedAssets)
                        ? ImmutableForAYear
                        : Revalidate,
        });
        return app;
    }

    /// <summary>Serves the shell for any path no endpoint claimed, except unknown /api paths, which stay problem+json 404s.</summary>
    public static WebApplication MapSpaFallback(this WebApplication app)
    {
        app.MapFallback((HttpContext context, IWebHostEnvironment environment) =>
        {
            if (context.Request.Path.StartsWithSegments(ApiPrefix))
            {
                return NotFound();
            }

            var index = environment.WebRootFileProvider.GetFileInfo(IndexFile);
            if (!index.Exists)
            {
                return NotFound();
            }

            context.Response.Headers.CacheControl = Revalidate;
            return Results.Stream(index.CreateReadStream(), "text/html; charset=utf-8");
        });

        return app;
    }

    private static IResult NotFound() =>
        Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Not found");
}
