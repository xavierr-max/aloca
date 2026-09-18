namespace Aloca.Api.DTOs;

public sealed record FinancialSummaryResponse(
    decimal InitialBalance,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal Balance,
    decimal AllocatedAmount,
    decimal UnallocatedBalance,
    decimal FreeBalance,
    decimal AllocationDeficit)
{
    public decimal SaldoReal => Balance;
    public decimal TotalReservado => AllocatedAmount;
    public decimal SaldoNaoAlocado => UnallocatedBalance;
    public decimal SaldoLivre => FreeBalance;
    public decimal DeficitCobertura => AllocationDeficit;
}
