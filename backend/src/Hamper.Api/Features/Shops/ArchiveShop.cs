using Hamper.Api.Features.History;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Shops;

/// <summary>Copies an open shop into history as text, under the shop's own id, and tombstones the shop and its lines.</summary>
public sealed class ArchiveShop : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPost(
            "/api/shops/{id:guid}/archive",
            (Guid id, HamperDbContext db, WriteGate gate, TimeProvider time, CancellationToken ct) =>
                gate.RunAsync(token => ArchiveAsync(id, db, time, token), ct));

    private static async Task<IResult> ArchiveAsync(Guid shopId, HamperDbContext db, TimeProvider time, CancellationToken ct)
    {
        var shop = await db.Shops.Live().SingleOrDefaultAsync(openShop => openShop.Id == shopId, ct);
        if (shop is null)
        {
            return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Shop not found");
        }

        var linesWithItems = await db.ShopLines.Live()
            .Where(line => line.ShopId == shopId)
            .OrderBy(line => line.CreatedAt)
            .ThenBy(line => line.Id)
            .Join(db.Items, line => line.ItemId, item => item.Id, (line, item) => new { Line = line, Item = item })
            .ToListAsync(ct);

        var now = time.GetUtcNow();
        var archivedShop = new ArchivedShop
        {
            Id = shop.Id,
            Name = shop.Name,
            CreatedAt = shop.CreatedAt,
            ArchivedAt = now,
            PlanStartDate = shop.PlanStartDate,
            PlanLengthDays = shop.PlanLengthDays,
            Meals = shop.Meals,
            Lines = linesWithItems
                .Select(pair => new ArchivedShopLine(
                    pair.Line.NameOverride ?? pair.Item.Name,
                    pair.Line.SizeOverride ?? pair.Item.Size,
                    pair.Line.Count,
                    pair.Line.Sources,
                    pair.Line.Ticked))
                .ToList(),
        };
        db.ArchivedShops.Add(archivedShop);

        shop.DeletedAt = now;
        foreach (var pair in linesWithItems)
        {
            pair.Line.DeletedAt = now;
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(ArchivedShopResponse.From(archivedShop));
    }
}
