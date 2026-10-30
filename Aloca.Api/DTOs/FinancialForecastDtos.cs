using Aloca.Api.Services;

namespace Aloca.Api.DTOs;

public sealed record ForecastItemResponse(string SourceId, ForecastEventType Type, ForecastEventStatus Status, decimal Amount, DateOnly AccountingDate, DateOnly? ScheduledDate, Guid? CategoryId, string? CategoryName, Guid? RecurringIncomeId, Guid? FinancialCommitmentId, int? InstallmentNumber, Guid? TransactionId, ForecastEventOrigin Origin, string Description, Guid? RecurringIncomeOccurrenceId);

public sealed record ForecastMonthResponse(int Year, int Month, DateOnly StartDate, DateOnly EndDate, decimal OpeningBalance, decimal RealizedIncome, decimal PlannedIncome, decimal TotalIncome, decimal RealizedExpense, decimal PlannedExpense, decimal TotalExpense, decimal MonthlyResult, decimal ClosingBalance, IReadOnlyCollection<ForecastItemResponse> IncomeItems, IReadOnlyCollection<ForecastItemResponse> ExpenseItems);

public sealed record ForecastCommitmentResponse(Guid FinancialCommitmentId, string Description, decimal DueAmount, decimal RemainingAmount, DateOnly DueDate, string Status, int InstallmentNumber, int? TotalInstallments, int? Priority);

public sealed record ForecastSummaryResponse(decimal InitialBalance, decimal FinalBalance, decimal TotalIncome, decimal TotalExpense, decimal TotalResult, decimal ProjectedClosingBalance, decimal PlannedCommitmentAmount, decimal RemainingCommitmentAmount, IReadOnlyCollection<ForecastCommitmentResponse> Commitments, decimal RealizedIncome = 0m, decimal PlannedIncome = 0m, decimal RealizedExpense = 0m, decimal PlannedExpense = 0m, decimal RealResult = 0m, decimal ForecastResult = 0m);

public sealed record FinancialForecastResponse(DateOnly From, DateOnly To, ForecastSummaryResponse Summary, IReadOnlyCollection<ForecastMonthResponse> Months);
