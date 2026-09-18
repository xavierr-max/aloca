using Aloca.Api.Data;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed record FinancialBalanceSnapshot(
    decimal InitialBalance,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal Balance,
    decimal AllocatedAmount,
    decimal FreeBalance,
    decimal AllocationDeficit);

public sealed class FinancialBalanceService(AlocaDbContext dbContext)
{
    public async Task<FinancialBalanceSnapshot> GetAsync(CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var totalIncome = await dbContext.Transactions.Where(x => x.Type == TransactionType.Income && x.Date <= today).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var totalExpense = await dbContext.Transactions.Where(x => x.Type == TransactionType.Expense && x.Date <= today).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var totalCommitmentPayments = await dbContext.CommitmentPayments.Where(x => x.PaidAt.Date <= DateTime.UtcNow.Date).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var allocated = await dbContext.FinancialCommitments.SumAsync(x => (decimal?)x.AllocatedAmount, cancellationToken) ?? 0m;
        var initialBalance = await dbContext.FinancialSettings.Select(x => (decimal?)x.InitialBalance).SingleOrDefaultAsync(cancellationToken) ?? 0m;
        var balance = initialBalance + totalIncome - totalExpense - totalCommitmentPayments;
        var activeCommitments = await dbContext.FinancialCommitments
            .Where(x => x.PaidInstallments < x.TotalInstallments)
            .Select(x => new { x.RemainingAmount, x.AllocatedAmount })
            .ToListAsync(cancellationToken);
        var coverageDeficit = activeCommitments.Sum(x => decimal.Max(0m, x.RemainingAmount - x.AllocatedAmount));
        return new(initialBalance, totalIncome, totalExpense, balance, allocated, decimal.Max(0m, balance - allocated), coverageDeficit);
    }
}
