using Hamper.Api.Features.Images;
using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Items;

/// <summary>A thing bought, with an optional usual size as free text.</summary>
public sealed class Item : IHasImage
{
    public const int NameMaxLength = 200;

    public const int SizeMaxLength = 100;

    public Guid Id { get; init; }

    public long Revision { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    /// <summary>Trimmed on assignment.</summary>
    public required string Name
    {
        get;
        set => field = value.Trim();
    }

    public string? Size { get; set; }

    public Guid? ImageId { get; set; }
}

public sealed class ItemConfiguration : IEntityTypeConfiguration<Item>
{
    public void Configure(EntityTypeBuilder<Item> builder)
    {
        builder.ToSyncedTable("items");
        builder.Property(item => item.Name).HasMaxLength(Item.NameMaxLength);
        builder.Property(item => item.Size).HasMaxLength(Item.SizeMaxLength);
        builder.ToTable(table =>
        {
            table.HasCheckConstraint("CK_items_name", $"length(\"Name\") BETWEEN 1 AND {Item.NameMaxLength}");
            table.HasCheckConstraint("CK_items_size", $"\"Size\" IS NULL OR length(\"Size\") <= {Item.SizeMaxLength}");
        });
    }
}
