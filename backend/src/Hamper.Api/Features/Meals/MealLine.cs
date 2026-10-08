using Hamper.Api.Features.Items;
using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Meals;

/// <summary>An item and a count on a library meal.</summary>
public sealed class MealLine : ISynced
{
    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public Guid MealId { get; set; }

    public Guid ItemId { get; set; }

    public int Count { get; set; }
}

public sealed class MealLineConfiguration : IEntityTypeConfiguration<MealLine>
{
    public void Configure(EntityTypeBuilder<MealLine> builder)
    {
        builder.ToSyncedTable("meal_lines");
        builder.HasOne<Meal>().WithMany().HasForeignKey(line => line.MealId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Item>().WithMany().HasForeignKey(line => line.ItemId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(table => table.HasCheckConstraint("CK_meal_lines_count", "\"Count\" >= 1"));
    }
}
