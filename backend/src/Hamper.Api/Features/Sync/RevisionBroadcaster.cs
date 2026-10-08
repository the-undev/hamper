using System.Threading.Channels;
using Hamper.Api.Infrastructure.Persistence;

namespace Hamper.Api.Features.Sync;

/// <summary>Hands the current revision to every open event stream after each run of the <see cref="WriteGate"/>.</summary>
public sealed class RevisionBroadcaster(IServiceScopeFactory scopeFactory)
{
    /// <summary>Only the newest revision matters to a subscriber, so a full channel drops the older one.</summary>
    private static readonly BoundedChannelOptions SubscriberChannelOptions = new(capacity: 1)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true,
    };

    private readonly Lock _subscribersLock = new();

    private readonly HashSet<Channel<long>> _subscribers = [];

    /// <summary>Opens a channel that receives every revision published until the subscription is disposed.</summary>
    public RevisionSubscription Subscribe()
    {
        var channel = Channel.CreateBounded<long>(SubscriberChannelOptions);
        lock (_subscribersLock)
        {
            _subscribers.Add(channel);
        }

        return new RevisionSubscription(channel.Reader, () => Unsubscribe(channel));
    }

    /// <summary>Reads the current revision and sends it to every subscriber.</summary>
    public async Task PublishCurrentAsync(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var currentRevision = await scope.ServiceProvider.GetRequiredService<HamperDbContext>().CurrentRevisionAsync(ct);
        lock (_subscribersLock)
        {
            foreach (var subscriber in _subscribers)
            {
                subscriber.Writer.TryWrite(currentRevision);
            }
        }
    }

    private void Unsubscribe(Channel<long> channel)
    {
        lock (_subscribersLock)
        {
            _subscribers.Remove(channel);
        }

        channel.Writer.TryComplete();
    }
}

/// <summary>One event stream's view of the published revisions.</summary>
public sealed class RevisionSubscription(ChannelReader<long> revisions, Action unsubscribe) : IDisposable
{
    /// <summary>The revisions published since the subscription opened, newest kept when the reader falls behind.</summary>
    public ChannelReader<long> Revisions { get; } = revisions;

    public void Dispose() => unsubscribe();
}
