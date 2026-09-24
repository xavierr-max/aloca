using Aloca.Api.Data;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed record FinancialBalanceSnapshot(
    decimal InitialBalance,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal SaldoReal,
    decimal TotalReservado,
    decimal SaldoNaoAlocado,
    decimal SaldoLivre,
    decimal DeficitCobertura)
{
    // Compatibility aliases for the existing API consumers.
    public decimal Balance => SaldoReal;
    public decimal CurrentBalance => SaldoReal;
    public decimal AllocatedAmount => TotalReservado;
    public decimal AllocatedBalance => TotalReservado;
    public decimal UnallocatedBalance => SaldoNaoAlocado;
    public decimal AvailableForAllocation => SaldoNaoAlocado;
    public decimal FreeBalance => SaldoLivre;
    public decimal AllocationDeficit => DeficitCobertura;
    public decimal CoverageDeficit => DeficitCobertura;
}

public static class FinancialCalculations
{
    public static decimal SaldoReal(decimal entradasConfirmadas, decimal saidasEfetivamentePagas) =>
        entradasConfirmadas - saidasEfetivamentePagas;

    public static decimal TotalReservado(IEnumerable<decimal> reservasNaoConsumidas) =>
        FinancialDomainCalculator.Reserved(reservasNaoConsumidas);

    public static decimal SaldoNaoAlocado(decimal saldoReal, decimal totalReservado) =>
        FinancialDomainCalculator.Unallocated(saldoReal, totalReservado);

    public static decimal DeficitCobertura(decimal valorNecessarioParaCobertura, decimal totalReservado) =>
        FinancialDomainCalculator.CoverageDeficit(valorNecessarioParaCobertura, totalReservado);

    public static decimal SaldoLivre(decimal saldoNaoAlocado, decimal deficitCobertura) =>
        FinancialDomainCalculator.Free(saldoNaoAlocado, deficitCobertura);
}

public sealed class FinancialBalanceService(AlocaDbContext dbContext, IBusinessClock? clock = null)
{
    private IBusinessClock Clock => clock ?? new SystemBusinessClock(new ConfigurationBuilder().Build());
    public AlocaDbContext DbContext => dbContext;
    public async Task<FinancialBalanceSnapshot> GetAsync(CancellationToken cancellationToken)
    {
        var today = Clock.Today;
        var totalIncome = await dbContext.Transactions.Where(x => x.Type == TransactionType.Income && x.Date <= today).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var totalExpense = await dbContext.Transactions.Where(x => x.Type == TransactionType.Expense && x.Date <= today).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var activeCommitments = await dbContext.FinancialCommitments
            .Where(x => x.TotalInstallments == 0 || x.PaidInstallments < x.TotalInstallments)
            .Select(x => new { x.RemainingAmount, x.AllocatedAmount })
            .ToListAsync(cancellationToken);
        var totalReserved = FinancialCalculations.TotalReservado(activeCommitments.Select(x => x.AllocatedAmount));
        var initialBalance = await dbContext.FinancialSettings.Select(x => (decimal?)x.InitialBalance).SingleOrDefaultAsync(cancellationToken) ?? 0m;
        var saldoReal = FinancialCalculations.SaldoReal(initialBalance + totalIncome, totalExpense);
        var requiredCoverage = activeCommitments.Sum(x => x.RemainingAmount);
        var metrics = FinancialDomainCalculator.CalculateReserveMetrics(saldoReal, totalReserved, requiredCoverage);
        return new(initialBalance, totalIncome, totalExpense, saldoReal,
            metrics.Reserved, metrics.Unallocated, metrics.Free, metrics.UncoveredCommitments);
    }
}
