using Hamper.Api.Features.Items;
using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Plans;

/// <summary>An item and a count on a day of the plan.</summary>
public sealed class DayLine : ISynced
{
    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public Guid DayId { get; set; }

    public Guid ItemId { get; set; }

    public int Count { get; set; }
}

public sealed class DayLineConfiguration : IEntityTypeConfiguration<DayLine>
{
    public void Configure(EntityTypeBuilder<DayLine> builder)
    {
        builder.ToSyncedTable("day_lines");
        builder.HasOne<Day>().WithMany().HasForeignKey(line => line.DayId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Item>().WithMany().HasForeignKey(line => line.ItemId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(table => table.HasCheckConstraint("CK_day_lines_count", "\"Count\" >= 1"));
    }
}
