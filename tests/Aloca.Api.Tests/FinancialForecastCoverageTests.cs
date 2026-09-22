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

    private sealed class FixedForecastClock(DateOnly today) : IBusinessClock
    {
        public DateTime UtcNow => today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        public DateTime LocalNow => UtcNow;
        public DateOnly Today => today;
    }

    private static decimal Coverage(decimal allocated, decimal required) =>
        required <= 0m ? 100m : Math.Min(100m, Math.Max(0m, allocated / required * 100m));
}
