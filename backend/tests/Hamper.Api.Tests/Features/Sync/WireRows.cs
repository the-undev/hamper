using System.Text.Json.Nodes;
using Hamper.Api.Features.Plans;

namespace Hamper.Api.Tests.Features.Sync;

/// <summary>Builds rows as a client pushes them: every column but the revision.</summary>
internal static class WireRows
{
    public static readonly DateTimeOffset Morning = new(2026, 6, 1, 9, 0, 0, TimeSpan.Zero);

    public static JsonObject Item(Guid id, string name, string? size = null, DateTimeOffset? deletedAt = null, Guid? imageId = null) =>
        new() { ["id"] = id, ["deletedAt"] = deletedAt, ["name"] = name, ["size"] = size, ["imageId"] = imageId };

    public static JsonObject Meal(Guid id, string name, Guid? imageId = null) =>
        new() { ["id"] = id, ["deletedAt"] = null, ["name"] = name, ["imageId"] = imageId };

    public static JsonObject MealLine(Guid id, Guid mealId, Guid itemId, int count) =>
        new() { ["id"] = id, ["deletedAt"] = null, ["mealId"] = mealId, ["itemId"] = itemId, ["count"] = count };

    public static JsonObject Plan(Guid id, int lengthDays) =>
        new() { ["id"] = id, ["deletedAt"] = null, ["startDate"] = "2026-06-01", ["lengthDays"] = lengthDays };

    public static JsonObject Day(int position, string name, Guid? mealId = null, Guid? id = null) =>
        new()
        {
            ["id"] = id ?? Hamper.Api.Features.Plans.Day.IdFor(position),
            ["deletedAt"] = null,
            ["position"] = position,
            ["name"] = name,
            ["mealId"] = mealId,
        };

    public static JsonObject DayLine(Guid id, Guid dayId, Guid itemId, int count) =>
        new() { ["id"] = id, ["deletedAt"] = null, ["dayId"] = dayId, ["itemId"] = itemId, ["count"] = count };

    public static JsonObject WantedLine(Guid id, Guid itemId, int count, bool weekly = false) =>
        new() { ["id"] = id, ["deletedAt"] = null, ["itemId"] = itemId, ["count"] = count, ["weekly"] = weekly };

    public static JsonObject Shop(Guid id, string name, Guid? mealId) =>
        new()
        {
            ["id"] = id,
            ["deletedAt"] = null,
            ["name"] = name,
            ["createdAt"] = Morning,
            ["fromPlan"] = true,
            ["planStartDate"] = "2026-06-01",
            ["planLengthDays"] = 7,
            ["meals"] = new JsonArray(new JsonObject { ["position"] = 0, ["name"] = "Curry", ["mealId"] = mealId }),
        };

    public static JsonObject ShopLine(Guid id, Guid shopId, Guid itemId, int count) =>
        new()
        {
            ["id"] = id,
            ["deletedAt"] = null,
            ["shopId"] = shopId,
            ["itemId"] = itemId,
            ["count"] = count,
            ["nameOverride"] = "Semi-skimmed",
            ["sizeOverride"] = null,
            ["sources"] = new JsonArray("Monday", "wanted"),
            ["ticked"] = true,
            ["createdAt"] = Morning.AddMinutes(5),
        };

    /// <summary>The id of the one plan row.</summary>
    public static Guid PlanId => Hamper.Api.Features.Plans.Plan.SingletonId;
}
