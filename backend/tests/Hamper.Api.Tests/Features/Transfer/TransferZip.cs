using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;

namespace Hamper.Api.Tests.Features.Transfer;

/// <summary>Builds and reads export zips and calls the export and import endpoints.</summary>
internal static class TransferZip
{
    public static byte[] WithEntry(string entryName, string content)
    {
        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            using var writer = new StreamWriter(archive.CreateEntry(entryName).Open(), Encoding.UTF8);
            writer.Write(content);
        }

        return buffer.ToArray();
    }

    public static JsonObject ReadDataJson(byte[] zip)
    {
        using var archive = new ZipArchive(new MemoryStream(zip), ZipArchiveMode.Read);
        using var entry = archive.GetEntry("data.json")!.Open();
        return JsonNode.Parse(entry)!.AsObject();
    }

    public static async Task<byte[]> ExportAsync(HttpClient client, CancellationToken ct)
    {
        var response = await client.GetAsync(new Uri("/api/export", UriKind.Relative), ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsByteArrayAsync(ct);
    }

    public static Task<HttpResponseMessage> ImportAsync(HttpClient client, byte[] zip, CancellationToken ct)
    {
        var content = new ByteArrayContent(zip);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/zip");
        return client.PostAsync(new Uri("/api/import", UriKind.Relative), content, ct);
    }
}
