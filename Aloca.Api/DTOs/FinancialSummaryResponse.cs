namespace Aloca.Api.DTOs;

public sealed record FinancialSummaryResponse(
    decimal InitialBalance,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal CurrentBalance,
    decimal AllocatedBalance,
    decimal UnallocatedBalance,
    decimal FreeBalance,
    decimal CoverageDeficit,
    DateOnly? BusinessDate = null)
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
    IReadOnlyCollection<MonthlyCommitmentResponse> Commitments,
    IReadOnlyCollection<MonthlyUrgentCommitmentResponse> UrgentCommitments,
    decimal EntradasRealizadas = 0m,
    decimal EntradasPrevistas = 0m,
    decimal EntradasTotais = 0m,
    decimal SaidasRealizadas = 0m,
    decimal SaidasPrevistas = 0m,
    decimal SaidasTotais = 0m,
    decimal ResultadoReal = 0m,
    decimal ResultadoPrevisto = 0m);

public sealed record MonthlyUrgentCommitmentResponse(
    Guid CommitmentId,
    string Name,
    decimal OverallRemainingAmount);

public sealed record MonthlyCommitmentResponse(
    Guid CommitmentId,
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
    bool IsCovered,
    int? Priority,
    bool Urgent,
    bool RequiresAttention,
    bool IsCompleted,
    decimal OverallRemainingAmount)
{
    public string CoverageStatus => IsCovered ? "covered" : AllocatedAmount > 0m ? "partial" : "none";
}
