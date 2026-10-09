using System.Net;
using System.Net.Http.Json;
using Hamper.Api.Features.History;
using Hamper.Api.Features.Items;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Hamper.Api.Tests.Features.History;

public sealed class HistoryTests
{
    private static readonly DateTimeOffset Morning = new(2026, 6, 1, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Archived_text_survives_renaming_the_item()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", "4 pints", ct);
        var shop = await TestData.AddShopAsync(factory, new ShopSeed("Top-up"), [new ShopLineSeed(milk, 1)], ct);
        await ArchiveAsync(client, shop.Shop.Id, ct);

        await TestData.WriteAsync(factory, (db, _) =>
        {
            db.Items.Attach(milk);
            milk.Name = "Oat milk";
            milk.Size = "1 litre";
            return milk;
        }, ct);
        var archived = await client.GetFromJsonAsync<ArchivedShopResponse>(
            new Uri($"/api/history/{shop.Shop.Id}", UriKind.Relative), ct);

        var line = Assert.Single(archived!.Lines);
        Assert.Equal(("Milk", "4 pints"), (line.Name, line.Size));
    }

    [Fact]
    public async Task History_lists_newest_first()
    {
        var time = new FakeTimeProvider(Morning);
        using var factory = new HamperApiFactory(services => services.AddSingleton<TimeProvider>(time));
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);
        var olderShop = await TestData.AddShopAsync(factory, new ShopSeed("Older"), [new ShopLineSeed(milk, 1)], ct);
        var newerShop = await TestData.AddShopAsync(factory, new ShopSeed("Newer"), [], ct);
        await ArchiveAsync(client, olderShop.Shop.Id, ct);
        time.Advance(TimeSpan.FromDays(7));
        await ArchiveAsync(client, newerShop.Shop.Id, ct);

        var history = await client.GetFromJsonAsync<List<HistoryEntry>>(new Uri("/api/history", UriKind.Relative), ct);

        Assert.Collection(
            history!,
            entry =>
            {
                Assert.Equal(("Newer", 0), (entry.Name, entry.LineCount));
                Assert.Equal(Morning.AddDays(7), entry.ArchivedAt);
            },
            entry =>
            {
                Assert.Equal(("Older", 1), (entry.Name, entry.LineCount));
                Assert.Equal(Morning, entry.ArchivedAt);
            });
    }

    [Fact]
    public async Task History_get_returns_lines()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);
        var bread = await TestData.AddItemAsync(factory, "Bread", "loaf", ct);
        var shop = await TestData.AddShopAsync(
            factory,
            new ShopSeed("Top-up"),
            [new ShopLineSeed(milk, 2, Ticked: true), new ShopLineSeed(bread, 1)],
            ct);
        await ArchiveAsync(client, shop.Shop.Id, ct);

        var archived = await client.GetFromJsonAsync<ArchivedShopResponse>(
            new Uri($"/api/history/{shop.Shop.Id}", UriKind.Relative), ct);

        Assert.Equal("Top-up", archived!.Name);
        Assert.Equal(
            [("Milk", (string?)null, 2, true), ("Bread", "loaf", 1, false)],
            archived.Lines.Select(line => (line.Name, line.Size, line.Count, line.Ticked)));
    }

    [Fact]
    public async Task History_get_unknown_is_404()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri($"/api/history/{Guid.NewGuid()}", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(ct);
        Assert.Equal("Archived shop not found", problem?.Title);
    }

    private static async Task ArchiveAsync(HttpClient client, Guid shopId, CancellationToken ct)
    {
        var response = await client.PostAsync(new Uri($"/api/shops/{shopId}/archive", UriKind.Relative), null, ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
