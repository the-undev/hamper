using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Transfer;

/// <summary>Returns a zip holding data.json with every live row, the deleted items and meals that live rows point at, and all of history.</summary>
public sealed class ExportData : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/api/export", async (HamperDbContext db, WriteGate gate, TimeProvider time, CancellationToken ct) =>
        {
            // Read inside the gate so no write lands between the table reads.
            var document = await gate.RunAsync(token => ReadAsync(db, time.GetUtcNow(), token), ct);
            var fileName = string.Create(CultureInfo.InvariantCulture, $"hamper-{time.GetLocalNow():yyyyMMdd-HHmmss}.zip");
            return Results.File(await ZipAsync(document, ct), "application/zip", fileName);
        });

    private static async Task<TransferDocument> ReadAsync(HamperDbContext db, DateTimeOffset exportedAt, CancellationToken ct)
    {
        var plan = await db.Plans.AsNoTracking().SingleAsync(row => row.Id == Plan.SingletonId, ct);
        var mealLines = await db.MealLines.AsNoTracking().Live().ToListAsync(ct);
        var dayLines = await db.DayLines.AsNoTracking().Live().ToListAsync(ct);
        var wantedLines = await db.WantedLines.AsNoTracking().Live().ToListAsync(ct);
        var shopLines = await db.ShopLines.AsNoTracking().Live().ToListAsync(ct);

        var days = await db.Days.AsNoTracking().Live().ToListAsync(ct);

        // A live row may point at a deleted item or meal, so those are exported as tombstones and every reference resolves on import.
        var referencedItemIds = mealLines.Select(line => line.ItemId)
            .Concat(dayLines.Select(line => line.ItemId))
            .Concat(wantedLines.Select(line => line.ItemId))
            .Concat(shopLines.Select(line => line.ItemId))
            .ToHashSet();
        var items = await db.Items.AsNoTracking()
            .Where(item => item.DeletedAt == null || referencedItemIds.Contains(item.Id))
            .ToListAsync(ct);
        var referencedMealIds = days.Where(day => day.MealId != null).Select(day => day.MealId!.Value).ToHashSet();
        var meals = await db.Meals.AsNoTracking()
            .Where(meal => meal.DeletedAt == null || referencedMealIds.Contains(meal.Id))
            .ToListAsync(ct);

        return new TransferDocument(
            TransferDocument.CurrentFormat,
            exportedAt,
            new TransferPlan(plan.StartDate, plan.LengthDays),
            items.Select(TransferItem.From).OrderBy(row => row.Id).ToList(),
            meals.Select(TransferMeal.From).OrderBy(row => row.Id).ToList(),
            mealLines.Select(TransferMealLine.From).OrderBy(row => row.Id).ToList(),
            days.Select(TransferDay.From).OrderBy(row => row.Id).ToList(),
            dayLines.Select(TransferDayLine.From).OrderBy(row => row.Id).ToList(),
            wantedLines.Select(TransferWantedLine.From).OrderBy(row => row.Id).ToList(),
            (await db.Shops.AsNoTracking().Live().ToListAsync(ct)).Select(TransferShop.From).OrderBy(row => row.Id).ToList(),
            shopLines.Select(TransferShopLine.From).OrderBy(row => row.Id).ToList(),
            (await db.ArchivedShops.AsNoTracking().ToListAsync(ct)).Select(TransferArchivedShop.From).OrderBy(row => row.Id).ToList());
    }

    private static async Task<byte[]> ZipAsync(TransferDocument document, CancellationToken ct)
    {
        using var zipBuffer = new MemoryStream();
        await using (var archive = new ZipArchive(zipBuffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            var entry = archive.CreateEntry(TransferDocument.EntryName, CompressionLevel.Optimal);
            await using var entryStream = await entry.OpenAsync(ct);
            await JsonSerializer.SerializeAsync(entryStream, document, TransferDocument.JsonOptions, ct);
        }

        return zipBuffer.ToArray();
    }
}
