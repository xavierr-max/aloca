using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class FinancialSummaryTests
{
    [Fact]
    public async Task EmptyMonthReturnsACompleteZeroSummary()
    {
        await using var db = CreateDb();

        var result = await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(2026, 9, 1), default);

        Assert.Equal(new DateOnly(2026, 9, 1), result.Period);
        Assert.Equal(0m, result.RecurringIncomeTotal);
        Assert.Equal(0m, result.CommitmentTotal);
        Assert.Equal(0m, result.MonthlyResult);
        Assert.Equal(0m, result.AllocatedAmount);
        Assert.Equal(0m, result.MissingAmount);
        Assert.Equal(100m, result.CoveragePercentage);
        Assert.Empty(result.Commitments);
    }

    [Fact]
    public async Task HandlesOpenEndedCommitmentWithoutGroupAndPartialAllocation()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Recorrente", 100m, RecurringIncomeFrequency.Monthly, today, null, null, true);
        commitment.Allocate(40m);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var result = await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default);

        var item = Assert.Single(result.Commitments);
        Assert.Equal(100m, item.DueAmount);
        Assert.Equal(40m, item.AllocatedAmount);
        Assert.Equal(60m, item.RemainingAmount);
        Assert.Equal("partial", item.CoverageStatus);
    }

    [Fact]
    public async Task HandlesRecurringIncomeWithoutGroupAndPaidCommitment()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var income = new RecurringIncome("Entrada", 250m, null, RecurringIncomeFrequency.Monthly, today, null, today.Day);
        var commitment = new FinancialCommitment("Pago", 100m, 1, 1, 0m, null, true, today);
        db.RecurringIncomes.Add(income);
        db.FinancialCommitments.Add(commitment);
        db.CommitmentPayments.Add(new CommitmentPayment(commitment.Id, 100m, 1, DateTime.UtcNow));
        await db.SaveChangesAsync();

        var result = await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default);

        Assert.Equal(250m, result.RecurringIncomeTotal);
        var item = Assert.Single(result.Commitments);
        Assert.True(item.IsPaid);
        Assert.Equal(0m, item.RemainingAmount);
    }

    [Fact]
    public async Task DoesNotFailWhenLegacyRecurringIncomeHasDuplicateForecastRows()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var income = new RecurringIncome("Entrada", 250m, null, RecurringIncomeFrequency.Monthly, today, null, today.Day);
        db.RecurringIncomes.Add(income);
        db.RecurringIncomeOccurrences.Add(new RecurringIncomeOccurrence(income, today));
        db.RecurringIncomeOccurrences.Add(new RecurringIncomeOccurrence(income, today));
        await db.SaveChangesAsync();

        var result = await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default);

        Assert.NotNull(result);
        Assert.Equal(new DateOnly(today.Year, today.Month, 1), result.Period);
    }

    private static AlocaDbContext CreateDb() => new(new DbContextOptionsBuilder<AlocaDbContext>()
        .UseInMemoryDatabase($"summary-{Guid.NewGuid()}").Options);
}
