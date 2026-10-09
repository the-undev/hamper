using Hamper.Api.Features.Shops;

namespace Hamper.Api.Features.History;

/// <summary>An archived shop in full, lines included.</summary>
public sealed record ArchivedShopResponse(
    Guid Id,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset ArchivedAt,
    DateOnly? PlanStartDate,
    int? PlanLengthDays,
    IReadOnlyList<ShopMeal> Meals,
    IReadOnlyList<ArchivedShopLine> Lines)
{
    public static ArchivedShopResponse From(ArchivedShop shop) =>
        new(shop.Id, shop.Name, shop.CreatedAt, shop.ArchivedAt, shop.PlanStartDate, shop.PlanLengthDays, shop.Meals, shop.Lines);
}
