namespace Hamper.Api.Features.Sync;

/// <summary>A row every device holds and syncs, keyed on a client-made id and kept as a tombstone once deleted.</summary>
public interface ISynced
{
    /// <summary>Made by the client; the server makes ids only in seeds and tests.</summary>
    Guid Id { get; }

    /// <summary>The revision its last write was given.</summary>
    long Revision { get; set; }

    /// <summary>When it was deleted; the row stays so the delete reaches every device.</summary>
    DateTimeOffset? DeletedAt { get; set; }
}
