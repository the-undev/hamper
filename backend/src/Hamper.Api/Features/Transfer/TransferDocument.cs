using System.Text.Json;
using Hamper.Api.Features.History;
using Hamper.Api.Features.Items;
using Hamper.Api.Features.Meals;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Shops;

namespace Hamper.Api.Features.Transfer;

/// <summary>The data.json inside an export: every live row, without revisions or tombstones, and all of history.</summary>
public sealed record TransferDocument(
    int Format,
    DateTimeOffset ExportedAt,
    TransferPlan Plan,
    IReadOnlyList<TransferItem> Items,
    IReadOnlyList<TransferMeal> Meals,
    IReadOnlyList<TransferMealLine> MealLines,
    IReadOnlyList<TransferDay> Days,
    IReadOnlyList<TransferDayLine> DayLines,
    IReadOnlyList<TransferWantedLine> WantedLines,
    IReadOnlyList<TransferShop> Shops,
    IReadOnlyList<TransferShopLine> ShopLines,
    IReadOnlyList<TransferArchivedShop> ArchivedShops)
{
    /// <summary>The format this build writes and the only one it imports.</summary>
    public const int CurrentFormat = 1;

    /// <summary>The name of the JSON entry in the zip.</summary>
    public const string EntryName = "data.json";

    /// <summary>camelCase, and strict on read: a missing field or a null where none is allowed fails the import.</summary>
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        RespectNullableAnnotations = true,
        RespectRequiredConstructorParameters = true,
        WriteIndented = true,
    };
}

public sealed record TransferPlan(DateOnly StartDate, int LengthDays);

public sealed record TransferItem(Guid Id, string Name, string? Size)
{
    public static TransferItem From(Item item) => new(item.Id, item.Name, item.Size);

    public Item ToEntity() => new() { Id = Id, Name = Name, Size = Size };
}

public sealed record TransferMeal(Guid Id, string Name)
{
    public static TransferMeal From(Meal meal) => new(meal.Id, meal.Name);

    public Meal ToEntity() => new() { Id = Id, Name = Name };
}

public sealed record TransferMealLine(Guid Id, Guid MealId, Guid ItemId, int Count)
{
    public static TransferMealLine From(MealLine line) => new(line.Id, line.MealId, line.ItemId, line.Count);

    public MealLine ToEntity() => new() { Id = Id, MealId = MealId, ItemId = ItemId, Count = Count };
}

public sealed record TransferDay(Guid Id, int Position, string Name, Guid? MealId)
{
    public static TransferDay From(Day day) => new(day.Id, day.Position, day.Name, day.MealId);

    public Day ToEntity() => new() { Id = Id, Position = Position, Name = Name, MealId = MealId };
}

public sealed record TransferDayLine(Guid Id, Guid DayId, Guid ItemId, int Count)
{
    public static TransferDayLine From(DayLine line) => new(line.Id, line.DayId, line.ItemId, line.Count);

    public DayLine ToEntity() => new() { Id = Id, DayId = DayId, ItemId = ItemId, Count = Count };
}

public sealed record TransferWantedLine(Guid Id, Guid ItemId, int Count, bool Weekly)
{
    public static TransferWantedLine From(WantedLine line) => new(line.Id, line.ItemId, line.Count, line.Weekly);

    public WantedLine ToEntity() => new() { Id = Id, ItemId = ItemId, Count = Count, Weekly = Weekly };
}

public sealed record TransferShop(
    Guid Id,
    string Name,
    DateTimeOffset CreatedAt,
    bool FromPlan,
    DateOnly? PlanStartDate,
    int? PlanLengthDays,
    IReadOnlyList<ShopMeal> Meals)
{
    public static TransferShop From(Shop shop) =>
        new(shop.Id, shop.Name, shop.CreatedAt, shop.FromPlan, shop.PlanStartDate, shop.PlanLengthDays, shop.Meals);

    public Shop ToEntity() => new()
    {
        Id = Id,
        Name = Name,
        CreatedAt = CreatedAt,
        FromPlan = FromPlan,
        PlanStartDate = PlanStartDate,
        PlanLengthDays = PlanLengthDays,
        Meals = Meals,
    };
}

public sealed record TransferShopLine(
    Guid Id,
    Guid ShopId,
    Guid ItemId,
    int Count,
    string? NameOverride,
    string? SizeOverride,
    IReadOnlyList<string> Sources,
    bool Ticked,
    DateTimeOffset CreatedAt)
{
    public static TransferShopLine From(ShopLine line) =>
        new(line.Id, line.ShopId, line.ItemId, line.Count, line.NameOverride, line.SizeOverride, line.Sources, line.Ticked, line.CreatedAt);

    public ShopLine ToEntity() => new()
    {
        Id = Id,
        ShopId = ShopId,
        ItemId = ItemId,
        Count = Count,
        NameOverride = NameOverride,
        SizeOverride = SizeOverride,
        Sources = Sources,
        Ticked = Ticked,
        CreatedAt = CreatedAt,
    };
}

public sealed record TransferArchivedShop(
    Guid Id,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset ArchivedAt,
    DateOnly? PlanStartDate,
    int? PlanLengthDays,
    IReadOnlyList<ShopMeal> Meals,
    IReadOnlyList<ArchivedShopLine> Lines)
{
    public static TransferArchivedShop From(ArchivedShop shop) =>
        new(shop.Id, shop.Name, shop.CreatedAt, shop.ArchivedAt, shop.PlanStartDate, shop.PlanLengthDays, shop.Meals, shop.Lines);

    public ArchivedShop ToEntity() => new()
    {
        Id = Id,
        Name = Name,
        CreatedAt = CreatedAt,
        ArchivedAt = ArchivedAt,
        PlanStartDate = PlanStartDate,
        PlanLengthDays = PlanLengthDays,
        Meals = Meals,
        Lines = Lines,
    };
}
