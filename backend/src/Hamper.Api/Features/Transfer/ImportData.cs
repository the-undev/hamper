using System.IO.Compression;
using System.Text.Json;
using Hamper.Api.Features.Images;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Transfer;

/// <summary>Takes an export zip as the raw request body and writes it into an empty database in one transaction, with the images it holds.</summary>
public sealed class ImportData : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/api/import", async (HttpRequest request, HamperDbContext db, WriteGate gate, ImageStore images, CancellationToken ct) =>
        {
            using var body = new MemoryStream();
            await request.Body.CopyToAsync(body, ct);
            body.Position = 0;

            using var archive = OpenZip(body);
            if (archive is null)
            {
                return BadRequest("The body is not a zip");
            }

            var (document, problem) = await ReadDocumentAsync(archive, ct);
            if (document is null)
            {
                return BadRequest(problem!);
            }

            return await gate.RunAsync(token => WriteAsync(db, images, archive, document, token), ct);
        });

    private static ZipArchive? OpenZip(Stream body)
    {
        try
        {
            return new ZipArchive(body, ZipArchiveMode.Read, leaveOpen: true);
        }
        catch (InvalidDataException)
        {
            return null;
        }
    }

    private static async Task<(TransferDocument? Document, string? Problem)> ReadDocumentAsync(ZipArchive archive, CancellationToken ct)
    {
        var entry = archive.GetEntry(TransferDocument.EntryName);
        if (entry is null)
        {
            return (null, "The zip has no data.json");
        }

        await using var entryStream = await entry.OpenAsync(ct);
        try
        {
            using var json = await JsonDocument.ParseAsync(entryStream, cancellationToken: ct);
            if (!IsCurrentFormat(json.RootElement))
            {
                return (null, $"data.json is not format {TransferDocument.CurrentFormat}");
            }

            var document = json.RootElement.Deserialize<TransferDocument>(TransferDocument.JsonOptions);
            return document is null ? (null, "data.json is empty") : (document, null);
        }
        catch (JsonException)
        {
            return (null, "data.json is not valid");
        }
    }

    private static bool IsCurrentFormat(JsonElement root) =>
        root.ValueKind == JsonValueKind.Object
        && root.TryGetProperty("format", out var format)
        && format.ValueKind == JsonValueKind.Number
        && format.TryGetInt32(out var formatNumber)
        && formatNumber == TransferDocument.CurrentFormat;

    private static async Task<IResult> WriteAsync(
        HamperDbContext db, ImageStore images, ZipArchive archive, TransferDocument document, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (await HasDataAsync(db, ct))
        {
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Database is not empty");
        }

        var items = document.Items.Select(row => row.ToEntity()).ToList();
        var meals = document.Meals.Select(row => row.ToEntity()).ToList();
        var writtenImageIds = await WriteImagesAsync(images, archive, [.. items, .. meals], ct);

        var plan = await db.Plans.SingleAsync(row => row.Id == Plan.SingletonId, ct);
        plan.StartDate = document.Plan.StartDate;
        plan.LengthDays = document.Plan.LengthDays;
        db.Items.AddRange(items);
        db.Meals.AddRange(meals);
        db.MealLines.AddRange(document.MealLines.Select(row => row.ToEntity()));
        db.PlannedMeals.AddRange(document.PlannedMeals.Select(row => row.ToEntity()));
        db.PlannedMealLines.AddRange(document.PlannedMealLines.Select(row => row.ToEntity()));
        db.WantedLines.AddRange(document.WantedLines.Select(row => row.ToEntity()));
        db.Shops.AddRange(document.Shops.Select(row => row.ToEntity()));
        db.ShopLines.AddRange(document.ShopLines.Select(row => row.ToEntity()));
        db.ArchivedShops.AddRange(document.ArchivedShops.Select(row => row.ToEntity()));

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            foreach (var imageId in writtenImageIds)
            {
                images.Delete(imageId);
            }

            return BadRequest("data.json does not fit the schema");
        }

        await transaction.CommitAsync(ct);
        return Results.NoContent();
    }

    /// <summary>Stores every image the rows point at from the zip, clears the image id of a row whose files the zip lacks, and returns the ids stored.</summary>
    private static async Task<HashSet<Guid>> WriteImagesAsync(
        ImageStore images, ZipArchive archive, IReadOnlyList<IHasImage> rows, CancellationToken ct)
    {
        var writtenImageIds = new HashSet<Guid>();
        foreach (var row in rows)
        {
            if (row.ImageId is not { } imageId || writtenImageIds.Contains(imageId))
            {
                continue;
            }

            var entries = ImageStore.Sizes
                .Select(size => (Size: size, Entry: archive.GetEntry(TransferDocument.ImageEntryName(imageId, size))))
                .ToList();
            if (entries.Any(sized => sized.Entry is null))
            {
                row.ImageId = null;
                continue;
            }

            foreach (var (size, entry) in entries)
            {
                await using var entryStream = await entry!.OpenAsync(ct);
                await images.WriteAsync(imageId, size, entryStream, ct);
            }

            writtenImageIds.Add(imageId);
        }

        return writtenImageIds;
    }

    /// <summary>Whether anything has ever been written, tombstones included.</summary>
    private static async Task<bool> HasDataAsync(HamperDbContext db, CancellationToken ct) =>
        await db.Items.AnyAsync(ct)
        || await db.Meals.AnyAsync(ct)
        || await db.Shops.AnyAsync(ct)
        || await db.PlannedMeals.AnyAsync(ct)
        || await db.WantedLines.AnyAsync(ct)
        || await db.ArchivedShops.AnyAsync(ct);

    private static IResult BadRequest(string title) =>
        Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: title);
}
