using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Images;

/// <summary>Clears an item's or meal's picture and deletes its files.</summary>
public sealed class DeleteImage : IEndpoint
{
    public void Map(IEndpointRouteBuilder app)
    {
        MapFor(app, "items", "Item not found", db => db.Items);
        MapFor(app, "meals", "Meal not found", db => db.Meals);
    }

    private static void MapFor<T>(
        IEndpointRouteBuilder app, string table, string notFoundTitle, Func<HamperDbContext, DbSet<T>> rows)
        where T : class, IHasImage =>
        app.MapDelete(
            $"/api/{table}/{{id:guid}}/image",
            (Guid id, HamperDbContext db, WriteGate gate, ImageStore images, CancellationToken ct) =>
                gate.RunAsync(token => ClearAsync(id, db, rows(db), images, notFoundTitle, token), ct));

    private static async Task<IResult> ClearAsync<T>(
        Guid id, HamperDbContext db, DbSet<T> rows, ImageStore images, string notFoundTitle, CancellationToken ct)
        where T : class, IHasImage
    {
        var row = await rows.Live().SingleOrDefaultAsync(liveRow => liveRow.Id == id, ct);
        if (row is null)
        {
            return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: notFoundTitle);
        }

        if (row.ImageId is not { } clearedImageId)
        {
            return Results.NoContent();
        }

        row.ImageId = null;
        await db.SaveChangesAsync(ct);
        images.Delete(clearedImageId);
        return Results.NoContent();
    }
}
