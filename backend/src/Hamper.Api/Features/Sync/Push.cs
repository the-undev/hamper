using System.Text.Json;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Features.Sync;

/// <summary>Applies a batch of whole-row changes in order as one transaction and returns the rows as they now stand.</summary>
public sealed class Push : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/sync", async (HttpRequest request, HamperDbContext db, WriteGate gate, CancellationToken ct) =>
        {
            PushRequest? batch;
            try
            {
                batch = await JsonSerializer.DeserializeAsync<PushRequest>(request.Body, SyncTables.JsonOptions, ct);
            }
            catch (JsonException exception)
            {
                return Rejected($"The body is not a push batch: {exception.Message}");
            }

            if (batch is null)
            {
                return Rejected("The body is not a push batch");
            }

            var changes = new List<ValidChange>();
            foreach (var change in batch.Changes)
            {
                var (validChange, problem) = Validate(change);
                if (validChange is null)
                {
                    return Rejected($"Change {change.Id}: {problem}");
                }

                changes.Add(validChange);
            }

            return await gate.RunAsync(token => ApplyAsync(db, changes, token), ct);
        });

    private static (ValidChange? Change, string? Problem) Validate(PushChange change)
    {
        var table = SyncTables.Find(change.Table);
        if (table is null)
        {
            return (null, $"unknown table \"{change.Table}\"");
        }

        if (!HasWellFormedId(change.Row))
        {
            return (null, "the row's id is missing or malformed");
        }

        ISynced row;
        try
        {
            row = (ISynced)change.Row.Deserialize(table.RowType, SyncTables.JsonOptions)!;
        }
        catch (JsonException exception)
        {
            return (null, $"the row does not fit {table.WireName}: {exception.Message}");
        }

        var rowProblem = table.Validate(row);
        return rowProblem is null ? (new ValidChange(change.Id, table, row), null) : (null, rowProblem);
    }

    private static bool HasWellFormedId(JsonElement row) =>
        row.ValueKind == JsonValueKind.Object
        && row.TryGetProperty("id", out var id)
        && id.ValueKind == JsonValueKind.String
        && Guid.TryParseExact(id.GetString(), "D", out _);

    private static async Task<IResult> ApplyAsync(HamperDbContext db, List<ValidChange> changes, CancellationToken ct)
    {
        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            // Foreign keys are checked at commit, so a row may point at one that arrives later in the batch.
            await db.Database.ExecuteSqlRawAsync("PRAGMA defer_foreign_keys = ON", ct);
            foreach (var change in changes)
            {
                await change.Table.UpsertAsync(db, change.Row, ct);
            }

            await db.SaveChangesAsync(ct);
            var orphanChange = await FirstOrphanAsync(db, changes, ct);
            if (orphanChange is not null)
            {
                return Rejected($"Change {orphanChange.ChangeId}: a foreign key points at a row that does not exist");
            }

            await transaction.CommitAsync(ct);
        }

        var rows = new Dictionary<string, IReadOnlyList<object>>();
        foreach (var table in SyncTables.All)
        {
            var pushedIds = changes.Where(change => change.Table == table).Select(change => change.Row.Id).ToHashSet();
            rows[table.WireName] = await table.ReadByIdsAsync(db, pushedIds, ct);
        }

        var response = new PushResponse(
            await db.CurrentRevisionAsync(ct),
            changes.Select(change => change.ChangeId).ToList(),
            rows);
        return Results.Json(response, SyncTables.JsonOptions);
    }

    /// <summary>Finds the first change whose row has a foreign key that the open transaction cannot resolve; SQLite would refuse the commit for it.</summary>
    private static async Task<ValidChange?> FirstOrphanAsync(HamperDbContext db, List<ValidChange> changes, CancellationToken ct)
    {
        var orphanRows = new HashSet<(SyncTable Table, Guid Id)>();
        foreach (var table in changes.Select(change => change.Table).Distinct())
        {
            orphanRows.UnionWith((await table.ReadForeignKeyViolationsAsync(db, ct)).Select(id => (table, id)));
        }

        return changes.FirstOrDefault(change => orphanRows.Contains((change.Table, change.Row.Id)));
    }

    private static IResult Rejected(string detail) =>
        Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Push rejected", detail: detail);

    private sealed record PushRequest(IReadOnlyList<PushChange> Changes);

    private sealed record PushChange(string Id, string Table, JsonElement Row);

    private sealed record ValidChange(string ChangeId, SyncTable Table, ISynced Row);

    private sealed record PushResponse(long Revision, IReadOnlyList<string> Applied, IReadOnlyDictionary<string, IReadOnlyList<object>> Rows);
}
