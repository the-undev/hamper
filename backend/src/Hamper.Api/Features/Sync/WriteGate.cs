namespace Hamper.Api.Features.Sync;

/// <summary>Runs one unit of work at a time, so revisions commit in the order they were given; every write of synced rows goes through it.</summary>
public sealed class WriteGate : IDisposable
{
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    private readonly AsyncLocal<bool> _held = new();

    /// <summary>Whether the current async flow is running inside the gate.</summary>
    public bool IsHeld => _held.Value;

    /// <summary>Waits for the gate, then runs the work while holding it.</summary>
    public async Task<T> RunAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken)
    {
        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            _held.Value = true;
            return await work(cancellationToken);
        }
        finally
        {
            _held.Value = false;
            _semaphore.Release();
        }
    }

    public void Dispose() => _semaphore.Dispose();
}
