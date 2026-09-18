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
    int? TotalInstallments);

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
    IReadOnlyCollection<FinancialProjectionMonthResponse> Months);
