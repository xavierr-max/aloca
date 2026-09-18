using Aloca.Api.Models;
using System.ComponentModel.DataAnnotations;

namespace Aloca.Api.DTOs;

public sealed class RecurringIncomeRequest
{
    [Required, StringLength(250, MinimumLength = 1)] public string Description { get; init; } = string.Empty;
    [Range(typeof(decimal), "0.01", "9999999999999999.99")] public decimal Amount { get; init; }
    public Guid CategoryId { get; init; }
    [EnumDataType(typeof(RecurringIncomeFrequency))] public RecurringIncomeFrequency Frequency { get; init; }
    public DateOnly StartDate { get; init; }
    public DateOnly? EndDate { get; init; }
    [Range(1, 31)] public int? DayOfMonth { get; init; }
}

public sealed record RecurringIncomeOccurrenceResponse(Guid Id, DateOnly ScheduledDate, decimal Amount, RecurringIncomeOccurrenceStatus Status, Guid? TransactionId);
public sealed record RecurringIncomeResponse(Guid Id, string Description, decimal Amount, Guid CategoryId, string CategoryName, RecurringIncomeFrequency Frequency, DateOnly StartDate, DateOnly? EndDate, int? DayOfMonth, bool IsActive, DateOnly? NextOccurrence, IReadOnlyCollection<RecurringIncomeOccurrenceResponse> Occurrences);
public sealed record ProjectionMonthResponse(DateOnly Month, decimal RealizedIncome, decimal PlannedIncome, decimal Expenses, decimal ProjectedBalance);
