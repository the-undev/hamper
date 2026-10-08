using System.Globalization;
using Hamper.Api.Infrastructure.Endpoints;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.Features;

namespace Hamper.Api.Features.Sync;

/// <summary>Streams server-sent events: the current revision on connect and after every write, and a keepalive comment every 15 seconds.</summary>
public sealed class StreamEvents : IEndpoint
{
    private static readonly TimeSpan KeepaliveInterval = TimeSpan.FromSeconds(15);

    public void Map(IEndpointRouteBuilder app) => app.MapGet("/sync/events", StreamAsync);

    private static async Task StreamAsync(
        HttpContext context, HamperDbContext db, RevisionBroadcaster broadcaster, TimeProvider time, CancellationToken ct)
    {
        // Subscribe before reading the revision, so a write in between is sent rather than missed.
        using var subscription = broadcaster.Subscribe();
        using var keepalive = new PeriodicTimer(KeepaliveInterval, time);
        context.Response.ContentType = "text/event-stream";
        context.Response.Headers.CacheControl = "no-cache";
        context.Features.GetRequiredFeature<IHttpResponseBodyFeature>().DisableBuffering();

        try
        {
            await SendAsync(context.Response, RevisionEvent(await db.CurrentRevisionAsync(ct)), ct);
            var nextRevision = subscription.Revisions.ReadAsync(ct).AsTask();
            var nextTick = keepalive.WaitForNextTickAsync(ct).AsTask();
            while (true)
            {
                if (await Task.WhenAny(nextRevision, nextTick) == nextRevision)
                {
                    await SendAsync(context.Response, RevisionEvent(await nextRevision), ct);
                    nextRevision = subscription.Revisions.ReadAsync(ct).AsTask();
                    continue;
                }

                await nextTick;
                await SendAsync(context.Response, ": keepalive\n\n", ct);
                nextTick = keepalive.WaitForNextTickAsync(ct).AsTask();
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // The client has gone.
        }
    }

    private static string RevisionEvent(long revision) =>
        string.Create(CultureInfo.InvariantCulture, $"event: revision\ndata: {revision}\n\n");

    private static async Task SendAsync(HttpResponse response, string text, CancellationToken ct)
    {
        await response.WriteAsync(text, ct);
        await response.Body.FlushAsync(ct);
    }
}
