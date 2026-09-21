namespace Aloca.Api.DTOs;

public sealed record FinancialSummaryResponse(
    decimal InitialBalance,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal CurrentBalance,
    decimal AllocatedBalance,
    decimal UnallocatedBalance,
    decimal FreeBalance,
    decimal CoverageDeficit)
{
    public decimal Balance => CurrentBalance;
    public decimal AllocatedAmount => AllocatedBalance;
    public decimal AllocationDeficit => CoverageDeficit;
    public decimal SaldoReal => CurrentBalance;
    public decimal TotalReservado => AllocatedBalance;
    public decimal SaldoNaoAlocado => UnallocatedBalance;
    public decimal SaldoLivre => FreeBalance;
    public decimal DeficitCobertura => CoverageDeficit;
}

public sealed record MonthlyFinancialSummaryResponse(
    DateOnly Period,
    decimal RecurringIncomeTotal,
    decimal CommitmentTotal,
    decimal MonthlyResult,
    decimal AllocatedAmount,
    decimal MissingAmount,
    decimal CoveragePercentage,
    decimal EstimatedFinalBalance,
    IReadOnlyCollection<MonthlyCommitmentResponse> Commitments);

public sealed record MonthlyCommitmentResponse(
    string Id,
    string Name,
    int? InstallmentNumber,
    int? TotalInstallments,
    DateOnly DueDate,
    decimal DueAmount,
    decimal AllocatedAmount,
    decimal RemainingAmount,
    decimal CoveragePercentage,
    bool IsPaid,
    bool IsCovered)
{
    public string CoverageStatus => IsCovered ? "covered" : AllocatedAmount > 0m ? "partial" : "none";
}
