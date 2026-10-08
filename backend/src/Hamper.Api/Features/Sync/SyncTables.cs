using System.Text.Json;
using Hamper.Api.Features.Items;
using Hamper.Api.Features.Meals;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Shops;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Sync;

/// <summary>Every synced table under its wire name, in the order a response lists them.</summary>
public static class SyncTables
{
    /// <summary>The synced tables, each mapped to its entity type and DbSet.</summary>
    public static readonly IReadOnlyList<SyncTable> All =
    [
        new SyncTable<Item>("items", db => db.Items),
        new SyncTable<Meal>("meals", db => db.Meals),
        new SyncTable<MealLine>("mealLines", db => db.MealLines),
        new SyncTable<Plan>("plan", db => db.Plans),
        new SyncTable<Day>("days", db => db.Days),
        new SyncTable<DayLine>("dayLines", db => db.DayLines),
        new SyncTable<WantedLine>("wantedLines", db => db.WantedLines),
        new SyncTable<Shop>("shops", db => db.Shops),
        new SyncTable<ShopLine>("shopLines", db => db.ShopLines),
    ];

    /// <summary>camelCase rows with every column, DateOnly as yyyy-MM-dd and timestamps as ISO 8601 with offset.</summary>
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}

/// <summary>One synced table as the wire names it.</summary>
public abstract class SyncTable(string wireName)
{
    /// <summary>The camelCase name of the table on the wire.</summary>
    public string WireName { get; } = wireName;

    /// <summary>Reads every row written after the revision, tombstones included, oldest first.</summary>
    public abstract Task<IReadOnlyList<object>> ReadSinceAsync(HamperDbContext db, long since, CancellationToken ct);
}

/// <summary>A synced table of rows of type <typeparamref name="T"/>.</summary>
public sealed class SyncTable<T>(string wireName, Func<HamperDbContext, DbSet<T>> rows) : SyncTable(wireName)
    where T : class, ISynced
{
    public override async Task<IReadOnlyList<object>> ReadSinceAsync(HamperDbContext db, long since, CancellationToken ct) =>
        await rows(db).AsNoTracking()
            .Where(row => row.Revision > since)
            .OrderBy(row => row.Revision)
            .ToListAsync(ct);
}
