using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Sync;

/// <summary>Returns the current revision and every synced row written after the cursor, read as one snapshot.</summary>
public sealed class Pull : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/sync", async (HamperDbContext db, CancellationToken ct, long since = 0) =>
        {
            if (since < 0)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "Bad cursor",
                    detail: "since must be 0 or more");
            }

            return Results.Json(await ReadSnapshotAsync(db, since, ct), SyncTables.JsonOptions);
        });

    private static async Task<Dictionary<string, object>> ReadSnapshotAsync(HamperDbContext db, long since, CancellationToken ct)
    {
        // A deferred transaction takes no write lock; under WAL it reads one snapshot from its first read.
        await db.Database.OpenConnectionAsync(ct);
        await using var snapshot = ((SqliteConnection)db.Database.GetDbConnection()).BeginTransaction(deferred: true);
        await db.Database.UseTransactionAsync(snapshot, ct);

        var body = new Dictionary<string, object> { ["revision"] = await db.CurrentRevisionAsync(ct) };
        foreach (var table in SyncTables.All)
        {
            body[table.WireName] = await table.ReadSinceAsync(db, since, ct);
        }

        return body;
    }
}
