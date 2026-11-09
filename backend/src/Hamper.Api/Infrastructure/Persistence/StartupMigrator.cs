using System.Globalization;
using Hamper.Api.Infrastructure.Storage;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Infrastructure.Persistence;

/// <summary>Brings the database to the image's schema at startup, backing up an existing database first when there is anything to apply.</summary>
public static class StartupMigrator
{
    /// <summary>How many backups stay in the backups directory; older ones are deleted after each backup.</summary>
    public const int BackupsKept = 5;

    /// <summary>The label a backup takes when the database has no migration applied.</summary>
    public const string EmptyLabel = "empty";

    private const string StampFormat = "yyyyMMddHHmmss";

    /// <summary>Returns the backups directory under the data directory.</summary>
    public static string BackupsDirectory(string dataDir) => Path.Combine(dataDir, "backups");

    /// <summary>Refuses a database ahead of the image, backs up an existing database with pending migrations, keeps the newest backups, then migrates.</summary>
    public static async Task MigrateAsync(
        HamperDbContext db,
        IFileStorage storage,
        TimeProvider time,
        string dataDir,
        CancellationToken cancellationToken)
    {
        var connectionString = db.Database.GetConnectionString()
            ?? throw new InvalidOperationException("The database has no connection string.");
        // Checked before EF Core opens a connection, which creates the file.
        var databaseExisted = storage.FileExists(new SqliteConnectionStringBuilder(connectionString).DataSource);
        var backupsDir = BackupsDirectory(dataDir);
        var appliedMigrationIds = (await db.Database.GetAppliedMigrationsAsync(cancellationToken)).ToList();
        RefuseUnknownMigrations(db, appliedMigrationIds, backupsDir);
        var pendingMigrationIds = await db.Database.GetPendingMigrationsAsync(cancellationToken);
        if (databaseExisted && pendingMigrationIds.Any())
        {
            var label = appliedMigrationIds.LastOrDefault() ?? EmptyLabel;
            await BackUpAsync(storage, connectionString, backupsDir, label, time.GetUtcNow());
            PruneBackups(storage, backupsDir);
        }

        await db.Database.MigrateAsync(cancellationToken);
    }

    /// <summary>Throws when the database has a migration this image does not have, which a newer image applied.</summary>
    private static void RefuseUnknownMigrations(HamperDbContext db, IReadOnlyList<string> appliedMigrationIds, string backupsDir)
    {
        var knownMigrationIds = db.Database.GetMigrations().ToHashSet(StringComparer.Ordinal);
        var unknownMigrationId = appliedMigrationIds.FirstOrDefault(id => !knownMigrationIds.Contains(id));
        if (unknownMigrationId is null)
        {
            return;
        }

        throw new InvalidOperationException(
            $"The database has migration {unknownMigrationId}, which this image does not know. "
            + $"Run the image that created it, or restore a backup from {backupsDir}.");
    }

    /// <summary>Copies the database through SQLite's online backup, so a WAL database is copied consistently.</summary>
    private static Task BackUpAsync(
        IFileStorage storage,
        string connectionString,
        string backupsDir,
        string label,
        DateTimeOffset now)
    {
        var stamp = now.UtcDateTime.ToString(StampFormat, CultureInfo.InvariantCulture);
        var backupPath = Path.Combine(backupsDir, $"hamper-{label}-{stamp}.db");
        return storage.WriteAtomicAsync(backupPath, tempPath =>
        {
            var sourceSettings = new SqliteConnectionStringBuilder(connectionString) { Pooling = false };
            var destinationSettings = new SqliteConnectionStringBuilder { DataSource = tempPath, Pooling = false };
            using var source = new SqliteConnection(sourceSettings.ToString());
            using var destination = new SqliteConnection(destinationSettings.ToString());
            source.Open();
            destination.Open();
            source.BackupDatabase(destination);
            // The copy keeps the source's WAL mode; a rollback journal makes the backup one self-contained file.
            using var command = destination.CreateCommand();
            command.CommandText = "PRAGMA journal_mode=DELETE;";
            command.ExecuteNonQuery();
            return Task.CompletedTask;
        });
    }

    /// <summary>Deletes every backup but the newest, ordered by the UTC stamp at the end of the name.</summary>
    private static void PruneBackups(IFileStorage storage, string backupsDir)
    {
        var oldBackupPaths = storage.ListFiles(backupsDir, "hamper-*.db")
            .OrderByDescending(Stamp, StringComparer.Ordinal)
            .ThenByDescending(path => path, StringComparer.Ordinal)
            .Skip(BackupsKept);
        foreach (var oldBackupPath in oldBackupPaths)
        {
            storage.DeleteFile(oldBackupPath);
        }
    }

    private static string Stamp(string backupPath)
    {
        var name = Path.GetFileNameWithoutExtension(backupPath);
        return name[(name.LastIndexOf('-') + 1)..];
    }
}
