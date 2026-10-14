using System.Globalization;
using Hamper.Api.Infrastructure.Storage;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Hamper.Api.Infrastructure.Persistence;

/// <summary>Copies an existing database into the data directory's backups folder before a pending migration runs.</summary>
public sealed partial class DatabaseBackup(
    IFileStorage storage,
    TimeProvider time,
    IOptions<StorageOptions> options,
    ILogger<DatabaseBackup> logger)
{
    /// <summary>The folder under the data directory that holds the copies.</summary>
    public const string Folder = "backups";

    /// <summary>Copies the database when its file exists and a migration is pending, and returns the copy's path or null when none was made.</summary>
    public async Task<string?> CopyBeforeMigrateAsync(HamperDbContext db, CancellationToken ct)
    {
        var databasePath = new SqliteConnectionStringBuilder(db.Database.GetConnectionString()).DataSource;
        if (!storage.FileExists(databasePath))
        {
            return null;
        }

        var firstPending = (await db.Database.GetPendingMigrationsAsync(ct)).FirstOrDefault();
        if (firstPending is null)
        {
            return null;
        }

        var stamp = time.GetUtcNow().ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
        var destination = Path.Combine(options.Value.DataDir, Folder, $"hamper-{stamp}-before-{firstPending}.db");
        // VACUUM INTO writes a consistent copy while the source is open, WAL included.
        await storage.WriteAtomicAsync(
            destination,
            tempPath => db.Database.ExecuteSqlAsync($"VACUUM INTO {storage.GetLocalPath(tempPath)}", ct));
        LogCopied(logger, destination, firstPending);
        return destination;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Copied the database to {Destination} before migration {Migration}")]
    private static partial void LogCopied(ILogger logger, string destination, string migration);
}
