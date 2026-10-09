using Hamper.Api.Features.Items;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hamper.Api.Tests.Features.Sync;

public sealed class RevisionStamperTests
{
    [Fact]
    public async Task Each_write_takes_the_next_revision()
    {
        using var factory = new HamperApiFactory();
        var ct = TestContext.Current.CancellationToken;
        var startRevision = await CurrentRevisionAsync(factory, ct);

        var firstItem = await TestData.AddItemAsync(factory, "Milk", "4 pints", ct);
        var secondItem = await TestData.AddItemAsync(factory, "Bread", null, ct);

        var storedItems = await ReadItemsAsync(factory, ct);
        Assert.Equal(startRevision + 1, storedItems.Single(item => item.Id == firstItem.Id).Revision);
        Assert.Equal(startRevision + 2, storedItems.Single(item => item.Id == secondItem.Id).Revision);
        Assert.Equal(startRevision + 2, await CurrentRevisionAsync(factory, ct));
    }

    [Fact]
    public async Task A_synchronous_save_takes_the_next_revision()
    {
        using var factory = new HamperApiFactory();
        var ct = TestContext.Current.CancellationToken;
        var startRevision = await CurrentRevisionAsync(factory, ct);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();
        var item = new Item { Id = Guid.NewGuid(), Name = "Eggs" };

        await scope.ServiceProvider.GetRequiredService<WriteGate>().RunAsync(_ =>
        {
            db.Items.Add(item);
            return Task.FromResult(db.SaveChanges());
        }, ct);

        Assert.Equal(startRevision + 1, (await ReadItemsAsync(factory, ct)).Single().Revision);
    }

    [Fact]
    public async Task A_tombstone_takes_a_new_revision()
    {
        using var factory = new HamperApiFactory();
        var ct = TestContext.Current.CancellationToken;
        var item = await TestData.AddItemAsync(factory, "Milk", null, ct);
        var createdRevision = item.Revision;
        var deletedAt = new DateTimeOffset(2026, 5, 1, 12, 0, 0, TimeSpan.Zero);

        await TestData.WriteAsync(factory, (db, _) =>
        {
            db.Items.Attach(item);
            item.DeletedAt = deletedAt;
            return item;
        }, ct);

        var storedItem = (await ReadItemsAsync(factory, ct)).Single();
        Assert.Equal(deletedAt, storedItem.DeletedAt);
        Assert.Equal(createdRevision + 1, storedItem.Revision);
        Assert.Equal(createdRevision + 1, await CurrentRevisionAsync(factory, ct));
    }

    [Fact]
    public async Task Writes_outside_the_gate_are_refused()
    {
        using var factory = new HamperApiFactory();
        var ct = TestContext.Current.CancellationToken;
        var startRevision = await CurrentRevisionAsync(factory, ct);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();

        db.Items.Add(new Item { Id = Guid.NewGuid(), Name = "Milk" });

        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync(ct));
        Assert.Empty(await ReadItemsAsync(factory, ct));
        Assert.Equal(startRevision, await CurrentRevisionAsync(factory, ct));
    }

    [Fact]
    public async Task Concurrent_writes_commit_in_revision_order()
    {
        using var factory = new HamperApiFactory();
        var ct = TestContext.Current.CancellationToken;
        var startRevision = await CurrentRevisionAsync(factory, ct);

        await Task.WhenAll(Enumerable.Range(1, 10)
            .Select(number => Task.Run(() => TestData.AddItemAsync(factory, $"Item {number}", null, ct), ct)));

        var revisions = (await ReadItemsAsync(factory, ct)).Select(item => item.Revision).Order();
        Assert.Equal(Enumerable.Range(1, 10).Select(offset => startRevision + offset), revisions);
        Assert.Equal(startRevision + 10, await CurrentRevisionAsync(factory, ct));
    }

    private static async Task<long> CurrentRevisionAsync(HamperApiFactory factory, CancellationToken ct)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();
        return (await db.SyncState.AsNoTracking().SingleAsync(ct)).CurrentRevision;
    }

    private static async Task<List<Item>> ReadItemsAsync(HamperApiFactory factory, CancellationToken ct)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();
        return await db.Items.AsNoTracking().ToListAsync(ct);
    }
}
