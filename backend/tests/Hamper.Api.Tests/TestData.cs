using Hamper.Api.Features.Items;
using Hamper.Api.Features.Meals;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Shops;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace Hamper.Api.Tests;

/// <summary>A meal and the lines inserted with it.</summary>
internal sealed record MealWithLines(Meal Meal, IReadOnlyList<MealLine> Lines);

/// <summary>A day and the lines inserted with it.</summary>
internal sealed record DayWithLines(Day Day, IReadOnlyList<DayLine> Lines);

/// <summary>A shop and the lines inserted with it.</summary>
internal sealed record ShopWithLines(Shop Shop, IReadOnlyList<ShopLine> Lines);

/// <summary>What a shop is made with; plan fields stay empty unless given.</summary>
internal sealed record ShopSeed(
    string Name,
    bool FromPlan = false,
    DateOnly? PlanStartDate = null,
    int? PlanLengthDays = null,
    IReadOnlyList<ShopMeal>? Meals = null);

/// <summary>What a shop line is made with; lines get CreatedAt a millisecond apart in list order.</summary>
internal sealed record ShopLineSeed(
    Item Item,
    int Count,
    string? NameOverride = null,
    string? SizeOverride = null,
    IReadOnlyList<string>? Sources = null,
    bool Ticked = false);

/// <summary>Inserts rows through a scoped context inside the write gate and returns what it created.</summary>
internal static class TestData
{
    public static Task<Item> AddItemAsync(HamperApiFactory factory, string name, string? size, CancellationToken ct) =>
        WriteAsync(factory, (db, _) =>
        {
            var item = new Item { Id = Guid.NewGuid(), Name = name, Size = size };
            db.Items.Add(item);
            return item;
        }, ct);

    public static Task<MealWithLines> AddMealAsync(
        HamperApiFactory factory, string name, IReadOnlyList<(Item Item, int Count)> lines, CancellationToken ct) =>
        WriteAsync(factory, (db, _) =>
        {
            var meal = new Meal { Id = Guid.NewGuid(), Name = name };
            var mealLines = lines
                .Select(line => new MealLine { Id = Guid.NewGuid(), MealId = meal.Id, ItemId = line.Item.Id, Count = line.Count })
                .ToList();
            db.Meals.Add(meal);
            db.MealLines.AddRange(mealLines);
            return new MealWithLines(meal, mealLines);
        }, ct);

    public static Task<DayWithLines> AddDayAsync(
        HamperApiFactory factory,
        int position,
        string name,
        Guid? mealId,
        IReadOnlyList<(Item Item, int Count)> lines,
        CancellationToken ct) =>
        WriteAsync(factory, (db, _) =>
        {
            var day = new Day { Id = Day.IdFor(position), Position = position, Name = name, MealId = mealId };
            var dayLines = lines
                .Select(line => new DayLine { Id = Guid.NewGuid(), DayId = day.Id, ItemId = line.Item.Id, Count = line.Count })
                .ToList();
            db.Days.Add(day);
            db.DayLines.AddRange(dayLines);
            return new DayWithLines(day, dayLines);
        }, ct);

    public static Task<WantedLine> AddWantedLineAsync(
        HamperApiFactory factory, Item item, int count, bool weekly, CancellationToken ct) =>
        WriteAsync(factory, (db, _) =>
        {
            var wantedLine = new WantedLine { Id = Guid.NewGuid(), ItemId = item.Id, Count = count, Weekly = weekly };
            db.WantedLines.Add(wantedLine);
            return wantedLine;
        }, ct);

    public static Task<ShopWithLines> AddShopAsync(
        HamperApiFactory factory, ShopSeed seed, IReadOnlyList<ShopLineSeed> lines, CancellationToken ct) =>
        WriteAsync(factory, (db, now) =>
        {
            var shop = new Shop
            {
                Id = Guid.NewGuid(),
                Name = seed.Name,
                CreatedAt = now,
                FromPlan = seed.FromPlan,
                PlanStartDate = seed.PlanStartDate,
                PlanLengthDays = seed.PlanLengthDays,
                Meals = seed.Meals ?? [],
            };
            var shopLines = lines
                .Select((line, index) => new ShopLine
                {
                    Id = Guid.NewGuid(),
                    ShopId = shop.Id,
                    ItemId = line.Item.Id,
                    Count = line.Count,
                    NameOverride = line.NameOverride,
                    SizeOverride = line.SizeOverride,
                    Sources = line.Sources ?? [],
                    Ticked = line.Ticked,
                    CreatedAt = now.AddMilliseconds(index),
                })
                .ToList();
            db.Shops.Add(shop);
            db.ShopLines.AddRange(shopLines);
            return new ShopWithLines(shop, shopLines);
        }, ct);

    /// <summary>Runs a change against a scoped context inside the write gate, saves it, and returns what the change built.</summary>
    public static async Task<T> WriteAsync<T>(
        HamperApiFactory factory, Func<HamperDbContext, DateTimeOffset, T> add, CancellationToken ct)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();
        var now = scope.ServiceProvider.GetRequiredService<TimeProvider>().GetUtcNow();
        return await scope.ServiceProvider.GetRequiredService<WriteGate>().RunAsync(async token =>
        {
            var created = add(db, now);
            await db.SaveChangesAsync(token);
            return created;
        }, ct);
    }
}
