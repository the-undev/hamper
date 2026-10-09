using System.Net;
using Hamper.Api.Features.Sync;
using Hamper.Api.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Hamper.Api.Tests.Features.Sync;

public sealed class EventsTests
{
    /// <summary>How long a test waits for the next event before it fails rather than hangs.</summary>
    private static readonly TimeSpan EventWait = TimeSpan.FromSeconds(10);

    [Fact]
    public async Task Events_sends_the_current_revision_on_connect()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        await TestData.AddItemAsync(factory, "Milk", null, ct);
        var currentRevision = await CurrentRevisionAsync(factory, ct);

        using var response = await OpenStreamAsync(client, ct);
        using var events = new StreamReader(await response.Content.ReadAsStreamAsync(ct));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.NoCache);
        Assert.Equal($"event: revision\ndata: {currentRevision}", await ReadEventAsync(events, ct));
    }

    [Fact]
    public async Task Events_sends_a_new_revision_after_a_write()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        using var response = await OpenStreamAsync(client, ct);
        using var events = new StreamReader(await response.Content.ReadAsStreamAsync(ct));
        await ReadEventAsync(events, ct);

        var pushed = await SyncApi.PushAcceptedAsync(
            client, [new SyncChange("c1", "items", WireRows.Item(Guid.NewGuid(), "Milk"))], ct);

        Assert.Equal($"event: revision\ndata: {(long)pushed["revision"]!}", await ReadEventAsync(events, ct));
    }

    [Fact]
    public async Task Events_sends_a_keepalive_when_the_timer_fires()
    {
        var time = new FakeTimeProvider(WireRows.Morning);
        using var factory = new HamperApiFactory(services => services.AddSingleton<TimeProvider>(time));
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        using var response = await OpenStreamAsync(client, ct);
        using var events = new StreamReader(await response.Content.ReadAsStreamAsync(ct));
        await ReadEventAsync(events, ct);

        time.Advance(TimeSpan.FromSeconds(15));

        Assert.Equal(": keepalive", await ReadEventAsync(events, ct));
    }

    private static Task<HttpResponseMessage> OpenStreamAsync(HttpClient client, CancellationToken ct) =>
        client.SendAsync(
            new HttpRequestMessage(HttpMethod.Get, new Uri("/sync/events", UriKind.Relative)),
            HttpCompletionOption.ResponseHeadersRead,
            ct);

    /// <summary>Reads the lines up to the next blank line and joins them with newlines.</summary>
    private static async Task<string> ReadEventAsync(StreamReader events, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(EventWait);
        var lines = new List<string>();
        while (await events.ReadLineAsync(timeout.Token) is { Length: > 0 } line)
        {
            lines.Add(line);
        }

        return string.Join('\n', lines);
    }

    private static async Task<long> CurrentRevisionAsync(HamperApiFactory factory, CancellationToken ct)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<HamperDbContext>().CurrentRevisionAsync(ct);
    }
}
