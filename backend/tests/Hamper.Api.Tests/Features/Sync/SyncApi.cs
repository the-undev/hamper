using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Hamper.Api.Tests.Features.Sync;

/// <summary>Calls the sync endpoints and reads their JSON.</summary>
internal static class SyncApi
{
    /// <summary>The wire names of the synced tables, in response order.</summary>
    public static readonly string[] TableNames =
        ["items", "meals", "mealLines", "plan", "days", "dayLines", "wantedLines", "shops", "shopLines"];

    public static async Task<JsonObject> PullAsync(HttpClient client, long since, CancellationToken ct)
    {
        var response = await client.GetAsync(new Uri($"/sync?since={since}", UriKind.Relative), ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonObject>(ct))!;
    }

    /// <summary>Every row of every table in a pull or push body, as one flat list.</summary>
    public static IEnumerable<JsonObject> AllRows(JsonObject tables) =>
        TableNames.SelectMany(table => tables[table]!.AsArray().Select(row => row!.AsObject()));
}
