using Hamper.Api.Infrastructure.Endpoints;

namespace Hamper.Api.Features.Images;

/// <summary>Serves one size of an image; an image id never changes its content, so the response is cached for a year.</summary>
public sealed class ServeImage : IEndpoint
{
    private const string ImmutableForAYear = "public, max-age=31536000, immutable";

    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/images/{imageId:guid}/{size}", (Guid imageId, string size, ImageStore images, HttpResponse response) =>
        {
            var localPath = images.FindLocalPath(imageId, size);
            if (localPath is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Image not found");
            }

            response.Headers.CacheControl = ImmutableForAYear;
            return Results.File(localPath, "image/jpeg");
        });
}
