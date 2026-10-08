using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Plans;

/// <summary>The one plan: a start date and a length in days.</summary>
public sealed class Plan : ISynced
{
    /// <summary>The id of the one plan row.</summary>
    public static readonly Guid SingletonId = new("5e1f0a3c-9b2d-4c47-8a61-2f3d4b5c6a70");

    /// <summary>The length the first plan starts with.</summary>
    public const int FirstLengthDays = 7;

    public const int MinLengthDays = 1;

    public const int MaxLengthDays = 31;

    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public DateOnly StartDate { get; set; }

    public int LengthDays { get; set; }
}

public sealed class PlanConfiguration : IEntityTypeConfiguration<Plan>
{
    public void Configure(EntityTypeBuilder<Plan> builder)
    {
        builder.ToSyncedTable("plan");
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_plan_length_days",
            $"\"LengthDays\" BETWEEN {Plan.MinLengthDays} AND {Plan.MaxLengthDays}"));
    }
}
