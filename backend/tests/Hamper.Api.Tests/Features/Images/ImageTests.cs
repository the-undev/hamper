using System.Net;
using System.Net.Http.Json;
using Hamper.Api.Infrastructure.Persistence;
using ImageMagick;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hamper.Api.Tests.Features.Images;

public sealed class ImageTests
{
    [Fact]
    public async Task Upload_resizes_to_thumb_and_large_and_sets_the_image_id()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);
        // Stored 1600 wide by 1000 high; the orientation says to turn it a quarter, so it shows 1000 by 1600.
        var upload = ImageApi.Jpeg(1600, 1000, exifOrientation: OrientationType.RightTop);

        var imageId = await ImageApi.UploadAcceptedAsync(client, "items", milk.Id, upload, ct);

        using var thumb = new MagickImage(ImageApi.FilePath(factory, imageId, "thumb"));
        using var large = new MagickImage(ImageApi.FilePath(factory, imageId, "large"));
        Assert.Equal((240u, 240u), (thumb.Width, thumb.Height));
        Assert.Equal((750u, 1200u), (large.Width, large.Height));
        Assert.Equal(MagickFormat.Jpeg, large.Format);
        Assert.Equal(82u, large.Quality);
        Assert.Null(large.GetExifProfile());
        Assert.Null(thumb.GetExifProfile());
        var storedItem = await ReadAsync(factory, db => db.Items.AsNoTracking().SingleAsync(ct));
        Assert.Equal(imageId, storedItem.ImageId);
        Assert.True(storedItem.Revision > milk.Revision);
    }

    [Fact]
    public async Task Upload_replaces_the_previous_image_and_deletes_its_files()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var curry = (await TestData.AddMealAsync(factory, "Curry", [], ct)).Meal;
        var firstImageId = await ImageApi.UploadAcceptedAsync(client, "meals", curry.Id, ImageApi.Jpeg(400, 300), ct);

        var secondImageId = await ImageApi.UploadAcceptedAsync(client, "meals", curry.Id, ImageApi.Jpeg(300, 400), ct);

        Assert.NotEqual(firstImageId, secondImageId);
        Assert.False(Directory.Exists(ImageApi.DirectoryPath(factory, firstImageId)));
        Assert.True(File.Exists(ImageApi.FilePath(factory, secondImageId, "thumb")));
        Assert.True(File.Exists(ImageApi.FilePath(factory, secondImageId, "large")));
        var storedMeal = await ReadAsync(factory, db => db.Meals.AsNoTracking().SingleAsync(ct));
        Assert.Equal(secondImageId, storedMeal.ImageId);
    }

    [Fact]
    public async Task Upload_keeps_a_small_image_at_its_size_for_large()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);

        var imageId = await ImageApi.UploadAcceptedAsync(client, "items", milk.Id, ImageApi.Jpeg(400, 300), ct);

        using var thumb = new MagickImage(ImageApi.FilePath(factory, imageId, "thumb"));
        using var large = new MagickImage(ImageApi.FilePath(factory, imageId, "large"));
        Assert.Equal((240u, 240u), (thumb.Width, thumb.Height));
        Assert.Equal((400u, 300u), (large.Width, large.Height));
    }

    [Fact]
    public async Task Upload_to_an_unknown_item_is_404()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await ImageApi.UploadAsync(client, "items", Guid.NewGuid(), ImageApi.Jpeg(100, 100), ct);

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "Item not found", ct);
        Assert.False(Directory.Exists(Path.Combine(factory.DataDir, "images")));
    }

    [Fact]
    public async Task Upload_to_a_deleted_meal_is_404()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var deletedMeal = (await TestData.AddMealAsync(factory, "Old stew", [], ct)).Meal;
        await TestData.WriteAsync(factory, (db, now) =>
        {
            db.Meals.Attach(deletedMeal);
            deletedMeal.DeletedAt = now;
            return deletedMeal;
        }, ct);

        var response = await ImageApi.UploadAsync(client, "meals", deletedMeal.Id, ImageApi.Jpeg(100, 100), ct);

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "Meal not found", ct);
    }

    [Fact]
    public async Task Upload_of_a_non_image_is_400()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);

        var response = await ImageApi.UploadAsync(client, "items", milk.Id, "not a picture"u8.ToArray(), ct);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "Not an image", ct);
        var storedItem = await ReadAsync(factory, db => db.Items.AsNoTracking().SingleAsync(ct));
        Assert.Null(storedItem.ImageId);
        Assert.Equal(milk.Revision, storedItem.Revision);
    }

    [Fact]
    public async Task Upload_of_another_media_type_is_415()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);

        var response = await ImageApi.UploadAsync(client, "items", milk.Id, ImageApi.Jpeg(100, 100), ct, contentType: "image/gif");

        await AssertProblemAsync(response, HttpStatusCode.UnsupportedMediaType, "Send image/jpeg, image/png or image/webp", ct);
    }

    [Fact]
    public async Task Upload_over_10_MB_is_413()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);

        var response = await ImageApi.UploadAsync(client, "items", milk.Id, new byte[(10 * 1024 * 1024) + 1], ct);

        await AssertProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "Image is over 10 MB", ct);
    }

    [Fact]
    public async Task Delete_clears_the_image_and_its_files()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var curry = (await TestData.AddMealAsync(factory, "Curry", [], ct)).Meal;
        var imageId = await ImageApi.UploadAcceptedAsync(client, "meals", curry.Id, ImageApi.Jpeg(400, 300), ct);
        var revisionWithImage = (await ReadAsync(factory, db => db.Meals.AsNoTracking().SingleAsync(ct))).Revision;

        var response = await client.DeleteAsync(new Uri($"/api/meals/{curry.Id}/image", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(Directory.Exists(ImageApi.DirectoryPath(factory, imageId)));
        var storedMeal = await ReadAsync(factory, db => db.Meals.AsNoTracking().SingleAsync(ct));
        Assert.Null(storedMeal.ImageId);
        Assert.True(storedMeal.Revision > revisionWithImage);
    }

    [Fact]
    public async Task Delete_on_an_unknown_meal_is_404()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await client.DeleteAsync(new Uri($"/api/meals/{Guid.NewGuid()}/image", UriKind.Relative), ct);

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "Meal not found", ct);
    }

    [Fact]
    public async Task Serve_returns_the_file_with_immutable_cache_headers()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);
        var imageId = await ImageApi.UploadAcceptedAsync(client, "items", milk.Id, ImageApi.Jpeg(400, 300), ct);

        var thumb = await client.GetAsync(new Uri($"/images/{imageId}/thumb", UriKind.Relative), ct);
        var large = await client.GetAsync(new Uri($"/images/{imageId}/large", UriKind.Relative), ct);

        Assert.Equal(HttpStatusCode.OK, thumb.StatusCode);
        Assert.Equal("image/jpeg", thumb.Content.Headers.ContentType?.MediaType);
        Assert.True(thumb.Headers.CacheControl?.Public);
        Assert.Equal(TimeSpan.FromDays(365), thumb.Headers.CacheControl?.MaxAge);
        Assert.Contains("immutable", thumb.Headers.CacheControl?.ToString(), StringComparison.Ordinal);
        Assert.Equal(
            await File.ReadAllBytesAsync(ImageApi.FilePath(factory, imageId, "thumb"), ct),
            await thumb.Content.ReadAsByteArrayAsync(ct));
        Assert.Equal(HttpStatusCode.OK, large.StatusCode);
        Assert.Equal(
            await File.ReadAllBytesAsync(ImageApi.FilePath(factory, imageId, "large"), ct),
            await large.Content.ReadAsByteArrayAsync(ct));
    }

    [Fact]
    public async Task Serve_unknown_is_404()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        var milk = await TestData.AddItemAsync(factory, "Milk", null, ct);
        var imageId = await ImageApi.UploadAcceptedAsync(client, "items", milk.Id, ImageApi.Jpeg(400, 300), ct);

        var unknownImage = await client.GetAsync(new Uri($"/images/{Guid.NewGuid()}/thumb", UriKind.Relative), ct);
        var unknownSize = await client.GetAsync(new Uri($"/images/{imageId}/huge", UriKind.Relative), ct);

        await AssertProblemAsync(unknownImage, HttpStatusCode.NotFound, "Image not found", ct);
        await AssertProblemAsync(unknownSize, HttpStatusCode.NotFound, "Image not found", ct);
    }

    private static async Task<T> ReadAsync<T>(HamperApiFactory factory, Func<HamperDbContext, Task<T>> read)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await read(scope.ServiceProvider.GetRequiredService<HamperDbContext>());
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string title, CancellationToken ct)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(ct);
        Assert.Equal(title, problem?.Title);
    }
}
