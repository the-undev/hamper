using Hamper.Api.Infrastructure.Persistence;
using Hamper.Api.Infrastructure.Storage;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace Hamper.Api.Tests.Infrastructure.Persistence;

public sealed class DatabaseBackupTests : IDisposable
{
    private readonly TempDirectory _dataDir = new();

    [Fact]
    public async Task A_pending_migration_copies_the_database_into_backups_named_for_it()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var db = Context();
        await db.GetService<IMigrator>().MigrateAsync("20261008141826_InitialCreate", cancellationToken: ct);
        await db.Database.ExecuteSqlAsync(
            $"""INSERT INTO items ("Id", "Revision", "DeletedAt", "Name", "Size") VALUES ('6A1C2E1B-3F4D-4B5A-9C8D-7E6F5A4B3C2D', 2, NULL, 'Rice', NULL)""",
            ct);

        var copy = await Backup().CopyBeforeMigrateAsync(db, ct);

        var expected = Path.Combine(_dataDir.Path, "backups", "hamper-20260314-093005-before-20261008153303_AddImages.db");
        Assert.Equal(expected, copy);
        Assert.Equal([expected], Directory.GetFiles(Path.Combine(_dataDir.Path, "backups")));
        await using var connection = new SqliteConnection($"Data Source={expected};Mode=ReadOnly;Pooling=False");
        await connection.OpenAsync(ct);
        Assert.Equal("ok", await Scalar(connection, "PRAGMA integrity_check", ct));
        Assert.Equal("Rice", await Scalar(connection, "SELECT \"Name\" FROM items", ct));
    }

    [Fact]
    public async Task An_up_to_date_database_makes_no_copy()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var db = Context();
        await db.Database.MigrateAsync(ct);

        var copy = await Backup().CopyBeforeMigrateAsync(db, ct);

        Assert.Null(copy);
        Assert.False(Directory.Exists(Path.Combine(_dataDir.Path, "backups")));
    }

    [Fact]
    public async Task A_missing_database_file_makes_no_copy_and_no_file()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var db = Context();

        var copy = await Backup().CopyBeforeMigrateAsync(db, ct);

        Assert.Null(copy);
        Assert.False(Directory.Exists(Path.Combine(_dataDir.Path, "backups")));
        Assert.False(File.Exists(_dataDir.Sub("hamper.db")));
    }

    public void Dispose() => _dataDir.Dispose();

    private HamperDbContext Context() =>
        new(new DbContextOptionsBuilder<HamperDbContext>()
            .UseSqlite($"Data Source={_dataDir.Sub("hamper.db")};Pooling=False")
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options);

    private DatabaseBackup Backup() =>
        new(
            new LocalFileStorage(),
            new FakeTimeProvider(new DateTimeOffset(2026, 3, 14, 9, 30, 5, TimeSpan.Zero)),
            Options.Create(new StorageOptions { DataDir = _dataDir.Path }),
            NullLogger<DatabaseBackup>.Instance);

    private static async Task<object?> Scalar(SqliteConnection connection, string sql, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return await command.ExecuteScalarAsync(ct);
    }
}
