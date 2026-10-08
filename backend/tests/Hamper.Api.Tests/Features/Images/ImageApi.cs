using System.Net.Http.Headers;
using System.Net.Http.Json;
using ImageMagick;

namespace Hamper.Api.Tests.Features.Images;

/// <summary>Makes small real images and calls the image endpoints.</summary>
internal static class ImageApi
{
    /// <summary>A JPEG of the given size, optionally carrying an EXIF orientation.</summary>
    public static byte[] Jpeg(uint width, uint height, OrientationType? exifOrientation = null)
    {
        using var image = new MagickImage(MagickColors.Coral, width, height);
        if (exifOrientation is { } orientation)
        {
            // Either the tag or the property alone is lost on write, so both are set.
            var profile = new ExifProfile();
            profile.SetValue(ExifTag.Orientation, (ushort)orientation);
            image.SetProfile(profile);
            image.Orientation = orientation;
        }

        var jpeg = image.ToByteArray(MagickFormat.Jpeg);
        using var written = new MagickImage(jpeg);
        Assert.Equal(exifOrientation ?? OrientationType.Undefined, written.Orientation);
        return jpeg;
    }

    public static Task<HttpResponseMessage> UploadAsync(
        HttpClient client, string table, Guid rowId, byte[] body, CancellationToken ct, string contentType = "image/jpeg")
    {
        var content = new ByteArrayContent(body);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return client.PostAsync(new Uri($"/api/{table}/{rowId}/image", UriKind.Relative), content, ct);
    }

    /// <summary>Uploads a picture, asserts it was taken, and returns the new image id.</summary>
    public static async Task<Guid> UploadAcceptedAsync(HttpClient client, string table, Guid rowId, byte[] body, CancellationToken ct)
    {
        var response = await UploadAsync(client, table, rowId, body, ct);
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<UploadedImage>(ct))!.ImageId;
    }

    /// <summary>The path of one size's file under the data directory.</summary>
    public static string FilePath(HamperApiFactory factory, Guid imageId, string size) =>
        Path.Combine(factory.DataDir, "images", imageId.ToString("D"), $"{size}.jpg");

    /// <summary>The directory holding an image's files.</summary>
    public static string DirectoryPath(HamperApiFactory factory, Guid imageId) =>
        Path.Combine(factory.DataDir, "images", imageId.ToString("D"));

    internal sealed record UploadedImage(Guid ImageId);
}
