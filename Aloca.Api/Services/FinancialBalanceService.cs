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
    public decimal AllocatedAmount => TotalReservado;
    public decimal UnallocatedBalance => SaldoNaoAlocado;
    public decimal FreeBalance => SaldoLivre;
    public decimal AllocationDeficit => DeficitCobertura;
}

public static class FinancialCalculations
{
    public static decimal SaldoReal(decimal entradasConfirmadas, decimal saidasEfetivamentePagas) =>
        entradasConfirmadas - saidasEfetivamentePagas;

    public static decimal TotalReservado(IEnumerable<decimal> reservasNaoConsumidas) =>
        reservasNaoConsumidas.Sum(x => Math.Max(0m, x));

    public static decimal SaldoNaoAlocado(decimal saldoReal, decimal totalReservado) =>
        Math.Max(0m, saldoReal - totalReservado);

    public static decimal DeficitCobertura(decimal valorNecessarioParaCobertura, decimal totalReservado) =>
        Math.Max(0m, valorNecessarioParaCobertura - totalReservado);

    public static decimal SaldoLivre(decimal saldoNaoAlocado, decimal deficitCobertura) =>
        Math.Max(0m, saldoNaoAlocado - deficitCobertura);
}

public sealed class FinancialBalanceService(AlocaDbContext dbContext)
{
    public async Task<FinancialBalanceSnapshot> GetAsync(CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var totalIncome = await dbContext.Transactions.Where(x => x.Type == TransactionType.Income && x.Date <= today).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var totalExpense = await dbContext.Transactions.Where(x => x.Type == TransactionType.Expense && x.Date <= today).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var totalCommitmentPayments = await dbContext.CommitmentPayments.Where(x => x.PaidAt.Date <= DateTime.UtcNow.Date).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var activeCommitments = await dbContext.FinancialCommitments
            .Where(x => x.PaidInstallments < x.TotalInstallments)
            .Select(x => new { x.RemainingAmount, x.AllocatedAmount })
            .ToListAsync(cancellationToken);
        var totalReserved = FinancialCalculations.TotalReservado(activeCommitments.Select(x => x.AllocatedAmount));
        var initialBalance = await dbContext.FinancialSettings.Select(x => (decimal?)x.InitialBalance).SingleOrDefaultAsync(cancellationToken) ?? 0m;
        var saldoReal = FinancialCalculations.SaldoReal(initialBalance + totalIncome, totalExpense + totalCommitmentPayments);
        var requiredCoverage = activeCommitments.Sum(x => x.RemainingAmount);
        var saldoNaoAlocado = FinancialCalculations.SaldoNaoAlocado(saldoReal, totalReserved);
        var deficitCobertura = FinancialCalculations.DeficitCobertura(requiredCoverage, totalReserved);
        var saldoLivre = FinancialCalculations.SaldoLivre(saldoNaoAlocado, deficitCobertura);
        return new(initialBalance, totalIncome, totalExpense, saldoReal, totalReserved, saldoNaoAlocado, saldoLivre, deficitCobertura);
    }
}
