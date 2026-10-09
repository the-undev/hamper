using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Sync;

/// <summary>The one row holding the revision counter shared by every synced table.</summary>
public sealed class SyncState
{
    /// <summary>The id of the one row.</summary>
    public const int SingletonId = 1;

    public int Id { get; init; }

    /// <summary>The revision most recently given to a write.</summary>
    public long CurrentRevision { get; set; }
}

public sealed class SyncStateConfiguration : IEntityTypeConfiguration<SyncState>
{
    public void Configure(EntityTypeBuilder<SyncState> builder)
    {
        builder.ToTable("sync_state");
        builder.HasKey(state => state.Id);
        builder.Property(state => state.Id).ValueGeneratedNever();
        builder.HasData(new SyncState { Id = SyncState.SingletonId, CurrentRevision = 0 });
    }
}
