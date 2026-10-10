using Hamper.Api.Features.Meals;
using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Plans;

/// <summary>A meal on a day of the plan: its name, an optional link to a library meal, the day's position and its place in that day's order.</summary>
public sealed class PlannedMeal : ISynced
{
    public const int NameMaxLength = 200;

    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    /// <summary>The day it is on.</summary>
    public int Position { get; set; }

    /// <summary>Its place in the day's order, 0 first.</summary>
    public int Rank { get; set; }

    public required string Name { get; set; }

    /// <summary>The library meal it was copied from, if any.</summary>
    public Guid? MealId { get; set; }
}

public sealed class PlannedMealConfiguration : IEntityTypeConfiguration<PlannedMeal>
{
    public void Configure(EntityTypeBuilder<PlannedMeal> builder)
    {
        builder.ToSyncedTable("planned_meals");
        builder.Property(plannedMeal => plannedMeal.Name).HasMaxLength(PlannedMeal.NameMaxLength);
        builder.HasOne<Meal>().WithMany().HasForeignKey(plannedMeal => plannedMeal.MealId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(table =>
        {
            table.HasCheckConstraint("CK_planned_meals_position", "\"Position\" >= 0");
            table.HasCheckConstraint("CK_planned_meals_rank", "\"Rank\" >= 0");
            table.HasCheckConstraint("CK_planned_meals_name", $"length(\"Name\") BETWEEN 1 AND {PlannedMeal.NameMaxLength}");
        });
    }
}
