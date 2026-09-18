using Aloca.Api.Models;
using System.ComponentModel.DataAnnotations;

namespace Aloca.Api.DTOs;

public sealed class TransactionRequest
{
    [Required, StringLength(250, MinimumLength = 1)]
    public string Description { get; init; } = string.Empty;

    [Range(typeof(decimal), "0.01", "9999999999999999.99")]
    public decimal Amount { get; init; }

    [EnumDataType(typeof(TransactionType))]
    public TransactionType Type { get; init; }

    public DateOnly Date { get; init; }

    public Guid CategoryId { get; init; }
}

public sealed record TransactionResponse(
    Guid Id,
    string Description,
    decimal Amount,
    TransactionType Type,
    DateOnly Date,
    Guid CategoryId,
    string CategoryName,
    DateTime CreatedAt,
    bool IsRecurring = false);

public sealed class TransactionQueryParameters
{
    public TransactionType? Type { get; init; }

    public Guid? CategoryId { get; init; }

    public DateOnly? StartDate { get; init; }

    public DateOnly? EndDate { get; init; }

    public string? Search { get; init; }

    public string Sort { get; init; } = "date";

    public bool Descending { get; init; } = true;

    [Range(1, int.MaxValue)]
    public int Page { get; init; } = 1;

    [Range(1, 100)]
    public int PageSize { get; init; } = 50;
}

public sealed record PagedResponse<T>(IReadOnlyCollection<T> Items, int Page, int PageSize, int TotalCount);
