using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Hamper.Api.Tests;

/// <summary>Boots the real app against its own file-backed SQLite database and data directory in a temp directory.</summary>
public class HamperApiFactory : WebApplicationFactory<Program>
{
    private readonly TempDirectory _dataDir = new();
    private readonly Action<IServiceCollection> _configureServices;

    public HamperApiFactory()
        : this(configureServices: _ => { })
    {
    }

    // Internal because xUnit class fixtures allow only one public constructor.
    internal HamperApiFactory(Action<IServiceCollection> configureServices)
    {
        _configureServices = configureServices;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Storage:DataDir", _dataDir.Path);
        builder.UseSetting("ConnectionStrings:Hamper", $"Data Source={_dataDir.Sub("test.db")}");
        builder.ConfigureServices(_configureServices);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _dataDir.Dispose();
        }
    }
}
