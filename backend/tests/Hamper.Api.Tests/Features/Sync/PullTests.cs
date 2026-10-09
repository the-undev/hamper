using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Hamper.Api.Features.Shops;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace Hamper.Api.Tests.Features.Sync;

public sealed class PullTests
{
    [Fact]
    public async Task Pull_from_zero_returns_everything_and_the_current_revision()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", "4 pints", ct);
        var curry = await TestData.AddMealAsync(factory, "Curry", [(milk, 1)], ct);
        await TestData.AddDayAsync(factory, 0, "Curry", curry.Meal.Id, [(milk, 2)], ct);
        await TestData.AddWantedLineAsync(factory, milk, 1, weekly: true, ct);
        await TestData.AddShopAsync(
            factory,
            new ShopSeed("Big shop", Meals: [new ShopMeal(0, "Curry", curry.Meal.Id)]),
            [new ShopLineSeed(milk, 3, Sources: ["Monday", "extras"])],
            ct);

        var pulled = await SyncApi.PullAsync(client, 0, ct);

        Assert.Equal(["revision", .. SyncApi.TableNames], pulled.Select(property => property.Key));
        Assert.Equal(await CurrentRevisionAsync(factory, ct), (long)pulled["revision"]!);
        Assert.All(SyncApi.TableNames, table => Assert.Single(pulled[table]!.AsArray()));
        Assert.Equal((long)pulled["revision"]!, SyncApi.AllRows(pulled).Max(row => (long)row["revision"]!));
        var item = pulled["items"]![0]!.AsObject();
        Assert.Equal(["id", "revision", "deletedAt", "name", "size", "imageId"], item.Select(property => property.Key));
        Assert.Equal((milk.Id.ToString(), "Milk", "4 pints"), ((string?)item["id"], (string?)item["name"], (string?)item["size"]));
        Assert.Null(item["deletedAt"]);
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", (string?)pulled["plan"]![0]!["startDate"]);
        Assert.Equal(curry.Meal.Id.ToString(), (string?)pulled["shops"]![0]!["meals"]![0]!["mealId"]);
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}T[\d:.]+[+-]\d{2}:\d{2}$", (string?)pulled["shops"]![0]!["createdAt"]);
        Assert.Equal(["Monday", "extras"], pulled["shopLines"]![0]!["sources"]!.AsArray().Select(source => (string?)source));
    }

    [Fact]
    public async Task Pull_since_returns_only_rows_above_the_cursor()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);
        var bread = await TestData.AddItemAsync(factory, "Bread", null, ct);

        var pulled = await SyncApi.PullAsync(client, milk.Revision, ct);

        Assert.Equal(bread.Revision, (long)pulled["revision"]!);
        var pulledRow = Assert.Single(SyncApi.AllRows(pulled));
        Assert.Equal(bread.Id.ToString(), (string?)pulledRow["id"]);
        Assert.Single(pulled["items"]!.AsArray());
    }

    [Fact]
    public async Task Pull_includes_tombstones()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var item = await TestData.AddItemAsync(factory, "Old crisps", null, ct);
        var deletedAt = new DateTimeOffset(2026, 5, 1, 12, 0, 0, TimeSpan.Zero);
        await TestData.WriteAsync(factory, (db, _) =>
        {
            db.Items.Attach(item);
            item.DeletedAt = deletedAt;
            return item;
        }, ct);

        var pulled = await SyncApi.PullAsync(client, 0, ct);

        var pulledItem = Assert.Single(pulled["items"]!.AsArray())!;
        Assert.Equal(item.Id.ToString(), (string?)pulledItem["id"]);
        Assert.Equal(deletedAt, pulledItem["deletedAt"]!.GetValue<DateTimeOffset>());
    }

    [Fact]
    public async Task Pull_with_a_negative_cursor_is_400()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/sync?since=-1", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(ct);
        Assert.Equal("Bad cursor", problem?.Title);
    }

    [Fact]
    public async Task Pull_reads_one_snapshot()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        await TestData.AddItemAsync(factory, "Milk", null, ct);

        var pulls = new List<JsonObject>();
        for (var round = 0; round < 50; round++)
        {
            var pull = Task.Run(() => SyncApi.PullAsync(client, 0, ct), ct);
            var write = Task.Run(() => TestData.AddItemAsync(factory, $"Item {round}", null, ct), ct);
            await Task.WhenAll(pull, write);
            pulls.Add(await pull);
        }

        Assert.All(pulls, pulled =>
            Assert.All(SyncApi.AllRows(pulled), row => Assert.True((long)row["revision"]! <= (long)pulled["revision"]!)));
    }

    private static async Task<long> CurrentRevisionAsync(HamperApiFactory factory, CancellationToken ct)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<HamperDbContext>().CurrentRevisionAsync(ct);
    }
}
