using Hamper.Api.Features.Plans;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Hosting;
using Hamper.Api.Infrastructure.Persistence;
using Hamper.Api.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<WriteGate>();
builder.Services.AddSingleton<RevisionStamper>();
builder.Services.AddDbContext<HamperDbContext>((services, options) =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Hamper"))
        .AddInterceptors(new SqlitePragmaInterceptor(), services.GetRequiredService<RevisionStamper>()));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();

builder.Services.AddOptions<StorageOptions>()
    .BindConfiguration("Storage")
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.PostConfigure<StorageOptions>(options =>
    options.DataDir = Path.GetFullPath(options.DataDir, builder.Environment.ContentRootPath));

builder.Services.AddProblemDetails();
builder.Services.AddEndpoints(typeof(Program).Assembly);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HamperDbContext>();
    var time = scope.ServiceProvider.GetRequiredService<TimeProvider>();
    await db.Database.MigrateAsync();
    await app.Services.GetRequiredService<WriteGate>().RunAsync(
        ct => SeedPlan.EnsureAsync(db, time, ct),
        CancellationToken.None);
}

// Unhandled exceptions return problem+json; binding failures keep their client-error status.
app.UseExceptionHandler(new ExceptionHandlerOptions
{
    StatusCodeSelector = exception => exception is BadHttpRequestException badRequest
        ? badRequest.StatusCode
        : StatusCodes.Status500InternalServerError,
});

app.UseSpaFiles();
app.MapEndpoints();
// Last: client routes are whatever no endpoint claimed.
app.MapSpaFallback();

app.Run();

public partial class Program;
