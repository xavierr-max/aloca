using Aloca.Api.Data;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed record FinancialBalanceSnapshot(decimal InitialBalance, decimal TotalIncome, decimal TotalExpense, decimal CurrentBalance, DateOnly BusinessDate)
{
    public decimal Balance => CurrentBalance;
    public decimal SaldoReal => CurrentBalance;
}

public static class FinancialCalculations
{
    public static decimal CurrentBalance(decimal initialBalance, decimal effectiveIncome, decimal effectiveExpense) => initialBalance + effectiveIncome - effectiveExpense;
}

public sealed class FinancialBalanceService(AlocaDbContext dbContext, IBusinessClock? clock = null)
{
    private IBusinessClock Clock => clock ?? new SystemBusinessClock(new ConfigurationBuilder().Build());
    public AlocaDbContext DbContext => dbContext;

    public async Task<FinancialBalanceSnapshot> GetAsync(CancellationToken cancellationToken)
    {
        var today = Clock.Today;
        var income = await dbContext.Transactions.Where(x => x.Type == TransactionType.Income && x.Date <= today).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var expense = await dbContext.Transactions.Where(x => x.Type == TransactionType.Expense && x.Date <= today).SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;
        var initial = await dbContext.FinancialSettings.Select(x => (decimal?)x.InitialBalance).SingleOrDefaultAsync(cancellationToken) ?? 0m;
        return new(initial, income, expense, FinancialCalculations.CurrentBalance(initial, income, expense), today);
    }
}
