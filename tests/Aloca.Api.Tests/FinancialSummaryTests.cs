using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class FinancialSummaryTests
{
    [Fact]
    public async Task SummaryUsesEffectiveTransactionsOnly()
    {
        await using var db = Db();
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.Transactions.Add(new Transaction("Despesa", 250m, TransactionType.Expense, new DateOnly(2026, 9, 1), null));
        await db.SaveChangesAsync();
        var summary = await new FinancialSummaryService(db).GetAsync(default);
        Assert.Equal(750m, summary.CurrentBalance);
        Assert.Equal(250m, summary.TotalExpense);
    }

    [Fact]
    public async Task PendingCommitmentAppearsInMonthlyPlanningWithoutReducingBalance()
    {
        await using var db = Db();
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.FinancialCommitments.Add(new FinancialCommitment("Conta", 200m, 1, 0, null, new DateOnly(2026, 9, 20)));
        await db.SaveChangesAsync();
        var summary = await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(2026, 9, 1), default);
        Assert.Equal(1000m, summary.EstimatedFinalBalance);
        Assert.Equal(200m, summary.PlannedAmount);
        Assert.Equal(1000m, (await new FinancialBalanceService(db).GetAsync(default)).CurrentBalance);
    }

    private static AlocaDbContext Db()
        => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
