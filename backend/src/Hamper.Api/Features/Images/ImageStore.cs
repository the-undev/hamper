using Hamper.Api.Infrastructure.Storage;
using ImageMagick;
using Microsoft.Extensions.Options;

namespace Hamper.Api.Features.Images;

/// <summary>Makes, stores, reads and deletes the two JPEG sizes of each image under the data directory's images folder.</summary>
public sealed class ImageStore(IFileStorage storage, IOptions<StorageOptions> options)
{
    /// <summary>The square thumbnail for lists and cards.</summary>
    public const string Thumb = "thumb";

    /// <summary>The larger picture for the meal screen.</summary>
    public const string Large = "large";

    /// <summary>The thumbnail's width and height in pixels.</summary>
    public const uint ThumbEdge = 240;

    /// <summary>The most pixels the large size has on its longer edge.</summary>
    public const uint LargeEdge = 1200;

    /// <summary>The JPEG quality both sizes are written at.</summary>
    public const uint Quality = 82;

    /// <summary>The largest upload accepted, in bytes.</summary>
    public const long MaxUploadBytes = 10 * 1024 * 1024;

    /// <summary>Every size an image is stored at.</summary>
    public static readonly IReadOnlyList<string> Sizes = [Thumb, Large];

    /// <summary>The upload media types accepted, each with the only format Magick may read it as.</summary>
    public static readonly IReadOnlyDictionary<string, MagickFormat> UploadFormats =
        new Dictionary<string, MagickFormat>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = MagickFormat.Jpeg,
            ["image/png"] = MagickFormat.Png,
            ["image/webp"] = MagickFormat.WebP,
        };

    /// <summary>Makes both sizes from an upload under a new image id and returns it, or null when Magick cannot read the upload as the format.</summary>
    public async Task<Guid?> CreateAsync(byte[] upload, MagickFormat format, CancellationToken ct)
    {
        MagickImage source;
        try
        {
            source = new MagickImage(upload, new MagickReadSettings { Format = format });
        }
        catch (MagickException)
        {
            return null;
        }

        using (source)
        {
            // Orient before stripping, which removes the EXIF orientation with the rest.
            source.AutoOrient();
            source.Strip();
            source.BackgroundColor = MagickColors.White;
            source.Alpha(AlphaOption.Remove);
            var imageId = Guid.NewGuid();

            using var thumb = source.Clone();
            thumb.Thumbnail(new MagickGeometry(ThumbEdge, ThumbEdge) { FillArea = true });
            thumb.Crop(ThumbEdge, ThumbEdge, Gravity.Center);
            thumb.ResetPage();
            await WriteJpegAsync(thumb, PathOf(imageId, Thumb), ct);

            source.Thumbnail(new MagickGeometry(LargeEdge, LargeEdge) { Greater = true });
            await WriteJpegAsync(source, PathOf(imageId, Large), ct);
            return imageId;
        }
    }

    /// <summary>Stores one size's file as it comes, as an import does.</summary>
    public Task WriteAsync(Guid imageId, string size, Stream content, CancellationToken ct) =>
        storage.WriteAtomicAsync(PathOf(imageId, size), content, ct);

    /// <summary>Returns the local path of one size's file, or null when the size is unknown or the file is missing.</summary>
    public string? FindLocalPath(Guid imageId, string size)
    {
        if (!Sizes.Contains(size))
        {
            return null;
        }

        var path = PathOf(imageId, size);
        return storage.FileExists(path) ? storage.GetLocalPath(path) : null;
    }

    /// <summary>Opens one size's file for reading, or returns null when it is missing.</summary>
    public Stream? OpenRead(Guid imageId, string size)
    {
        var path = PathOf(imageId, size);
        return storage.FileExists(path) ? storage.OpenRead(path) : null;
    }

    /// <summary>Deletes an image's directory and both its files, if there is one.</summary>
    public void Delete(Guid imageId)
    {
        var directory = DirectoryOf(imageId);
        if (storage.DirectoryExists(directory))
        {
            storage.DeleteDirectory(directory);
        }
    }

    private string DirectoryOf(Guid imageId) =>
        Path.Combine(options.Value.DataDir, "images", imageId.ToString("D"));

    private string PathOf(Guid imageId, string size) => Path.Combine(DirectoryOf(imageId), $"{size}.jpg");

    private Task WriteJpegAsync(IMagickImage<byte> image, string destination, CancellationToken ct)
    {
        image.Quality = Quality;
        // The format is explicit because the temp path's extension does not name one.
        return storage.WriteAtomicAsync(
            destination,
            tempPath => image.WriteAsync(storage.GetLocalPath(tempPath), MagickFormat.Jpeg, ct));
    }
}
