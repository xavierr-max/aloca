using Aloca.Api.Models;
using Aloca.Api.Services;
using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class FinancialForecastCoverageTests
{
    [Fact]
    public void CalculatesZeroCoverage()
    {
        var deficit = FinancialCalculations.DeficitCobertura(100m, 0m);
        Assert.Equal(0m, FinancialCalculations.TotalReservado(new[] { 0m }));
        Assert.Equal(100m, deficit);
        Assert.Equal(0m, Coverage(0m, 100m));
    }

    [Fact]
    public void CalculatesPartialCoverage()
    {
        Assert.Equal(40m, FinancialCalculations.TotalReservado(new[] { 40m }));
        Assert.Equal(60m, FinancialCalculations.DeficitCobertura(100m, 40m));
        Assert.Equal(40m, Coverage(40m, 100m));
    }

    [Fact]
    public void CalculatesFullCoverageAndCapsPresentation()
    {
        Assert.Equal(0m, FinancialCalculations.DeficitCobertura(100m, 100m));
        Assert.Equal(100m, Coverage(100m, 100m));
        Assert.Equal(100m, Coverage(125m, 100m));
    }

    [Fact]
    public void MultipleCommitmentsAreSummedWithoutMovingAllocations()
    {
        var commitments = new[] { 25m, 75m, 40m };
        var allocated = FinancialCalculations.TotalReservado(commitments);
        var required = 200m;

        Assert.Equal(140m, allocated);
        Assert.Equal(60m, FinancialCalculations.DeficitCobertura(required, allocated));
        Assert.Equal(70m, Coverage(allocated, required));
    }

    [Fact]
    public void PaidCommitmentHasNoRemainingRequiredAmount()
    {
        var commitment = new FinancialCommitment("Pago", 100m, 1, 1, 0m, null, true, new(2026, 9, 1));

        Assert.Equal(0m, commitment.RemainingAmount);
        Assert.True(commitment.IsCompleted);
    }

    [Fact]
    public void FutureCommitmentRemainsRequiredUntilPaid()
    {
        var commitment = new FinancialCommitment("Futuro", 100m, 1, 0, 0m, null, true, new(2027, 1, 1));

        Assert.Equal(100m, commitment.RemainingAmount);
        Assert.False(commitment.IsCompleted);
    }

    [Fact]
    public void FreeBalanceDoesNotBecomeAProjectedExpense()
    {
        var realBalance = 1000m;
        var reserved = 300m;
        var required = 500m;
        var unallocated = FinancialCalculations.SaldoNaoAlocado(realBalance, reserved);
        var deficit = FinancialCalculations.DeficitCobertura(required, reserved);
        var free = FinancialCalculations.SaldoLivre(unallocated, deficit);

        Assert.Equal(700m, unallocated);
        Assert.Equal(200m, deficit);
        Assert.Equal(500m, free);
        Assert.Equal(0m, 0m); // indicators do not alter the expense flow
    }

    [Fact]
    public async Task MonthlyFreeBalanceUsesTheSelectedMonthCommitments()
    {
        await using var db = new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.FinancialSettings.Add(new FinancialSettings(469.73m));
        db.FinancialCommitments.Add(new FinancialCommitment("Compromisso futuro", 500m, 1, 0, 0m, null, true, new(2026, 11, 1)));
        await db.SaveChangesAsync();
        var clock = new FixedForecastClock(new(2026, 9, 21));
        var service = new FinancialForecastService(new ForecastEventNormalizer(db), new ForecastCalculator(), new FinancialBalanceService(db, clock), clock);

        var result = await service.GetAsync(new DateOnly(2026, 9, 1), new DateOnly(2026, 12, 31), CancellationToken.None);

        var month = Assert.Single(result.Months, x => x.Month == 9);
        Assert.Equal(469.73m, month.ClosingBalance);
        Assert.Equal(0m, month.Committed);
        Assert.Equal(0m, month.Allocated);
        Assert.Equal(0m, month.CoverageDeficit);
        Assert.Equal(469.73m, month.FreeBalance);
    }

    [Fact]
    public async Task ForecastMaterializesActiveRecurringIncomeBeforeNormalizingEvents()
    {
        await using var db = new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.FinancialSettings.Add(new FinancialSettings(434.04m));
        db.RecurringIncomes.Add(new RecurringIncome("Teste#ER1", 100m, null, RecurringIncomeFrequency.Monthly, new(2026, 9, 22), null, 22));
        await db.SaveChangesAsync();
        var clock = new FixedForecastClock(new(2026, 9, 22));
        var service = new FinancialForecastService(new ForecastEventNormalizer(db), new ForecastCalculator(), new FinancialBalanceService(db, clock), clock);

        var result = await service.GetAsync(new DateOnly(2026, 9, 1), 6, CancellationToken.None);

        Assert.Equal(new[] { 100m, 100m, 100m, 100m, 100m, 100m }, result.Months.Select(x => x.TotalIncome).ToArray());
        Assert.Equal(new[] { 534.04m, 634.04m, 734.04m, 834.04m, 934.04m, 1034.04m }, result.Months.Select(x => x.ClosingBalance).ToArray());
        Assert.Equal(600m, result.Summary.TotalIncome);
        Assert.Equal(1034.04m, result.Summary.ProjectedClosingBalance);
    }

    [Fact]
    public async Task FullyCoveredCommitmentKeepsReservedAmountSeparateFromCoverageDeficit()
    {
        await using var db = new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.FinancialSettings.Add(new FinancialSettings(434.04m));
        var commitment = new FinancialCommitment("Compromisso coberto", 75m, 1, 0, 75m, null, false, new(2026, 9, 22));
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var clock = new FixedForecastClock(new(2026, 9, 22));
        var service = new FinancialForecastService(new ForecastEventNormalizer(db), new ForecastCalculator(), new FinancialBalanceService(db, clock), clock);

        var result = await service.GetAsync(new DateOnly(2026, 9, 1), 6, CancellationToken.None);

        Assert.Equal(75m, result.Summary.TotalAllocated);
        Assert.Equal(75m, result.Summary.TotalCommitted);
        Assert.Equal(0m, result.Summary.CoverageDeficit);
        Assert.Equal(359.04m, result.Summary.UnallocatedBalance);
        Assert.Equal(359.04m, result.Summary.FreeBalance);
        var month = Assert.Single(result.Months, x => x.Month == 9);
        Assert.Equal(75m, month.Allocated);
        Assert.Equal(75m, month.Committed);
        Assert.Equal(100m, month.Coverage);
    }

    [Fact]
    public async Task ForecastStartsAtCurrentBalanceAndDoesNotRecountRealizedTransactions()
    {
        await using var db = new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var today = new DateOnly(2026, 9, 15);
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.Transactions.Add(new Transaction("Entrada realizada", 500m, TransactionType.Income, today, null));
        db.Transactions.Add(new Transaction("Saída realizada", 200m, TransactionType.Expense, today, null));
        db.Transactions.Add(new Transaction("Entrada futura", 300m, TransactionType.Income, today.AddDays(1), null));
        db.Transactions.Add(new Transaction("Saída futura", 400m, TransactionType.Expense, today.AddDays(2), null));
        await db.SaveChangesAsync();
        var clock = new FixedForecastClock(today);
        var service = new FinancialForecastService(new ForecastEventNormalizer(db, clock), new ForecastCalculator(), new FinancialBalanceService(db, clock), clock);

        var result = await service.GetAsync(new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), default);

        var month = Assert.Single(result.Months);
        Assert.Equal(1300m, month.OpeningBalance);
        Assert.Equal(300m, month.PlannedIncome);
        Assert.Equal(400m, month.PlannedExpense);
        Assert.Equal(1200m, month.ClosingBalance);
        Assert.Equal(1300m, result.Summary.InitialBalance);
        Assert.Equal(1200m, result.Summary.ProjectedClosingBalance);
    }

    [Fact]
    public async Task ForecastCarriesClosingBalanceIntoTheNextMonth()
    {
        await using var db = new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var today = new DateOnly(2026, 9, 15);
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.Transactions.Add(new Transaction("Entrada setembro", 500m, TransactionType.Income, new(2026, 9, 20), null));
        db.Transactions.Add(new Transaction("Saída setembro", 300m, TransactionType.Expense, new(2026, 9, 21), null));
        db.Transactions.Add(new Transaction("Entrada outubro", 100m, TransactionType.Income, new(2026, 10, 5), null));
        db.Transactions.Add(new Transaction("Saída outubro", 400m, TransactionType.Expense, new(2026, 10, 6), null));
        await db.SaveChangesAsync();
        var clock = new FixedForecastClock(today);
        var service = new FinancialForecastService(new ForecastEventNormalizer(db, clock), new ForecastCalculator(), new FinancialBalanceService(db, clock), clock);

        var result = await service.GetAsync(new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 31), default);
        var months = result.Months.ToList();

        Assert.Equal(1200m, months[0].ClosingBalance);
        Assert.Equal(1200m, months[1].OpeningBalance);
        Assert.Equal(900m, months[1].ClosingBalance);
    }

    [Fact]
    public async Task MonthlySummaryEstimatedBalanceMatchesForecastClosingBalance()
    {
        await using var db = new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var today = new DateOnly(2026, 9, 15);
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.Transactions.Add(new Transaction("Entrada futura", 300m, TransactionType.Income, today.AddDays(1), null));
        db.Transactions.Add(new Transaction("Saída futura", 400m, TransactionType.Expense, today.AddDays(2), null));
        await db.SaveChangesAsync();
        var clock = new FixedForecastClock(today);
        var balance = new FinancialBalanceService(db, clock);
        var forecast = new FinancialForecastService(new ForecastEventNormalizer(db, clock), new ForecastCalculator(), balance, clock);

        var projection = await forecast.GetAsync(new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), default);
        var summary = await new FinancialSummaryService(db, balance, clock).GetMonthlyAsync(new DateOnly(2026, 9, 1), default);

        Assert.Equal(projection.Summary.ProjectedClosingBalance, summary.EstimatedFinalBalance);
    }

    [Fact]
    public async Task ForecastSupportsThirtySixMonthsAndCarriesEachClosingBalanceForward()
    {
        await using var db = new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var today = new DateOnly(2026, 9, 15);
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.Transactions.Add(new Transaction("Entrada futura", 100m, TransactionType.Income, today.AddDays(1), null));
        await db.SaveChangesAsync();
        var clock = new FixedForecastClock(today);
        var service = new FinancialForecastService(new ForecastEventNormalizer(db, clock), new ForecastCalculator(), new FinancialBalanceService(db, clock), clock);

        var result = await service.GetAsync(new DateOnly(2026, 9, 1), 36, CancellationToken.None);
        var months = result.Months.ToList();

        Assert.Equal(36, months.Count);
        Assert.Equal(1100m, months[0].ClosingBalance);
        Assert.Equal(1100m, months[1].OpeningBalance);
        Assert.Equal(1100m, months[^1].ClosingBalance);
        Assert.Equal(new DateOnly(2029, 8, 31), result.To);
    }

    private sealed class FixedForecastClock(DateOnly today) : IBusinessClock
    {
        public DateTime UtcNow => today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        public DateTime LocalNow => UtcNow;
        public DateOnly Today => today;
    }

    private static decimal Coverage(decimal allocated, decimal required) =>
        required <= 0m ? 100m : Math.Min(100m, Math.Max(0m, allocated / required * 100m));
}
