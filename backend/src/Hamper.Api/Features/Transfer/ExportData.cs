using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using Hamper.Api.Features.Images;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Transfer;

/// <summary>Returns a zip holding data.json with every live row, the deleted items and meals that live rows point at, and all of history, and the images of the exported items and meals.</summary>
public sealed class ExportData : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/api/export", async (HamperDbContext db, WriteGate gate, ImageStore images, TimeProvider time, CancellationToken ct) =>
        {
            // Read and zip inside the gate so no write lands between the table reads, and no upload deletes an image being copied.
            var zip = await gate.RunAsync(
                async token => await ZipAsync(await ReadAsync(db, time.GetUtcNow(), token), images, token),
                ct);
            var fileName = string.Create(CultureInfo.InvariantCulture, $"hamper-{time.GetLocalNow():yyyyMMdd-HHmmss}.zip");
            return Results.File(zip, "application/zip", fileName);
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

    private static async Task<byte[]> ZipAsync(TransferDocument document, ImageStore images, CancellationToken ct)
    {
        using var zipBuffer = new MemoryStream();
        await using (var archive = new ZipArchive(zipBuffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            var entry = archive.CreateEntry(TransferDocument.EntryName, CompressionLevel.Optimal);
            await using (var entryStream = await entry.OpenAsync(ct))
            {
                await JsonSerializer.SerializeAsync(entryStream, document, TransferDocument.JsonOptions, ct);
            }

            var imageIds = document.Items.Select(item => item.ImageId)
                .Concat(document.Meals.Select(meal => meal.ImageId))
                .OfType<Guid>()
                .Distinct();
            foreach (var imageId in imageIds)
            {
                foreach (var size in ImageStore.Sizes)
                {
                    await ZipImageFileAsync(archive, images, imageId, size, ct);
                }
            }
        }

        return zipBuffer.ToArray();
    }

    /// <summary>Copies one size of an image into the zip, unless its file is missing.</summary>
    private static async Task ZipImageFileAsync(ZipArchive archive, ImageStore images, Guid imageId, string size, CancellationToken ct)
    {
        await using var file = images.OpenRead(imageId, size);
        if (file is null)
        {
            return;
        }

        // JPEGs are already compressed.
        var entry = archive.CreateEntry(TransferDocument.ImageEntryName(imageId, size), CompressionLevel.NoCompression);
        await using var entryStream = await entry.OpenAsync(ct);
        await file.CopyToAsync(entryStream, ct);
    }
}
