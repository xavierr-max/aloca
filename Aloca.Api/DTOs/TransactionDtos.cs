using Aloca.Api.Models;
using System.ComponentModel.DataAnnotations;

namespace Aloca.Api.DTOs;

public sealed record TransactionRequest(
    [property: Required, StringLength(250, MinimumLength = 1)] string Description,
    [property: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal Amount,
    [property: EnumDataType(typeof(TransactionType))] TransactionType Type,
    DateOnly Date,
    Guid CategoryId);

public sealed record TransactionResponse(
    Guid Id,
    string Description,
    decimal Amount,
    TransactionType Type,
    DateOnly Date,
    Guid CategoryId,
    string CategoryName);

public sealed class TransactionQueryParameters
{
    public TransactionType? Type { get; init; }

    public Guid? CategoryId { get; init; }

    public DateOnly? StartDate { get; init; }

    public DateOnly? EndDate { get; init; }

    [Range(1, int.MaxValue)]
    public int Page { get; init; } = 1;

    [Range(1, 100)]
    public int PageSize { get; init; } = 50;
}

public sealed record PagedResponse<T>(IReadOnlyCollection<T> Items, int Page, int PageSize, int TotalCount);
