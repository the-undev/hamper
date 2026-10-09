using System.Globalization;
using Hamper.Api.Features.Meals;
using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Plans;

/// <summary>A day of the plan by position, holding a planned meal: its name and an optional link to a library meal.</summary>
public sealed class Day : ISynced
{
    private const string IdTemplatePrefix = "da7e0000-0000-4000-8000-";

    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public int Position { get; set; }

    /// <summary>The planned meal's name.</summary>
    public required string Name { get; set; }

    /// <summary>The library meal it was copied from, if any.</summary>
    public Guid? MealId { get; set; }

    /// <summary>Builds a day's id from the template da7e0000-0000-4000-8000-xxxxxxxxxxxx with the position as twelve hex digits in the last group.</summary>
    public static Guid IdFor(int position)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(position);
        return Guid.Parse(IdTemplatePrefix + position.ToString("x12", CultureInfo.InvariantCulture));
    }
}

public sealed class DayConfiguration : IEntityTypeConfiguration<Day>
{
    public void Configure(EntityTypeBuilder<Day> builder)
    {
        builder.ToSyncedTable("days");
        builder.HasOne<Meal>().WithMany().HasForeignKey(day => day.MealId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(table => table.HasCheckConstraint("CK_days_position", "\"Position\" >= 0"));
    }
}
