using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using ImageMagick;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Images;

/// <summary>Takes an item's or meal's picture as the raw request body, stores it as a new image, and points the row at it in place of the one before.</summary>
public sealed class UploadImage : IEndpoint
{
    public void Map(IEndpointRouteBuilder app)
    {
        MapFor(app, "items", "Item not found", db => db.Items);
        MapFor(app, "meals", "Meal not found", db => db.Meals);
    }

    private static void MapFor<T>(
        IEndpointRouteBuilder app, string table, string notFoundTitle, Func<HamperDbContext, DbSet<T>> rows)
        where T : class, IHasImage =>
        app.MapPost(
            $"/api/{table}/{{id:guid}}/image",
            async (Guid id, HttpRequest request, HamperDbContext db, WriteGate gate, ImageStore images, CancellationToken ct) =>
            {
                var mediaType = request.GetTypedHeaders().ContentType?.MediaType.Value;
                if (mediaType is null || !ImageStore.UploadFormats.TryGetValue(mediaType, out var format))
                {
                    return Results.Problem(
                        statusCode: StatusCodes.Status415UnsupportedMediaType,
                        title: "Send image/jpeg, image/png or image/webp");
                }

                var upload = await ReadAtMostAsync(request.Body, ImageStore.MaxUploadBytes, ct);
                if (upload is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status413PayloadTooLarge, title: "Image is over 10 MB");
                }

                return await gate.RunAsync(
                    token => AttachAsync(id, upload, format, db, rows(db), images, notFoundTitle, token),
                    ct);
            });

    private static async Task<IResult> AttachAsync<T>(
        Guid id,
        byte[] upload,
        MagickFormat format,
        HamperDbContext db,
        DbSet<T> rows,
        ImageStore images,
        string notFoundTitle,
        CancellationToken ct)
        where T : class, IHasImage
    {
        var row = await rows.Live().SingleOrDefaultAsync(liveRow => liveRow.Id == id, ct);
        if (row is null)
        {
            return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: notFoundTitle);
        }

        var imageId = await images.CreateAsync(upload, format, ct);
        if (imageId is null)
        {
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Not an image");
        }

        var previousImageId = row.ImageId;
        row.ImageId = imageId;
        await db.SaveChangesAsync(ct);
        if (previousImageId is { } replacedImageId)
        {
            images.Delete(replacedImageId);
        }

        return Results.Ok(new UploadedImage(imageId.Value));
    }

    /// <summary>Reads the whole body, or returns null as soon as it passes the limit.</summary>
    private static async Task<byte[]?> ReadAtMostAsync(Stream body, long maxBytes, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await body.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > maxBytes)
            {
                return null;
            }

            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }

    /// <summary>The new image's id, which the row now holds.</summary>
    private sealed record UploadedImage(Guid ImageId);
}
