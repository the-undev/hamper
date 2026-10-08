using Hamper.Api.Features.Items;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Shops;

/// <summary>One item on a shop, showing the item's name and size until the line's own text overrides them.</summary>
public sealed class ShopLine : ISynced
{
    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public Guid ShopId { get; set; }

    public Guid ItemId { get; set; }

    public int Count { get; set; }

    public string? NameOverride { get; set; }

    public string? SizeOverride { get; set; }

    /// <summary>The names of the days, and "wanted", that the count came from.</summary>
    public IReadOnlyList<string> Sources { get; set; } = [];

    public bool Ticked { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class ShopLineConfiguration : IEntityTypeConfiguration<ShopLine>
{
    public void Configure(EntityTypeBuilder<ShopLine> builder)
    {
        builder.ToSyncedTable("shop_lines");
        builder.Property(line => line.Sources).HasJsonConversion();
        builder.HasOne<Shop>().WithMany().HasForeignKey(line => line.ShopId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Item>().WithMany().HasForeignKey(line => line.ItemId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable(table => table.HasCheckConstraint("CK_shop_lines_count", "\"Count\" >= 1"));
    }
}
