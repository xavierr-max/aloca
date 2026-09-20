using Aloca.Api.Models;

namespace Aloca.Api.DTOs;

public sealed record ProjectionMovementResponse(
    string Id,
    string Description,
    decimal Amount,
    DateOnly Date,
    string? Category,
    bool Recurring,
    int? Installment,
    int? TotalInstallments)
{
    public string Source { get; init; } = ProjectionMovementSources.Transaction;

    // These values are populated by the projection domain when the movement
    // is an installment. They keep coverage calculation out of the UI.
    public decimal ReservedAmount { get; init; }
    public decimal RemainingAmount => Math.Max(Amount - ReservedAmount, 0m);
    public decimal CoveragePercentage => Amount <= 0m ? 100m : Math.Min(100m, ReservedAmount / Amount * 100m);
    public string CoverageStatus => RemainingAmount <= 0m ? "covered" : ReservedAmount > 0m ? "partial" : "none";
}

public static class ProjectionMovementSources
{
    public const string Transaction = "transaction";
    public const string RecurringIncome = "recurring-income";
    public const string Commitment = "commitment";
}

public sealed record FinancialProjectionMonthResponse(
    DateOnly Month,
    decimal OpeningBalance,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal Result,
    decimal ProjectedBalance,
    IReadOnlyCollection<ProjectionMovementResponse> Incomes,
    IReadOnlyCollection<ProjectionMovementResponse> Expenses)
{
    public decimal RecordedExpense => Expenses.Where(x => x.Installment is null).Sum(x => x.Amount);
    public decimal CommitmentExpense => Expenses.Where(x => x.Installment is not null).Sum(x => x.Amount);
    public decimal CommitmentReserved => Expenses.Where(x => x.Installment is not null).Sum(x => x.ReservedAmount);
    public decimal CommitmentPending => Expenses.Where(x => x.Installment is not null).Sum(x => x.RemainingAmount);
    public decimal Entries => TotalIncome;
    public decimal ExpensesTotal => TotalExpense;
    public decimal NetResult => Result;
    public decimal ClosingBalance => ProjectedBalance;
}

public sealed record FinancialProjectionResponse(
    decimal CurrentBalance,
    decimal TotalProjectedIncome,
    decimal TotalProjectedExpense,
    decimal FinalProjectedBalance,
    IReadOnlyCollection<FinancialProjectionMonthResponse> Months)
{
    public decimal TotalRecordedExpense => Months.Sum(x => x.RecordedExpense);
    public decimal TotalCommitmentExpense => Months.Sum(x => x.CommitmentExpense);
    public IReadOnlyCollection<UrgentCommitmentAttentionResponse> UrgentCommitments { get; init; } = Array.Empty<UrgentCommitmentAttentionResponse>();
}

public sealed record UrgentCommitmentAttentionResponse(
    Guid Id,
    string Name,
    decimal TotalAmount,
    decimal AllocatedAmount,
    decimal RemainingAmount,
    decimal OverallCoverage,
    bool IsUrgent,
    bool RequiresAttention);
