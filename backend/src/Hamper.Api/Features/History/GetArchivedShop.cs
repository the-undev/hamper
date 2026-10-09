using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.History;

public sealed class GetArchivedShop : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/api/history/{id:guid}", async (Guid id, HamperDbContext db, CancellationToken ct) =>
        {
            var archivedShop = await db.ArchivedShops.AsNoTracking().SingleOrDefaultAsync(shop => shop.Id == id, ct);
            if (archivedShop is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Archived shop not found");
            }

            return Results.Ok(ArchivedShopResponse.From(archivedShop));
        });
}
