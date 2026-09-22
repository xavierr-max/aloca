using Aloca.Api.Services;

namespace Aloca.Api.DTOs;

public sealed record ForecastItemResponse(
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

public sealed record ForecastMonthResponse(
    int Year,
    int Month,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal OpeningBalance,
    decimal RealizedIncome,
    decimal PlannedIncome,
    decimal TotalIncome,
    decimal RealizedExpense,
    decimal PlannedExpense,
    decimal TotalExpense,
    decimal MonthlyResult,
    decimal ClosingBalance,
    IReadOnlyCollection<ForecastItemResponse> IncomeItems,
    IReadOnlyCollection<ForecastItemResponse> ExpenseItems,
    decimal Committed = 0m,
    decimal Allocated = 0m,
    decimal FreeBalance = 0m,
    decimal Coverage = 100m,
    IReadOnlyCollection<ForecastCommitmentResponse>? Commitments = null,
    decimal CoverageDeficit = 0m,
    decimal ConsideredBalance = 0m);

public sealed record ForecastCommitmentResponse(
    Guid FinancialCommitmentId,
    string Description,
    decimal RequiredAmount,
    decimal AllocatedAmount,
    decimal RemainingAmount,
    decimal CoveragePercentage,
    DateOnly DueDate,
    string Status,
    int InstallmentNumber,
    int? TotalInstallments,
    int? Priority);

public sealed record ForecastSummaryResponse(
    decimal InitialBalance,
    decimal FinalBalance,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal TotalResult,
    decimal ProjectedClosingBalance,
    decimal TotalCommitted,
    decimal TotalAllocated,
    decimal UnallocatedBalance,
    decimal CoverageDeficit,
    decimal FreeBalance,
    decimal RequiredAmount,
    decimal CoveragePercentage,
    IReadOnlyCollection<ForecastCommitmentResponse> Commitments);

public sealed record FinancialForecastResponse(
    DateOnly From,
    DateOnly To,
    ForecastSummaryResponse Summary,
    IReadOnlyCollection<ForecastMonthResponse> Months);
