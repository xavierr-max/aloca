using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class CurrentBalanceAdjustmentTests
{
    private static readonly DateOnly Today = new(2026, 9, 15);

    [Fact]
    public async Task AdjustmentSetsTheCurrentBalanceWithoutChangingInitialBalanceOrHistory()
    {
        await using var db = CreateDb();
        var clock = new FixedClock(Today);
        var service = new FinancialSettingsService(db);

        await service.AdjustCurrentBalanceAsync(1000m, clock, default);
        db.Transactions.Add(new Transaction("Entrada histórica", 500m, TransactionType.Income, Today, null));
        await db.SaveChangesAsync();
        var second = await service.AdjustCurrentBalanceAsync(2000m, clock, default);

        Assert.Equal(2000m, second.SaldoReal);
        Assert.Equal(0m, second.InitialBalance);
        Assert.Equal(3, await db.Transactions.CountAsync());
        Assert.Equal(1500m, (await db.Transactions.Where(x => x.IsBalanceAdjustment).SumAsync(x => x.Amount)));
        Assert.Equal(500m, await db.Transactions.Where(x => !x.IsBalanceAdjustment).SumAsync(x => x.Amount));
    }

    [Fact]
    public async Task NegativeAdjustmentAndLaterRealizedMovementUseTheAdjustedBalance()
    {
        await using var db = CreateDb();
        var clock = new FixedClock(Today);
        var service = new FinancialSettingsService(db);

        await service.AdjustCurrentBalanceAsync(1000m, clock, default);
        var lowered = await service.AdjustCurrentBalanceAsync(600m, clock, default);
        Assert.Equal(600m, lowered.SaldoReal);

        db.Transactions.Add(new Transaction("Entrada depois do ajuste", 200m, TransactionType.Income, Today, null));
        db.Transactions.Add(new Transaction("Saída depois do ajuste", 100m, TransactionType.Expense, Today, null));
        await db.SaveChangesAsync();

        var final = await new FinancialBalanceService(db, clock).GetAsync(default);
        Assert.Equal(700m, final.SaldoReal);
    }

    [Fact]
    public async Task ReservationAndFutureCommitmentDoNotChangeCurrentBalance()
    {
        await using var db = CreateDb();
        var clock = new FixedClock(Today);
        var settings = new FinancialSettingsService(db);
        await settings.AdjustCurrentBalanceAsync(1000m, clock, default);
        var commitment = new FinancialCommitment("Futuro", 600m, 1, 0, 0m, null, true, Today.AddMonths(1));
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        commitment.Allocate(300m);
        await db.SaveChangesAsync();

        var balance = await new FinancialBalanceService(db, clock).GetAsync(default);
        Assert.Equal(1000m, balance.SaldoReal);
        Assert.Equal(300m, balance.TotalReservado);
    }

    [Fact]
    public async Task BalanceAdjustmentIsExcludedFromMonthlyIncomeExpenseAndResult()
    {
        await using var db = CreateDb();
        var clock = new FixedClock(Today);
        await new FinancialSettingsService(db).AdjustCurrentBalanceAsync(1000m, clock, default);

        var monthly = await new FinancialSummaryService(db, new FinancialBalanceService(db, clock), clock)
            .GetMonthlyAsync(new DateOnly(2026, 9, 1), default);

        Assert.Equal(0m, monthly.EntradasRealizadas);
        Assert.Equal(0m, monthly.SaidasRealizadas);
        Assert.Equal(0m, monthly.ResultadoReal);
        Assert.Equal(1000m, (await new FinancialBalanceService(db, clock).GetAsync(default)).SaldoReal);
    }

    private static AlocaDbContext CreateDb() => new(new DbContextOptionsBuilder<AlocaDbContext>()
        .UseInMemoryDatabase($"current-balance-{Guid.NewGuid()}").Options);

    private sealed class FixedClock(DateOnly today) : IBusinessClock
    {
        public DateTime UtcNow => today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        public DateTime LocalNow => UtcNow;
        public DateOnly Today => today;
    }
}
