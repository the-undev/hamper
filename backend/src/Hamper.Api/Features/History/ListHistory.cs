using Hamper.Api.Features.Shops;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.History;

/// <summary>An archived shop in the history list, with a count of its lines in place of the lines.</summary>
public sealed record HistoryEntry(
    Guid Id,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset ArchivedAt,
    DateOnly? PlanStartDate,
    int? PlanLengthDays,
    IReadOnlyList<ShopMeal> Meals,
    int LineCount);

public sealed class ListHistory : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/api/history", async (HamperDbContext db, CancellationToken ct) =>
        {
            var archivedShops = await db.ArchivedShops.AsNoTracking()
                .OrderByDescending(shop => shop.ArchivedAt)
                .ToListAsync(ct);
            return Results.Ok(archivedShops.Select(shop => new HistoryEntry(
                shop.Id,
                shop.Name,
                shop.CreatedAt,
                shop.ArchivedAt,
                shop.PlanStartDate,
                shop.PlanLengthDays,
                shop.Meals,
                shop.Lines.Count)));
        });
}
