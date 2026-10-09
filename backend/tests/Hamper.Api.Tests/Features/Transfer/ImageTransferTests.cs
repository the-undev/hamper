using System.IO.Compression;
using System.Net;
using Hamper.Api.Infrastructure.Persistence;
using Hamper.Api.Tests.Features.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hamper.Api.Tests.Features.Transfer;

public sealed class ImageTransferTests
{
    [Fact]
    public async Task Export_includes_images_and_import_restores_them()
    {
        using var source = new HamperApiFactory();
        using var target = new HamperApiFactory();
        using var sourceClient = source.CreateClient();
        using var targetClient = target.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(source, "Milk", null, ct);
        await TestData.AddItemAsync(source, "Rice", null, ct);
        var curry = (await TestData.AddMealAsync(source, "Curry", [], ct)).Meal;
        var milkImageId = await ImageApi.UploadAcceptedAsync(sourceClient, "items", milk.Id, ImageApi.Jpeg(400, 300), ct);
        var curryImageId = await ImageApi.UploadAcceptedAsync(sourceClient, "meals", curry.Id, ImageApi.Jpeg(300, 400), ct);

        var zip = await TransferZip.ExportAsync(sourceClient, ct);
        var importResponse = await TransferZip.ImportAsync(targetClient, zip, ct);

        Assert.Equal(["data.json", .. ImageEntries(milkImageId), .. ImageEntries(curryImageId)], EntryNames(zip));
        Assert.Equal(HttpStatusCode.NoContent, importResponse.StatusCode);
        var importedMilk = await ReadAsync(target, db => db.Items.AsNoTracking().SingleAsync(item => item.Id == milk.Id, ct));
        var importedCurry = await ReadAsync(target, db => db.Meals.AsNoTracking().SingleAsync(ct));
        Assert.Equal(milkImageId, importedMilk.ImageId);
        Assert.Equal(curryImageId, importedCurry.ImageId);
        foreach (var (imageId, size) in new[] { (milkImageId, "thumb"), (milkImageId, "large"), (curryImageId, "thumb"), (curryImageId, "large") })
        {
            Assert.Equal(
                await File.ReadAllBytesAsync(ImageApi.FilePath(source, imageId, size), ct),
                await File.ReadAllBytesAsync(ImageApi.FilePath(target, imageId, size), ct));
        }

        var served = await targetClient.GetAsync(new Uri($"/images/{curryImageId}/large", UriKind.Relative), ct);
        Assert.Equal(HttpStatusCode.OK, served.StatusCode);
    }

    [Fact]
    public async Task Import_clears_an_image_id_whose_files_are_missing()
    {
        using var source = new HamperApiFactory();
        using var target = new HamperApiFactory();
        using var sourceClient = source.CreateClient();
        using var targetClient = target.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(source, "Milk", null, ct);
        var rice = await TestData.AddItemAsync(source, "Rice", null, ct);
        var milkImageId = await ImageApi.UploadAcceptedAsync(sourceClient, "items", milk.Id, ImageApi.Jpeg(400, 300), ct);
        var riceImageId = await ImageApi.UploadAcceptedAsync(sourceClient, "items", rice.Id, ImageApi.Jpeg(400, 300), ct);
        var zip = WithoutEntry(await TransferZip.ExportAsync(sourceClient, ct), $"images/{milkImageId}/large.jpg");

        var importResponse = await TransferZip.ImportAsync(targetClient, zip, ct);

        Assert.Equal(HttpStatusCode.NoContent, importResponse.StatusCode);
        var importedMilk = await ReadAsync(target, db => db.Items.AsNoTracking().SingleAsync(item => item.Id == milk.Id, ct));
        var importedRice = await ReadAsync(target, db => db.Items.AsNoTracking().SingleAsync(item => item.Id == rice.Id, ct));
        Assert.Null(importedMilk.ImageId);
        Assert.False(Directory.Exists(ImageApi.DirectoryPath(target, milkImageId)));
        Assert.Equal(riceImageId, importedRice.ImageId);
        Assert.True(File.Exists(ImageApi.FilePath(target, riceImageId, "large")));
    }

    private static string[] ImageEntries(Guid imageId) => [$"images/{imageId}/thumb.jpg", $"images/{imageId}/large.jpg"];

    private static List<string> EntryNames(byte[] zip)
    {
        using var archive = new ZipArchive(new MemoryStream(zip), ZipArchiveMode.Read);
        return archive.Entries.Select(entry => entry.FullName).ToList();
    }

    private static byte[] WithoutEntry(byte[] zip, string entryName)
    {
        using var buffer = new MemoryStream();
        buffer.Write(zip);
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Update, leaveOpen: true))
        {
            archive.GetEntry(entryName)!.Delete();
        }

        return buffer.ToArray();
    }

    private static async Task<T> ReadAsync<T>(HamperApiFactory factory, Func<HamperDbContext, Task<T>> read)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await read(scope.ServiceProvider.GetRequiredService<HamperDbContext>());
    }
}
