using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hamper.Api.Infrastructure.Persistence;

public static class JsonColumn
{
    /// <summary>The camelCase shape every JSON column is written in.</summary>
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    /// <summary>Stores a list as JSON text, compared by its elements for change tracking.</summary>
    public static PropertyBuilder<IReadOnlyList<T>> HasJsonConversion<T>(this PropertyBuilder<IReadOnlyList<T>> property) =>
        property.HasConversion(
            list => JsonSerializer.Serialize(list, Options),
            json => JsonSerializer.Deserialize<List<T>>(json, Options) ?? new List<T>(),
            new ValueComparer<IReadOnlyList<T>>(
                (left, right) => left!.SequenceEqual(right!),
                list => list.Aggregate(0, (hash, element) => HashCode.Combine(hash, element)),
                list => list.ToList()));
}
