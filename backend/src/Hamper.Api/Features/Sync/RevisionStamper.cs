using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Hamper.Api.Features.Sync;

/// <summary>Gives every added or modified synced row the next revision in the same save, and refuses such a write outside the <see cref="WriteGate"/>.</summary>
public sealed class RevisionStamper(WriteGate gate) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        var context = eventData.Context!;
        var writtenRows = WrittenSyncedRows(context);
        if (writtenRows.Count == 0)
        {
            return result;
        }

        Stamp(context, writtenRows, context.Set<SyncState>().Single(state => state.Id == SyncState.SingletonId));
        return result;
    }

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var context = eventData.Context!;
        var writtenRows = WrittenSyncedRows(context);
        if (writtenRows.Count == 0)
        {
            return result;
        }

        var syncState = await context.Set<SyncState>()
            .SingleAsync(state => state.Id == SyncState.SingletonId, cancellationToken)
            .ConfigureAwait(false);
        Stamp(context, writtenRows, syncState);
        return result;
    }

    private List<EntityEntry<ISynced>> WrittenSyncedRows(DbContext context)
    {
        context.ChangeTracker.DetectChanges();
        var writtenRows = context.ChangeTracker.Entries<ISynced>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified)
            .ToList();
        if (writtenRows.Count > 0 && !gate.IsHeld)
        {
            throw new InvalidOperationException("Synced rows are written only inside the WriteGate.");
        }

        return writtenRows;
    }

    private static void Stamp(DbContext context, List<EntityEntry<ISynced>> writtenRows, SyncState syncState)
    {
        var revision = syncState.CurrentRevision;
        foreach (var row in writtenRows)
        {
            row.Property(synced => synced.Revision).CurrentValue = ++revision;
        }

        context.Entry(syncState).Property(state => state.CurrentRevision).CurrentValue = revision;
    }
}
