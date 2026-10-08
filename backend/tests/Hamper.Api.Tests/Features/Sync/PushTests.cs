using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hamper.Api.Tests.Features.Sync;

public sealed class PushTests
{
    [Fact]
    public async Task Push_inserts_new_rows_and_assigns_revisions()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var startRevision = await CurrentRevisionAsync(factory, ct);
        var milkId = Guid.NewGuid();
        var curryId = Guid.NewGuid();

        var pushed = await SyncApi.PushAcceptedAsync(
            client,
            [new SyncChange("c1", "items", WireRows.Item(milkId, "Milk", "4 pints")), new SyncChange("c2", "meals", WireRows.Meal(curryId, "Curry"))],
            ct);

        Assert.Equal(startRevision + 2, (long)pushed["revision"]!);
        Assert.Equal(["c1", "c2"], pushed["applied"]!.AsArray().Select(changeId => (string?)changeId));
        var rows = pushed["rows"]!.AsObject();
        Assert.Equal(SyncApi.TableNames, rows.Select(property => property.Key));
        Assert.Equal(startRevision + 1, (long)rows["items"]![0]!["revision"]!);
        Assert.Equal(startRevision + 2, (long)rows["meals"]![0]!["revision"]!);
        Assert.Equal(2, SyncApi.AllRows(rows).Count());
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();
        var storedItem = await db.Items.AsNoTracking().SingleAsync(ct);
        Assert.Equal((milkId, "Milk", "4 pints", startRevision + 1), (storedItem.Id, storedItem.Name, storedItem.Size, storedItem.Revision));
    }

    [Fact]
    public async Task Push_updates_an_existing_row_and_last_writer_wins()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milkId = Guid.NewGuid();
        var first = await SyncApi.PushAcceptedAsync(client, [new SyncChange("c1", "items", WireRows.Item(milkId, "Milk", "1 pint"))], ct);

        var second = await SyncApi.PushAcceptedAsync(client, [new SyncChange("c2", "items", WireRows.Item(milkId, "Oat milk", "1 litre"))], ct);

        var pulledItem = Assert.Single((await SyncApi.PullAsync(client, 0, ct))["items"]!.AsArray())!;
        Assert.Equal(("Oat milk", "1 litre"), ((string?)pulledItem["name"], (string?)pulledItem["size"]));
        Assert.Equal((long)second["revision"]!, (long)pulledItem["revision"]!);
        Assert.True((long)second["revision"]! > (long)first["revision"]!);
        Assert.Equal("Oat milk", (string?)second["rows"]!["items"]![0]!["name"]);
    }

    [Fact]
    public async Task Push_applies_a_tombstone()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milkId = Guid.NewGuid();
        var deletedAt = WireRows.Morning.AddDays(1);
        await SyncApi.PushAcceptedAsync(client, [new SyncChange("c1", "items", WireRows.Item(milkId, "Milk"))], ct);

        var pushed = await SyncApi.PushAcceptedAsync(
            client, [new SyncChange("c2", "items", WireRows.Item(milkId, "Milk", deletedAt: deletedAt))], ct);

        Assert.Equal(deletedAt, pushed["rows"]!["items"]![0]!["deletedAt"]!.GetValue<DateTimeOffset>());
        var pulledItem = Assert.Single((await SyncApi.PullAsync(client, 0, ct))["items"]!.AsArray())!;
        Assert.Equal(deletedAt, pulledItem["deletedAt"]!.GetValue<DateTimeOffset>());
    }

    [Fact]
    public async Task Push_accepts_an_image_id()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milkId = Guid.NewGuid();
        var curryId = Guid.NewGuid();
        var milkImageId = Guid.NewGuid();

        await SyncApi.PushAcceptedAsync(
            client,
            [
                new SyncChange("c1", "items", WireRows.Item(milkId, "Milk", imageId: milkImageId)),
                new SyncChange("c2", "meals", WireRows.Meal(curryId, "Curry")),
            ],
            ct);

        var pulled = await SyncApi.PullAsync(client, 0, ct);
        Assert.Equal(milkImageId, pulled["items"]![0]!["imageId"]!.GetValue<Guid>());
        Assert.Null(pulled["meals"]![0]!["imageId"]);
        Assert.True(pulled["meals"]![0]!.AsObject().ContainsKey("imageId"));
    }

    [Fact]
    public async Task Push_rejects_an_image_id_that_is_not_a_guid()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var row = WireRows.Item(Guid.NewGuid(), "Milk");
        row["imageId"] = "photo.jpg";

        var response = await SyncApi.PushAsync(client, [new SyncChange("c1", "items", row)], ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(ct);
        Assert.StartsWith("Change c1: the row does not fit items", problem?.Detail, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Push_rejects_an_unknown_table()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await SyncApi.PushAsync(client, [new SyncChange("c1", "recipes", WireRows.Meal(Guid.NewGuid(), "Curry"))], ct);

        await AssertRejectedAsync(response, "Change c1: unknown table \"recipes\"", ct);
    }

    [Fact]
    public async Task Push_rejects_a_bad_count_and_applies_nothing()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var startRevision = await CurrentRevisionAsync(factory, ct);
        var milkId = Guid.NewGuid();

        var response = await SyncApi.PushAsync(
            client,
            [new SyncChange("c1", "items", WireRows.Item(milkId, "Milk")), new SyncChange("c2", "wantedLines", WireRows.WantedLine(Guid.NewGuid(), milkId, 0))],
            ct);

        await AssertRejectedAsync(response, "Change c2: count is below 1", ct);
        await AssertNothingWrittenAsync(factory, startRevision, ct);
    }

    [Fact]
    public async Task Push_rejects_a_day_with_the_wrong_id()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await SyncApi.PushAsync(
            client, [new SyncChange("c1", "days", WireRows.Day(1, "Takeaway", id: Day.IdFor(2)))], ct);

        await AssertRejectedAsync(response, $"Change c1: a day at position 1 has the id {Day.IdFor(1)}", ct);
    }

    [Fact]
    public async Task Push_rejects_a_plan_row_with_the_wrong_id()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await SyncApi.PushAsync(client, [new SyncChange("c1", "plan", WireRows.Plan(Guid.NewGuid(), 7))], ct);

        await AssertRejectedAsync(response, $"Change c1: the plan's id is not {Plan.SingletonId}", ct);
    }

    [Fact]
    public async Task Push_accepts_a_line_before_its_item_in_the_same_batch()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milkId = Guid.NewGuid();
        var wantedLineId = Guid.NewGuid();

        var pushed = await SyncApi.PushAcceptedAsync(
            client,
            [new SyncChange("c1", "wantedLines", WireRows.WantedLine(wantedLineId, milkId, 2)), new SyncChange("c2", "items", WireRows.Item(milkId, "Milk"))],
            ct);

        Assert.Equal(["c1", "c2"], pushed["applied"]!.AsArray().Select(changeId => (string?)changeId));
        Assert.Equal(milkId.ToString(), (string?)pushed["rows"]!["wantedLines"]![0]!["itemId"]);
    }

    [Fact]
    public async Task Push_rejects_a_line_whose_item_never_arrives()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var startRevision = await CurrentRevisionAsync(factory, ct);

        var response = await SyncApi.PushAsync(
            client,
            [new SyncChange("c1", "items", WireRows.Item(Guid.NewGuid(), "Bread")), new SyncChange("c2", "wantedLines", WireRows.WantedLine(Guid.NewGuid(), Guid.NewGuid(), 1))],
            ct);

        await AssertRejectedAsync(response, "Change c2: a foreign key points at a row that does not exist", ct);
        await AssertNothingWrittenAsync(factory, startRevision, ct);
    }

    [Fact]
    public async Task Push_of_an_empty_batch_returns_the_current_revision()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var startRevision = await CurrentRevisionAsync(factory, ct);

        var pushed = await SyncApi.PushAcceptedAsync(client, [], ct);

        Assert.Equal(startRevision, (long)pushed["revision"]!);
        Assert.Empty(pushed["applied"]!.AsArray());
        Assert.Equal(SyncApi.TableNames, pushed["rows"]!.AsObject().Select(property => property.Key));
        Assert.Empty(SyncApi.AllRows(pushed["rows"]!.AsObject()));
    }

    [Fact]
    public async Task Push_then_pull_round_trips_every_table()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milkId = Guid.NewGuid();
        var curryId = Guid.NewGuid();
        var shopId = Guid.NewGuid();
        var pushedRows = new Dictionary<string, JsonObject>
        {
            ["items"] = WireRows.Item(milkId, "Milk", "4 pints"),
            ["meals"] = WireRows.Meal(curryId, "Curry"),
            ["mealLines"] = WireRows.MealLine(Guid.NewGuid(), curryId, milkId, 1),
            ["plan"] = WireRows.Plan(WireRows.PlanId, 14),
            ["days"] = WireRows.Day(0, "Curry", curryId),
            ["dayLines"] = WireRows.DayLine(Guid.NewGuid(), Day.IdFor(0), milkId, 2),
            ["wantedLines"] = WireRows.WantedLine(Guid.NewGuid(), milkId, 1, weekly: true),
            ["shops"] = WireRows.Shop(shopId, "Big shop", curryId),
            ["shopLines"] = WireRows.ShopLine(Guid.NewGuid(), shopId, milkId, 3),
        };
        await SyncApi.PushAcceptedAsync(
            client, pushedRows.Select(pair => new SyncChange($"change-{pair.Key}", pair.Key, pair.Value.DeepClone().AsObject())), ct);

        var pulled = await SyncApi.PullAsync(client, 0, ct);

        Assert.All(SyncApi.TableNames, table =>
        {
            var pulledRow = Assert.Single(pulled[table]!.AsArray())!.AsObject();
            Assert.True(pulledRow.Remove("revision"));
            Assert.True(JsonNode.DeepEquals(pushedRows[table], pulledRow), $"{table}: {pushedRows[table]}\n---\n{pulledRow}");
        });
    }

    private static async Task AssertRejectedAsync(HttpResponseMessage response, string detail, CancellationToken ct)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(ct);
        Assert.Equal("Push rejected", problem?.Title);
        Assert.Equal(detail, problem?.Detail);
    }

    private static async Task AssertNothingWrittenAsync(HamperApiFactory factory, long startRevision, CancellationToken ct)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();
        Assert.Equal(startRevision, await db.CurrentRevisionAsync(ct));
        Assert.Empty(await db.Items.AsNoTracking().ToListAsync(ct));
        Assert.Empty(await db.WantedLines.AsNoTracking().ToListAsync(ct));
    }

    private static async Task<long> CurrentRevisionAsync(HamperApiFactory factory, CancellationToken ct)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<HamperDbContext>().CurrentRevisionAsync(ct);
    }
}
