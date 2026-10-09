using Hamper.Api.Features.Items;
using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Plans;

/// <summary>An item and a count on a planned meal.</summary>
public sealed class PlannedMealLine : ISynced
{
    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public Guid PlannedMealId { get; set; }

    public Guid ItemId { get; set; }

    public int Count { get; set; }
}

public sealed class PlannedMealLineConfiguration : IEntityTypeConfiguration<PlannedMealLine>
{
    public void Configure(EntityTypeBuilder<PlannedMealLine> builder)
    {
        builder.ToSyncedTable("planned_meal_lines");
        builder.HasOne<PlannedMeal>().WithMany().HasForeignKey(line => line.PlannedMealId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Item>().WithMany().HasForeignKey(line => line.ItemId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(table => table.HasCheckConstraint("CK_planned_meal_lines_count", "\"Count\" >= 1"));
    }
}
