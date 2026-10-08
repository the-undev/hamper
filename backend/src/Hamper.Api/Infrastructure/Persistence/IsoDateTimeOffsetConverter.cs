using System.Globalization;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Hamper.Api.Infrastructure.Persistence;

/// <summary>Stores a DateTimeOffset as fixed-width ISO 8601 text in UTC, so SQLite orders and compares it as text.</summary>
public sealed class IsoDateTimeOffsetConverter() : ValueConverter<DateTimeOffset, string>(
    value => value.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
    text => DateTimeOffset.Parse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind));
