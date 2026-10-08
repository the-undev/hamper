using Microsoft.EntityFrameworkCore;

namespace Hamper.Api.Infrastructure.Persistence;

public sealed class HamperDbContext(DbContextOptions<HamperDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HamperDbContext).Assembly);
}
