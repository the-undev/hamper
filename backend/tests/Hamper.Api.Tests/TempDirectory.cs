namespace Hamper.Api.Tests;

/// <summary>A unique disposable directory; tests never create directories outside one.</summary>
internal sealed class TempDirectory : IDisposable
{
    private readonly DirectoryInfo _directory =
        Directory.CreateTempSubdirectory("hamper-test-");

    public string Path => _directory.FullName;

    /// <summary>Returns the path of a named entry inside the directory.</summary>
    public string Sub(string name) => System.IO.Path.Combine(Path, name);

    public void Dispose()
    {
        try
        {
            _directory.Delete(recursive: true);
        }
        catch (DirectoryNotFoundException)
        {
            // Already gone.
        }
    }
}
