using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Shops;

/// <summary>An open shopping list, made from the plan or started empty.</summary>
public sealed class Shop : ISynced
{
    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public required string Name { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public bool FromPlan { get; set; }

    public DateOnly? PlanStartDate { get; set; }

    public int? PlanLengthDays { get; set; }

    /// <summary>The planned meals by day and order when it was made from the plan.</summary>
    public IReadOnlyList<ShopMeal> Meals { get; set; } = [];
}

public sealed class ShopConfiguration : IEntityTypeConfiguration<Shop>
{
    public void Configure(EntityTypeBuilder<Shop> builder)
    {
        builder.ToSyncedTable("shops");
        builder.Property(shop => shop.Meals).HasJsonConversion();
    }
}
