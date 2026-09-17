using System.ComponentModel.DataAnnotations;

namespace Aloca.Api.DTOs;

public sealed record CategoryRequest(
    [param: Required, StringLength(100, MinimumLength = 1)] string Name);

public sealed record CategoryResponse(Guid Id, string Name);
