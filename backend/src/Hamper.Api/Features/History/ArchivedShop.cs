using Hamper.Api.Features.Shops;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.History;

/// <summary>A shop moved to history, held as text so later changes to items and meals leave it alone.</summary>
public sealed class ArchivedShop
{
    public Guid Id { get; init; }

    public required string Name { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ArchivedAt { get; set; }

    public DateOnly? PlanStartDate { get; set; }

    public int? PlanLengthDays { get; set; }

    public IReadOnlyList<ShopMeal> Meals { get; set; } = [];

    public IReadOnlyList<ArchivedShopLine> Lines { get; set; } = [];
}

/// <summary>A shop line as text: the name and size it showed when archived.</summary>
public sealed record ArchivedShopLine(string Name, string? Size, int Count, IReadOnlyList<string> Sources, bool Ticked);

public sealed class ArchivedShopConfiguration : IEntityTypeConfiguration<ArchivedShop>
{
    public void Configure(EntityTypeBuilder<ArchivedShop> builder)
    {
        builder.ToTable("archived_shops");
        builder.HasKey(shop => shop.Id);
        builder.Property(shop => shop.Id).ValueGeneratedNever();
        builder.Property(shop => shop.Meals).HasJsonConversion();
        builder.Property(shop => shop.Lines).HasJsonConversion();
        builder.HasIndex(shop => shop.ArchivedAt);
    }
}
