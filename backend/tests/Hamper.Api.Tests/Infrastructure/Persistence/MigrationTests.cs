using Hamper.Api.Features.Meals;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Hamper.Api.Tests.Infrastructure.Persistence;

public sealed class MigrationTests
{
    [Fact]
    public async Task Fresh_database_migrates_and_seeds_the_plan_and_sync_state()
    {
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 3, 14, 9, 30, 0, TimeSpan.Zero));
        using var factory = new HamperApiFactory(services => services.AddSingleton<TimeProvider>(time));
        var ct = TestContext.Current.CancellationToken;
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();

        var plan = await db.Plans.SingleAsync(ct);
        var syncState = await db.SyncState.SingleAsync(ct);

        Assert.Empty(await db.Database.GetPendingMigrationsAsync(ct));
        Assert.Equal(Plan.SingletonId, plan.Id);
        Assert.Equal(new DateOnly(2026, 3, 14), plan.StartDate);
        Assert.Equal(7, plan.LengthDays);
        Assert.Null(plan.DeletedAt);
        Assert.Equal(1, plan.Revision);
        Assert.Equal(SyncState.SingletonId, syncState.Id);
        Assert.Equal(1, syncState.CurrentRevision);
    }

    [Fact]
    public async Task Foreign_keys_are_enforced()
    {
        using var factory = new HamperApiFactory();
        var ct = TestContext.Current.CancellationToken;
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();

        db.MealLines.Add(new MealLine { Id = Guid.NewGuid(), MealId = Guid.NewGuid(), ItemId = Guid.NewGuid(), Count = 1 });

        var error = await Assert.ThrowsAsync<DbUpdateException>(() =>
            scope.ServiceProvider.GetRequiredService<WriteGate>().RunAsync(token => db.SaveChangesAsync(token), ct));
        Assert.Contains("FOREIGN KEY", error.InnerException?.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_day_on_the_previous_schema_becomes_a_planned_meal_at_rank_0_with_its_line()
    {
        using var dataDir = new TempDirectory();
        var ct = TestContext.Current.CancellationToken;
        var options = new DbContextOptionsBuilder<HamperDbContext>()
            .UseSqlite($"Data Source={dataDir.Sub("previous.db")}")
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options;
        await using var db = new HamperDbContext(options);
        var itemId = Guid.NewGuid();
        var mealId = Guid.NewGuid();
        var dayId = Guid.NewGuid();
        var dayLineId = Guid.NewGuid();
        await db.GetService<IMigrator>().MigrateAsync("20261008153303_AddImages", cancellationToken: ct);
        await db.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO items ("Id", "Revision", "DeletedAt", "Name", "Size", "ImageId") VALUES ({Text(itemId)}, 2, NULL, 'Rice', NULL, NULL);
            INSERT INTO meals ("Id", "Revision", "DeletedAt", "Name", "ImageId") VALUES ({Text(mealId)}, 3, NULL, 'Curry', NULL);
            INSERT INTO days ("Id", "Revision", "DeletedAt", "Position", "Name", "MealId") VALUES ({Text(dayId)}, 4, NULL, 3, 'Curry', {Text(mealId)});
            INSERT INTO day_lines ("Id", "Revision", "DeletedAt", "DayId", "ItemId", "Count") VALUES ({Text(dayLineId)}, 5, NULL, {Text(dayId)}, {Text(itemId)}, 2);
            """,
            ct);

        await db.Database.MigrateAsync(ct);

        var plannedMeal = Assert.Single(await db.PlannedMeals.AsNoTracking().ToListAsync(ct));
        var line = Assert.Single(await db.PlannedMealLines.AsNoTracking().ToListAsync(ct));
        Assert.Equal((dayId, 4L, 3, 0, "Curry", (Guid?)mealId), (plannedMeal.Id, plannedMeal.Revision, plannedMeal.Position, plannedMeal.Rank, plannedMeal.Name, plannedMeal.MealId));
        Assert.Null(plannedMeal.DeletedAt);
        Assert.Equal((dayLineId, 5L, dayId, itemId, 2), (line.Id, line.Revision, line.PlannedMealId, line.ItemId, line.Count));
    }

    /// <summary>A guid as EF Core stores it in SQLite, upper case.</summary>
    private static string Text(Guid id) => id.ToString().ToUpperInvariant();
}
