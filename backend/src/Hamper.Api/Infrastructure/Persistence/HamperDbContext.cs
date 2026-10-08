using Hamper.Api.Features.History;
using Hamper.Api.Features.Items;
using Hamper.Api.Features.Meals;
using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Shops;
using Hamper.Api.Features.Sync;
using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Infrastructure.Persistence;

public sealed class HamperDbContext(DbContextOptions<HamperDbContext> options) : DbContext(options)
{
    public DbSet<Item> Items => Set<Item>();

    public DbSet<Meal> Meals => Set<Meal>();

    public DbSet<MealLine> MealLines => Set<MealLine>();

    public DbSet<Plan> Plans => Set<Plan>();

    public DbSet<Day> Days => Set<Day>();

    public DbSet<DayLine> DayLines => Set<DayLine>();

    public DbSet<WantedLine> WantedLines => Set<WantedLine>();

    public DbSet<Shop> Shops => Set<Shop>();

    public DbSet<ShopLine> ShopLines => Set<ShopLine>();

    public DbSet<ArchivedShop> ArchivedShops => Set<ArchivedShop>();

    public DbSet<SyncState> SyncState => Set<SyncState>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder) =>
        configurationBuilder.Properties<DateTimeOffset>().HaveConversion<IsoDateTimeOffsetConverter>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HamperDbContext).Assembly);
}
