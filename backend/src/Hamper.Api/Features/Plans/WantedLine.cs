using Hamper.Api.Features.Items;
using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Plans;

/// <summary>An item and a count on the plan's wanted list, kept by "Start new plan" when weekly.</summary>
public sealed class WantedLine : ISynced
{
    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public Guid ItemId { get; set; }

    public int Count { get; set; }

    public bool Weekly { get; set; }
}

public sealed class WantedLineConfiguration : IEntityTypeConfiguration<WantedLine>
{
    public void Configure(EntityTypeBuilder<WantedLine> builder)
    {
        builder.ToSyncedTable("wanted_lines");
        builder.HasOne<Item>().WithMany().HasForeignKey(line => line.ItemId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(table => table.HasCheckConstraint("CK_wanted_lines_count", "\"Count\" >= 1"));
    }
}
