using Hamper.Api.Features.Sync;

namespace Hamper.Api.Features.Images;

/// <summary>A synced row that can have one image.</summary>
public interface IHasImage : ISynced
{
    /// <summary>The image's id under the images directory, or null when the row has none.</summary>
    Guid? ImageId { get; set; }
}
