namespace Hamper.Api.Infrastructure.Storage;

/// <summary>The single gateway to file IO; the analyzer allows System.IO file APIs only in <see cref="LocalFileStorage"/>.</summary>
public interface IFileStorage
{
    bool FileExists(string path);

    bool DirectoryExists(string path);

    /// <summary>Opens a sequential async read stream.</summary>
    Stream OpenRead(string path);

    void CreateDirectory(string path);

    /// <summary>Ensures the parent directory, lets the producer write to a sibling temp path, then moves it over the destination.</summary>
    Task WriteAtomicAsync(string destination, Func<string, Task> produceToTemp);

    /// <summary>Copies the content to the destination through a sibling temp path, as the producer form does.</summary>
    Task WriteAtomicAsync(string destination, Stream content, CancellationToken ct);

    void DeleteFile(string path);

    /// <summary>Deletes the directory and everything under it.</summary>
    void DeleteDirectory(string path);

    /// <summary>Returns a real local path for consumers that need one, such as an image library or Results.File.</summary>
    string GetLocalPath(string path);
}
