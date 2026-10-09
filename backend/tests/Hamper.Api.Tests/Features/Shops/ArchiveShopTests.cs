using System.Net;
using System.Net.Http.Json;
using Hamper.Api.Features.History;
using Hamper.Api.Features.Shops;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Hamper.Api.Tests.Features.Shops;

public sealed class ArchiveShopTests
{
    private static readonly DateTimeOffset Morning = new(2026, 6, 1, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Archive_copies_the_shop_as_text_and_tombstones_it()
    {
        var time = new FakeTimeProvider(Morning);
        using var factory = new HamperApiFactory(services => services.AddSingleton<TimeProvider>(time));
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", "4 pints", ct);
        var bread = await TestData.AddItemAsync(factory, "Bread", "loaf", ct);
        var eggs = await TestData.AddItemAsync(factory, "Eggs", null, ct);
        var curry = await TestData.AddMealAsync(factory, "Curry", [], ct);
        var meals = new List<ShopMeal> { new(0, "Curry", curry.Meal.Id), new(1, "Takeaway", null) };
        var shop = await TestData.AddShopAsync(
            factory,
            new ShopSeed("Big shop", FromPlan: true, PlanStartDate: new DateOnly(2026, 6, 1), PlanLengthDays: 7, Meals: meals),
            [
                new ShopLineSeed(milk, 2, Sources: ["Monday", "wanted"], Ticked: true),
                new ShopLineSeed(bread, 1, NameOverride: "Sourdough", SizeOverride: "small"),
                new ShopLineSeed(eggs, 6),
            ],
            ct);
        var removedLine = shop.Lines.Single(line => line.ItemId == eggs.Id);
        await TestData.WriteAsync(factory, (db, now) =>
        {
            db.ShopLines.Attach(removedLine);
            removedLine.DeletedAt = now;
            return removedLine;
        }, ct);
        var revisionBeforeArchive = removedLine.Revision;
        time.Advance(TimeSpan.FromHours(3));

        var response = await client.PostAsync(new Uri($"/api/shops/{shop.Shop.Id}/archive", UriKind.Relative), null, ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var archived = await response.Content.ReadFromJsonAsync<ArchivedShopResponse>(ct);
        Assert.NotNull(archived);
        Assert.Equal(shop.Shop.Id, archived.Id);
        Assert.Equal("Big shop", archived.Name);
        Assert.Equal(Morning, archived.CreatedAt);
        Assert.Equal(Morning.AddHours(3), archived.ArchivedAt);
        Assert.Equal(new DateOnly(2026, 6, 1), archived.PlanStartDate);
        Assert.Equal(7, archived.PlanLengthDays);
        Assert.Equal(meals, archived.Meals);
        Assert.Collection(
            archived.Lines,
            line =>
            {
                Assert.Equal(("Milk", "4 pints", 2, true), (line.Name, line.Size, line.Count, line.Ticked));
                Assert.Equal(["Monday", "wanted"], line.Sources);
            },
            line => Assert.Equal(("Sourdough", "small", 1, false), (line.Name, line.Size, line.Count, line.Ticked)));

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();
        var storedShop = await db.Shops.AsNoTracking().SingleAsync(ct);
        var storedLines = await db.ShopLines.AsNoTracking().Where(line => line.Id != removedLine.Id).ToListAsync(ct);
        Assert.Equal(Morning.AddHours(3), storedShop.DeletedAt);
        Assert.True(storedShop.Revision > revisionBeforeArchive);
        Assert.Equal(2, storedLines.Count);
        Assert.All(storedLines, line =>
        {
            Assert.Equal(Morning.AddHours(3), line.DeletedAt);
            Assert.True(line.Revision > revisionBeforeArchive);
        });
        Assert.Equal(revisionBeforeArchive, (await db.ShopLines.AsNoTracking().SingleAsync(line => line.Id == removedLine.Id, ct)).Revision);
        Assert.Single(await db.ArchivedShops.AsNoTracking().ToListAsync(ct));
    }

    [Fact]
    public async Task Archive_of_an_unknown_shop_is_404()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.PostAsync(new Uri($"/api/shops/{Guid.NewGuid()}/archive", UriKind.Relative), null, ct);

        await AssertShopNotFoundAsync(response, ct);
    }

    [Fact]
    public async Task Archive_of_an_archived_shop_is_404()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var shop = await TestData.AddShopAsync(factory, new ShopSeed("Top-up"), [], ct);
        var archiveUri = new Uri($"/api/shops/{shop.Shop.Id}/archive", UriKind.Relative);
        var firstResponse = await client.PostAsync(archiveUri, null, ct);

        var secondResponse = await client.PostAsync(archiveUri, null, ct);

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        await AssertShopNotFoundAsync(secondResponse, ct);
    }

    private static async Task AssertShopNotFoundAsync(HttpResponseMessage response, CancellationToken ct)
    {
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(ct);
        Assert.Equal("Shop not found", problem?.Title);
    }
}
