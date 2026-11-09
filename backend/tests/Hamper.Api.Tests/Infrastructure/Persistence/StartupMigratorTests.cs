using Hamper.Api.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Hamper.Api.Tests.Infrastructure.Persistence;

public sealed class StartupMigratorTests
{
    private const string EarlierMigrationId = "20261008153303_AddImages";

    private static readonly DateTimeOffset StartedAt = new(2026, 3, 14, 9, 30, 5, TimeSpan.Zero);

    [Fact]
    public async Task A_database_with_pending_migrations_is_backed_up_before_they_run()
    {
        using var factory = StartingAt(StartedAt);
        var ct = TestContext.Current.CancellationToken;
        await MigrateToAsync(factory.DatabasePath, EarlierMigrationId, ct);

        _ = factory.Services;

        var backupPath = Assert.Single(Backups(factory));
        Assert.Equal($"hamper-{EarlierMigrationId}-20260314093005.db", Path.GetFileName(backupPath));
        await using var backup = Open(backupPath);
        Assert.Equal(EarlierMigrationId, (await backup.Database.GetAppliedMigrationsAsync(ct)).Last());
        Assert.NotEmpty(await backup.Database.GetPendingMigrationsAsync(ct));
    }

    [Fact]
    public async Task A_database_with_nothing_pending_is_not_backed_up()
    {
        using var factory = StartingAt(StartedAt);
        var ct = TestContext.Current.CancellationToken;
        await MigrateToAsync(factory.DatabasePath, migrationId: null, ct);

        _ = factory.Services;

        Assert.Empty(Backups(factory));
    }

    [Fact]
    public void A_fresh_database_is_not_backed_up()
    {
        using var factory = StartingAt(StartedAt);

        _ = factory.Services;

        Assert.Empty(Backups(factory));
    }

    [Fact]
    public async Task Only_the_five_newest_backups_are_kept()
    {
        using var factory = StartingAt(StartedAt);
        var ct = TestContext.Current.CancellationToken;
        var backupsDir = StartupMigrator.BackupsDirectory(factory.DataDir);
        Directory.CreateDirectory(backupsDir);
        for (var day = 1; day <= 6; day++)
        {
            await File.WriteAllBytesAsync(Path.Combine(backupsDir, $"hamper-{EarlierMigrationId}-202601{day:D2}120000.db"), [], ct);
        }

        await MigrateToAsync(factory.DatabasePath, EarlierMigrationId, ct);

        _ = factory.Services;

        Assert.Equal(
            [
                $"hamper-{EarlierMigrationId}-20260103120000.db",
                $"hamper-{EarlierMigrationId}-20260104120000.db",
                $"hamper-{EarlierMigrationId}-20260105120000.db",
                $"hamper-{EarlierMigrationId}-20260106120000.db",
                $"hamper-{EarlierMigrationId}-20260314093005.db",
            ],
            Backups(factory).Select(Path.GetFileName).Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task A_database_from_a_newer_image_stops_the_start()
    {
        using var factory = StartingAt(StartedAt);
        var ct = TestContext.Current.CancellationToken;
        await MigrateToAsync(factory.DatabasePath, migrationId: null, ct);
        await using (var db = Open(factory.DatabasePath))
        {
            await db.Database.ExecuteSqlRawAsync(
                """INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('29991231000000_FromANewerImage', '10.0.10');""",
                ct);
        }

        SqliteConnection.ClearAllPools();

        var error = Assert.Throws<InvalidOperationException>(() => factory.Services);
        Assert.Equal(
            "The database has migration 29991231000000_FromANewerImage, which this image does not know. "
            + $"Run the image that created it, or restore a backup from {StartupMigrator.BackupsDirectory(factory.DataDir)}.",
            error.Message);
    }

    private static HamperApiFactory StartingAt(DateTimeOffset now) =>
        new(services => services.AddSingleton<TimeProvider>(new FakeTimeProvider(now)));

    /// <summary>Builds the database at one migration, or at the newest when the id is null, as an earlier image would have left it.</summary>
    private static async Task MigrateToAsync(string databasePath, string? migrationId, CancellationToken ct)
    {
        await using (var db = Open(databasePath))
        {
            await db.GetService<IMigrator>().MigrateAsync(migrationId, cancellationToken: ct);
        }

        SqliteConnection.ClearAllPools();
    }

    private static HamperDbContext Open(string databasePath) =>
        new(new DbContextOptionsBuilder<HamperDbContext>()
            .UseSqlite($"Data Source={databasePath}")
            .Options);

    private static string[] Backups(HamperApiFactory factory)
    {
        var backupsDir = StartupMigrator.BackupsDirectory(factory.DataDir);
        return Directory.Exists(backupsDir) ? Directory.GetFiles(backupsDir) : [];
    }
}
