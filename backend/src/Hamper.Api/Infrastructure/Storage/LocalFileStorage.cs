namespace Hamper.Api.Infrastructure.Storage;

/// <summary>The local-disk <see cref="IFileStorage"/> and the one sanctioned home of System.IO file APIs.</summary>
#pragma warning disable RS0030 // Banned API: this provider is the single sanctioned System.IO call site.
public sealed class LocalFileStorage : IFileStorage
{
    /// <summary>Infix that atomic writes put in their temp names.</summary>
    private const string TempMarker = ".tmp-";

    public bool FileExists(string path) => File.Exists(path);

    public bool DirectoryExists(string path) => Directory.Exists(path);

    public Stream OpenRead(string path) =>
        new FileStream(
            path, FileMode.Open, FileAccess.Read, FileShare.Read,
            bufferSize: 1 << 20, FileOptions.Asynchronous | FileOptions.SequentialScan);

    public void CreateDirectory(string path) => Directory.CreateDirectory(path);

    public async Task WriteAtomicAsync(string destination, Func<string, Task> produceToTemp)
    {
        CreateDirectory(Path.GetDirectoryName(destination)!);
        var tempPath = $"{destination}{TempMarker}{Guid.CreateVersion7():N}";
        try
        {
            await produceToTemp(tempPath);
            File.Move(tempPath, destination, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
    }

    public void DeleteFile(string path) => File.Delete(path);

    public void DeleteDirectory(string path) => Directory.Delete(path, recursive: true);

    public string GetLocalPath(string path) => path;
}
#pragma warning restore RS0030
