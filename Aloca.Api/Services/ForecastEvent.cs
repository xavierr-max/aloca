namespace Aloca.Api.Services;

public enum ForecastEventType
{
    Income = 1,
    Expense = 2
}

public enum ForecastEventStatus
{
    Realized = 1,
    Planned = 2
}

public enum ForecastEventOrigin
{
    Transaction = 1,
    RecurringIncomeOccurrence = 2,
    FinancialCommitmentInstallment = 3
}

public sealed record ForecastEvent(
    string SourceId,
    ForecastEventType Type,
    ForecastEventStatus Status,
    decimal Amount,
    DateOnly AccountingDate,
    DateOnly? ScheduledDate,
    Guid? CategoryId,
    string? CategoryName,
    Guid? RecurringIncomeId,
    Guid? FinancialCommitmentId,
    int? InstallmentNumber,
    Guid? TransactionId,
    ForecastEventOrigin Origin,
    string Description,
    Guid? RecurringIncomeOccurrenceId);
