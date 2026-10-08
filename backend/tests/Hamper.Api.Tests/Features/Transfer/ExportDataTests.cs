using System.Net;
using System.Text.Json.Nodes;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Shops;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Hamper.Api.Tests.Features.Transfer;

public sealed class ExportDataTests
{
    private static readonly DateTimeOffset Morning = new(2026, 6, 1, 9, 15, 30, TimeSpan.Zero);

    [Fact]
    public async Task Export_then_import_into_an_empty_instance_round_trips()
    {
        var time = new FakeTimeProvider(Morning);
        using var source = new HamperApiFactory(services => services.AddSingleton<TimeProvider>(time));
        using var target = new HamperApiFactory();
        using var sourceClient = source.CreateClient();
        using var targetClient = target.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        await SeedFullDatasetAsync(source, sourceClient, ct);

        var exportResponse = await sourceClient.GetAsync(new Uri("/api/export", UriKind.Relative), ct);
        var sourceZip = await exportResponse.Content.ReadAsByteArrayAsync(ct);
        var importResponse = await TransferZip.ImportAsync(targetClient, sourceZip, ct);
        var targetZip = await TransferZip.ExportAsync(targetClient, ct);

        Assert.Equal(HttpStatusCode.OK, exportResponse.StatusCode);
        Assert.Equal("application/zip", exportResponse.Content.Headers.ContentType?.MediaType);
        Assert.Equal("hamper-20260601-091530.zip", exportResponse.Content.Headers.ContentDisposition?.FileName);
        Assert.Equal(HttpStatusCode.NoContent, importResponse.StatusCode);
        var sourceData = TransferZip.ReadDataJson(sourceZip);
        var targetData = TransferZip.ReadDataJson(targetZip);
        Assert.Equal(1, (int)sourceData["format"]!);
        Assert.Equal("2026-04-20", (string?)sourceData["plan"]!["startDate"]);
        foreach (var table in new[] { "items", "meals", "mealLines", "days", "dayLines", "wantedLines", "shops", "shopLines", "archivedShops" })
        {
            Assert.NotEmpty(sourceData[table]!.AsArray());
        }

        sourceData.Remove("exportedAt");
        targetData.Remove("exportedAt");
        Assert.True(JsonNode.DeepEquals(sourceData, targetData), $"{sourceData}\n---\n{targetData}");
    }

    [Fact]
    public async Task Export_leaves_out_tombstones()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);
        var deletedItem = await TestData.AddItemAsync(factory, "Old crisps", null, ct);
        await TestData.WriteAsync(factory, (db, now) =>
        {
            db.Items.Attach(deletedItem);
            deletedItem.DeletedAt = now;
            return deletedItem;
        }, ct);
        var archivedShop = await TestData.AddShopAsync(factory, new ShopSeed("Archived"), [new ShopLineSeed(milk, 1)], ct);
        var archiveResponse = await client.PostAsync(new Uri($"/api/shops/{archivedShop.Shop.Id}/archive", UriKind.Relative), null, ct);

        var data = TransferZip.ReadDataJson(await TransferZip.ExportAsync(client, ct));

        Assert.Equal(HttpStatusCode.OK, archiveResponse.StatusCode);
        var exportedItem = Assert.Single(data["items"]!.AsArray())!.AsObject();
        Assert.Equal(milk.Id.ToString(), (string?)exportedItem["id"]);
        Assert.Equal(["id", "name", "size"], exportedItem.Select(property => property.Key));
        Assert.Empty(data["shops"]!.AsArray());
        Assert.Empty(data["shopLines"]!.AsArray());
        Assert.Single(data["archivedShops"]!.AsArray());
    }

    [Fact]
    public async Task Export_keeps_deleted_items_that_open_shop_lines_point_at()
    {
        using var source = new HamperApiFactory();
        using var target = new HamperApiFactory();
        using var sourceClient = source.CreateClient();
        using var targetClient = target.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var deletedItem = await TestData.AddItemAsync(source, "Old crisps", null, ct);
        await TestData.AddShopAsync(source, new ShopSeed("Top-up"), [new ShopLineSeed(deletedItem, 1)], ct);
        await TestData.WriteAsync(source, (db, now) =>
        {
            db.Items.Attach(deletedItem);
            deletedItem.DeletedAt = now;
            return deletedItem;
        }, ct);

        var sourceZip = await TransferZip.ExportAsync(sourceClient, ct);
        var importResponse = await TransferZip.ImportAsync(targetClient, sourceZip, ct);

        var exportedItem = Assert.Single(TransferZip.ReadDataJson(sourceZip)["items"]!.AsArray());
        Assert.Equal(deletedItem.Id.ToString(), (string?)exportedItem!["id"]);
        Assert.Equal(HttpStatusCode.NoContent, importResponse.StatusCode);
    }

    /// <summary>Puts a row in every exported table: items, a meal, two days, wanted lines, an open shop, an archived shop, and a moved plan.</summary>
    private static async Task SeedFullDatasetAsync(HamperApiFactory factory, HttpClient client, CancellationToken ct)
    {
        var milk = await TestData.AddItemAsync(factory, "Milk", "4 pints", ct);
        var rice = await TestData.AddItemAsync(factory, "Rice", "1kg bag", ct);
        var chicken = await TestData.AddItemAsync(factory, "Chicken thighs", null, ct);
        var curry = await TestData.AddMealAsync(factory, "Curry", [(chicken, 1), (rice, 1)], ct);
        await TestData.AddDayAsync(factory, 0, "Curry", curry.Meal.Id, [(chicken, 1), (rice, 2)], ct);
        await TestData.AddDayAsync(factory, 1, "Takeaway", null, [], ct);
        await TestData.AddWantedLineAsync(factory, milk, 2, weekly: true, ct);
        await TestData.AddWantedLineAsync(factory, rice, 1, weekly: false, ct);
        var meals = new List<ShopMeal> { new(0, "Curry", curry.Meal.Id), new(1, "Takeaway", null) };
        await TestData.AddShopAsync(
            factory,
            new ShopSeed("Big shop", FromPlan: true, PlanStartDate: new DateOnly(2026, 4, 20), PlanLengthDays: 7, Meals: meals),
            [
                new ShopLineSeed(milk, 2, Sources: ["wanted"], Ticked: true),
                new ShopLineSeed(rice, 3, NameOverride: "Basmati", SizeOverride: "2kg", Sources: ["Curry", "wanted"]),
            ],
            ct);
        var archivedShop = await TestData.AddShopAsync(factory, new ShopSeed("Last week"), [new ShopLineSeed(milk, 1)], ct);
        var archiveResponse = await client.PostAsync(new Uri($"/api/shops/{archivedShop.Shop.Id}/archive", UriKind.Relative), null, ct);
        Assert.Equal(HttpStatusCode.OK, archiveResponse.StatusCode);
        await TestData.WriteAsync(factory, (db, _) =>
        {
            var plan = db.Plans.Single(row => row.Id == Plan.SingletonId);
            plan.StartDate = new DateOnly(2026, 4, 20);
            plan.LengthDays = 10;
            return plan;
        }, ct);
    }
}
