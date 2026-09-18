using System.ComponentModel.DataAnnotations;

namespace Aloca.Api.DTOs;

public sealed class CategoryRequest
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string Name { get; init; } = string.Empty;
}

public sealed record CategoryResponse(Guid Id, string Name);
