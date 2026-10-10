using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using Hamper.Api.Features.Items;
using Hamper.Api.Features.Meals;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Shops;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Sync;

/// <summary>Every synced table under its wire name, in the order a response lists them, with the rules a pushed row must keep.</summary>
public static class SyncTables
{
    /// <summary>The synced tables, each mapped to its entity type, DbSet and validation.</summary>
    public static readonly IReadOnlyList<SyncTable> All =
    [
        new SyncTable<Item>("items", db => db.Items, item =>
            NameProblem(item.Name, Item.NameMaxLength) ?? TextProblem("size", item.Size, Item.SizeMaxLength)),
        new SyncTable<Meal>("meals", db => db.Meals, meal => NameProblem(meal.Name, Meal.NameMaxLength)),
        new SyncTable<MealLine>("mealLines", db => db.MealLines, line => CountProblem(line.Count)),
        new SyncTable<Plan>("plan", db => db.Plans, PlanProblem),
        new SyncTable<PlannedMeal>("plannedMeals", db => db.PlannedMeals, PlannedMealProblem),
        new SyncTable<PlannedMealLine>("plannedMealLines", db => db.PlannedMealLines, line => CountProblem(line.Count)),
        new SyncTable<WantedLine>("wantedLines", db => db.WantedLines, line => CountProblem(line.Count)),
        new SyncTable<Shop>("shops", db => db.Shops, shop => NameProblem(shop.Name, maxLength: null)),
        new SyncTable<ShopLine>("shopLines", db => db.ShopLines, line => CountProblem(line.Count)),
    ];

    /// <summary>camelCase rows with every column, DateOnly as yyyy-MM-dd and timestamps as ISO 8601 with offset; on read every column but the revision is required and nothing else is allowed.</summary>
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        RespectNullableAnnotations = true,
        RespectRequiredConstructorParameters = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { RequireEveryColumnButRevision } },
    };

    private static readonly string RevisionProperty = JsonNamingPolicy.CamelCase.ConvertName(nameof(ISynced.Revision));

    /// <summary>Finds a table by its wire name.</summary>
    public static SyncTable? Find(string wireName) => All.SingleOrDefault(table => table.WireName == wireName);

    private static void RequireEveryColumnButRevision(JsonTypeInfo typeInfo)
    {
        if (!typeInfo.Type.IsAssignableTo(typeof(ISynced)))
        {
            return;
        }

        foreach (var property in typeInfo.Properties)
        {
            property.IsRequired = property.Name != RevisionProperty;
        }
    }

    private static string? NameProblem(string name, int? maxLength) =>
        string.IsNullOrWhiteSpace(name) ? "name is empty" : TextProblem("name", name, maxLength);

    private static string? TextProblem(string column, string? text, int? maxLength) =>
        text?.Length > maxLength
            ? string.Create(CultureInfo.InvariantCulture, $"{column} is over {maxLength} characters")
            : null;

    private static string? CountProblem(int count) => count < 1 ? "count is below 1" : null;

    private static string? PlanProblem(Plan plan)
    {
        if (plan.Id != Plan.SingletonId)
        {
            return string.Create(CultureInfo.InvariantCulture, $"the plan's id is not {Plan.SingletonId}");
        }

        return plan.LengthDays is < Plan.MinLengthDays or > Plan.MaxLengthDays
            ? string.Create(CultureInfo.InvariantCulture, $"lengthDays is outside {Plan.MinLengthDays} to {Plan.MaxLengthDays}")
            : null;
    }

    private static string? PlannedMealProblem(PlannedMeal plannedMeal)
    {
        if (plannedMeal.Position < 0)
        {
            return "position is below 0";
        }

        if (plannedMeal.Rank < 0)
        {
            return "rank is below 0";
        }

        return NameProblem(plannedMeal.Name, PlannedMeal.NameMaxLength);
    }
}

/// <summary>One synced table as the wire names it.</summary>
public abstract class SyncTable(string wireName)
{
    /// <summary>The camelCase name of the table on the wire.</summary>
    public string WireName { get; } = wireName;

    /// <summary>The entity type a row of the table deserialises to.</summary>
    public abstract Type RowType { get; }

    /// <summary>Reads every row written after the revision, tombstones included, oldest first.</summary>
    public abstract Task<IReadOnlyList<object>> ReadSinceAsync(HamperDbContext db, long since, CancellationToken ct);

    /// <summary>Reads the rows with the given ids as they stand, oldest first.</summary>
    public abstract Task<IReadOnlyList<object>> ReadByIdsAsync(HamperDbContext db, IReadOnlyCollection<Guid> ids, CancellationToken ct);

    /// <summary>Returns the rule the row breaks, or null when it keeps them all.</summary>
    public abstract string? Validate(ISynced row);

    /// <summary>Adds the row, or copies every column but the revision onto the row stored under its id.</summary>
    public abstract Task UpsertAsync(HamperDbContext db, ISynced row, CancellationToken ct);

    /// <summary>Reads the ids of rows whose foreign keys point at no row, as the open transaction sees them.</summary>
    public abstract Task<IReadOnlyList<Guid>> ReadForeignKeyViolationsAsync(HamperDbContext db, CancellationToken ct);
}

/// <summary>A synced table of rows of type <typeparamref name="T"/>.</summary>
public sealed class SyncTable<T>(string wireName, Func<HamperDbContext, DbSet<T>> rows, Func<T, string?> validate)
    : SyncTable(wireName)
    where T : class, ISynced
{
    public override Type RowType => typeof(T);

    public override async Task<IReadOnlyList<object>> ReadSinceAsync(HamperDbContext db, long since, CancellationToken ct) =>
        await rows(db).AsNoTracking()
            .Where(row => row.Revision > since)
            .OrderBy(row => row.Revision)
            .ToListAsync(ct);

    public override async Task<IReadOnlyList<object>> ReadByIdsAsync(
        HamperDbContext db, IReadOnlyCollection<Guid> ids, CancellationToken ct) =>
        await rows(db).AsNoTracking()
            .Where(row => ids.Contains(row.Id))
            .OrderBy(row => row.Revision)
            .ToListAsync(ct);

    public override string? Validate(ISynced row) => validate((T)row);

    public override async Task UpsertAsync(HamperDbContext db, ISynced row, CancellationToken ct)
    {
        var incomingRow = (T)row;
        var storedRow = await rows(db).FindAsync([incomingRow.Id], ct);
        if (storedRow is null)
        {
            rows(db).Add(incomingRow);
            return;
        }

        // The stamper gives a changed row its revision; an unchanged row keeps the one it has.
        incomingRow.Revision = storedRow.Revision;
        db.Entry(storedRow).CurrentValues.SetValues(incomingRow);
    }

    public override async Task<IReadOnlyList<Guid>> ReadForeignKeyViolationsAsync(HamperDbContext db, CancellationToken ct)
    {
        // The table name comes from the model, never from a request.
        var table = db.Model.FindEntityType(typeof(T))!.GetTableName()!;
        var violationsSql =
            $"SELECT \"Id\" AS \"Value\" FROM \"{table}\" WHERE rowid IN (SELECT rowid FROM pragma_foreign_key_check('{table}'))";
        return await db.Database.SqlQueryRaw<Guid>(violationsSql).ToListAsync(ct);
    }
}
