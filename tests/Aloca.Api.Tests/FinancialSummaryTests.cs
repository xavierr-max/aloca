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
        Assert.Empty(result.UrgentCommitments);
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
        Assert.Equal(commitment.Id, item.CommitmentId);
        Assert.Null(item.Priority);
        Assert.False(item.Urgent);
        Assert.False(item.RequiresAttention);
        Assert.False(item.IsCompleted);
    }

    [Fact]
    public async Task MonthlyCommitmentResponseExposesUrgentUncoveredCommitmentMetadata()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Urgente", 100m, 1, 0, 0m, 2, true, today, urgent: true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var item = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).Commitments);

        Assert.Equal(commitment.Id, item.CommitmentId);
        Assert.Equal(2, item.Priority);
        Assert.True(item.Urgent);
        Assert.True(item.RequiresAttention);
        Assert.False(item.IsCompleted);
        Assert.Equal("none", item.CoverageStatus);
    }

    [Fact]
    public async Task UrgentPartiallyCoveredCommitmentStillRequiresAttention()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Urgente parcial", 100m, 3, 0, 50m, 1, true, today, urgent: true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var item = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).Commitments);

        Assert.True(item.Urgent);
        Assert.True(item.RequiresAttention);
        Assert.True(item.OverallRemainingAmount > 0m);
    }

    [Fact]
    public async Task UrgentCommitmentWithCurrentInstallmentCoveredStillRequiresAttentionGlobally()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Urgente futuro", 100m, 3, 0, 100m, 1, true, today, urgent: true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var item = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).Commitments);

        Assert.Equal("covered", item.CoverageStatus);
        Assert.Equal(0m, item.RemainingAmount);
        Assert.True(item.Urgent);
        Assert.True(item.RequiresAttention);
        Assert.Equal(200m, item.OverallRemainingAmount);
        var urgent = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).UrgentCommitments);
        Assert.Equal(commitment.Id, urgent.CommitmentId);
        Assert.Equal(200m, urgent.OverallRemainingAmount);
    }

    [Fact]
    public async Task UrgentCommitmentRemainsVisibleWhenSelectedMonthHasNoInstallment()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var nextMonth = today.AddMonths(1);
        var commitment = new FinancialCommitment("Urgente futuro", 100m, RecurringIncomeFrequency.Once, nextMonth, nextMonth, 1, true, urgent: true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var result = await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default);

        Assert.Empty(result.Commitments);
        var urgent = Assert.Single(result.UrgentCommitments);
        Assert.Equal(commitment.Id, urgent.CommitmentId);
        Assert.Equal(100m, urgent.OverallRemainingAmount);
    }

    [Fact]
    public async Task MultipleMonthlyOccurrencesOfOneUrgentCommitmentAreReturnedOnceGlobally()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Urgente semanal", 100m, RecurringIncomeFrequency.Weekly, today, today.AddDays(20), 1, true, urgent: true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var result = await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default);

        Assert.True(result.Commitments.Count >= 2);
        var urgent = Assert.Single(result.UrgentCommitments);
        Assert.Equal(commitment.Id, urgent.CommitmentId);
    }

    [Fact]
    public async Task PaidCurrentInstallmentWithFutureInstallmentsStillRequiresAttention()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Urgente paga", 100m, 3, 0, 0m, 1, true, today, urgent: true);
        db.FinancialCommitments.Add(commitment);
        db.CommitmentPayments.Add(new CommitmentPayment(commitment.Id, 100m, 1, DateTime.UtcNow));
        commitment.RegisterPayment();
        await db.SaveChangesAsync();

        var item = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).Commitments);

        Assert.True(item.IsPaid);
        Assert.True(item.Urgent);
        Assert.True(item.RequiresAttention);
        Assert.Equal(200m, item.OverallRemainingAmount);
    }

    [Fact]
    public async Task MonthlyCommitmentResponseMarksCoveredUrgentCommitmentWithoutAttention()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Urgente coberto", 100m, 1, 0, 0m, 1, true, today, urgent: true);
        commitment.Allocate(100m);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var item = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).Commitments);

        Assert.Equal(commitment.Id, item.CommitmentId);
        Assert.True(item.Urgent);
        Assert.False(item.RequiresAttention);
        Assert.False(item.IsCompleted);
        Assert.Equal("covered", item.CoverageStatus);
    }

    [Fact]
    public async Task CompletedUrgentCommitmentDoesNotRequireAttention()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Urgente concluído", 100m, 1, 0, 0m, 1, true, today, urgent: true);
        db.FinancialCommitments.Add(commitment);
        db.CommitmentPayments.Add(new CommitmentPayment(commitment.Id, 100m, 1, DateTime.UtcNow));
        commitment.RegisterPayment();
        await db.SaveChangesAsync();

        var item = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).Commitments);

        Assert.True(item.IsCompleted);
        Assert.Equal(0m, item.OverallRemainingAmount);
        Assert.False(item.RequiresAttention);
    }

    [Fact]
    public async Task IncompleteNonUrgentCommitmentDoesNotRequireUrgentAttention()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Normal incompleto", 100m, 3, 0, 0m, 1, true, today);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var item = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).Commitments);

        Assert.False(item.Urgent);
        Assert.True(item.OverallRemainingAmount > 0m);
        Assert.False(item.RequiresAttention);
    }

    [Fact]
    public async Task MonthlyCommitmentResponseExposesPaidAndCompletedState()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Pago", 100m, 1, 0, 0m, 3, true, today, urgent: false);
        db.FinancialCommitments.Add(commitment);
        db.CommitmentPayments.Add(new CommitmentPayment(commitment.Id, 100m, 1, DateTime.UtcNow));
        commitment.RegisterPayment();
        await db.SaveChangesAsync();

        var item = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).Commitments);

        Assert.Equal(commitment.Id, item.CommitmentId);
        Assert.Equal(3, item.Priority);
        Assert.False(item.Urgent);
        Assert.False(item.RequiresAttention);
        Assert.True(item.IsPaid);
        Assert.True(item.IsCompleted);
        Assert.Equal("covered", item.CoverageStatus);
    }

    [Fact]
    public async Task MonthlyCommitmentResponseExposesNonUrgentCommitment()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commitment = new FinancialCommitment("Normal", 100m, 1, 0, 0m, null, true, today);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var item = Assert.Single((await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default)).Commitments);

        Assert.Equal(commitment.Id, item.CommitmentId);
        Assert.Null(item.Priority);
        Assert.False(item.Urgent);
        Assert.False(item.RequiresAttention);
        Assert.False(item.IsCompleted);
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
