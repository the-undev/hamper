using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Features.Sync;

public static class SyncedExtensions
{
    /// <summary>Leaves out tombstoned rows.</summary>
    public static IQueryable<T> Live<T>(this IQueryable<T> rows)
        where T : class, ISynced =>
        rows.Where(row => row.DeletedAt == null);

    /// <summary>Maps a synced entity to its table, keyed on its id, which the database never generates, with the revision indexed for pulls.</summary>
    public static EntityTypeBuilder<T> ToSyncedTable<T>(this EntityTypeBuilder<T> builder, string table)
        where T : class, ISynced
    {
        builder.ToTable(table);
        builder.HasKey(nameof(ISynced.Id));
        builder.Property(nameof(ISynced.Id)).ValueGeneratedNever();
        builder.HasIndex(nameof(ISynced.Revision));
        return builder;
    }
}
