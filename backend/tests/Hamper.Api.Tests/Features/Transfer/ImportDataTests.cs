using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;

namespace Hamper.Api.Tests.Features.Transfer;

public sealed class ImportDataTests
{
    [Fact]
    public async Task Import_refuses_a_non_empty_database()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;
        await TestData.AddItemAsync(factory, "Milk", null, ct);
        var zip = await TransferZip.ExportAsync(client, ct);

        var response = await TransferZip.ImportAsync(client, zip, ct);

        await AssertProblemAsync(response, HttpStatusCode.Conflict, "Database is not empty", ct);
    }

    [Fact]
    public async Task Import_refuses_a_wrong_format()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await TransferZip.ImportAsync(client, TransferZip.WithEntry("data.json", """{"format":2}"""), ct);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "data.json is not format 1", ct);
    }

    [Fact]
    public async Task Import_refuses_invalid_json()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await TransferZip.ImportAsync(client, TransferZip.WithEntry("data.json", """{"format":1,"items":"""), ct);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "data.json is not valid", ct);
    }

    [Fact]
    public async Task Import_refuses_a_zip_without_data_json()
    {
        using var factory = new HamperApiFactory();
        using var client = factory.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var response = await TransferZip.ImportAsync(client, TransferZip.WithEntry("notes.txt", "hello"), ct);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "The zip has no data.json", ct);
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string title, CancellationToken ct)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(ct);
        Assert.Equal(title, problem?.Title);
    }
}
