using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Meals;

/// <summary>A library meal: a name and its lines.</summary>
public sealed class Meal : ISynced
{
    public const int NameMaxLength = 200;

    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public required string Name { get; set; }
}

public sealed class MealConfiguration : IEntityTypeConfiguration<Meal>
{
    public void Configure(EntityTypeBuilder<Meal> builder)
    {
        builder.ToSyncedTable("meals");
        builder.Property(meal => meal.Name).HasMaxLength(Meal.NameMaxLength);
        builder.ToTable(table =>
            table.HasCheckConstraint("CK_meals_name", $"length(\"Name\") BETWEEN 1 AND {Meal.NameMaxLength}"));
    }
}
