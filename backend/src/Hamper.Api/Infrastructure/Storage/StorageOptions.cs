using System.ComponentModel.DataAnnotations;

namespace Hamper.Api.Infrastructure.Storage;

/// <summary>Where hamper keeps its files, made absolute against the content root at startup.</summary>
public sealed class StorageOptions
{
    [Required]
    public string DataDir { get; set; } = string.Empty;
}
