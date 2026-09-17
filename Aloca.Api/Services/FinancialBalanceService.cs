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
        var totalIncome = await dbContext.Transactions.Where(x => x.Type == TransactionType.Income).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var totalExpense = await dbContext.Transactions.Where(x => x.Type == TransactionType.Expense).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var allocated = await dbContext.FinancialCommitments.SumAsync(x => (decimal?)x.AllocatedAmount, cancellationToken) ?? 0m;
        var initialBalance = await dbContext.FinancialSettings.Select(x => (decimal?)x.InitialBalance).SingleOrDefaultAsync(cancellationToken) ?? 0m;
        var balance = initialBalance + totalIncome - totalExpense;
        return new(initialBalance, totalIncome, totalExpense, balance, allocated, decimal.Max(0m, balance - allocated), decimal.Max(0m, allocated - balance));
    }
}
