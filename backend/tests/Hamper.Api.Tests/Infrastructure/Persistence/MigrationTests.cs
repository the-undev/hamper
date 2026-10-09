using Hamper.Api.Features.Meals;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
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
}
