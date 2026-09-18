using Aloca.Api.Models;

namespace Aloca.Api.Tests;

public sealed class FinancialCommitmentScheduleTests
{
    private static readonly DateOnly ReferenceDate = new(2026, 9, 18);

    [Fact]
    public void IncludesInstallmentDueTodayRegardlessOfTimeOfExecution()
    {
        var commitment = new FinancialCommitment("Hoje", 63.66m, 3, 0, 0m, 1, true, ReferenceDate);

        var schedule = FinancialCommitmentSchedule.GetPendingInstallments(commitment, ReferenceDate);

        Assert.Equal(new[] { 1, 2, 3 }, schedule.Select(x => x.Number));
        Assert.Equal(new[]
        {
            new DateOnly(2026, 9, 18),
            new DateOnly(2026, 10, 18),
            new DateOnly(2026, 11, 18)
        }, schedule.Select(x => x.DueDate));
    }

    [Fact]
    public void StartsTheScheduleInTheChosenFutureMonth()
    {
        var commitment = new FinancialCommitment("Outubro", 100m, 3, 0, 0m, 1, true, new DateOnly(2026, 10, 18));

        var schedule = FinancialCommitmentSchedule.GetPendingInstallments(commitment, ReferenceDate);

        Assert.Equal(new[]
        {
            new DateOnly(2026, 10, 18),
            new DateOnly(2026, 11, 18),
            new DateOnly(2026, 12, 18)
        }, schedule.Select(x => x.DueDate));
    }

    [Fact]
    public void UsesPaidInstallmentsToChooseTheFirstPendingNumber()
    {
        var commitment = new FinancialCommitment("Parcial", 100m, 3, 1, 0m, 1, true, ReferenceDate);

        var schedule = FinancialCommitmentSchedule.GetPendingInstallments(commitment, ReferenceDate);

        Assert.Equal(new[] { 2, 3 }, schedule.Select(x => x.Number));
        Assert.Equal(new[]
        {
            new DateOnly(2026, 10, 18),
            new DateOnly(2026, 11, 18)
        }, schedule.Select(x => x.DueDate));
    }

    [Fact]
    public void KeepsUnpaidOverdueInstallmentInThePendingSchedule()
    {
        var commitment = new FinancialCommitment("Atrasada", 50m, 2, 0, 0m, 1, true, ReferenceDate.AddDays(-1));

        var schedule = FinancialCommitmentSchedule.GetPendingInstallments(commitment, ReferenceDate);

        Assert.Equal(new[] { 1, 2 }, schedule.Select(x => x.Number));
        Assert.Equal(ReferenceDate.AddDays(-1), schedule[0].DueDate);
    }

    [Fact]
    public void ReturnsNoScheduleWhenAllInstallmentsArePaid()
    {
        var commitment = new FinancialCommitment("Quitada", 50m, 3, 3, 0m, 1, true, ReferenceDate);

        Assert.Empty(FinancialCommitmentSchedule.GetPendingInstallments(commitment, ReferenceDate));
    }

    [Fact]
    public void GeneratesTheExpectedRemainingSequenceForOneTwoAndThreeInstallments()
    {
        var one = new FinancialCommitment("Um", 10m, 1, 0, 0m, 1, true, ReferenceDate);
        var two = new FinancialCommitment("Dois", 10m, 2, 1, 0m, 1, true, ReferenceDate);
        var three = new FinancialCommitment("Tres", 10m, 3, 2, 0m, 1, true, ReferenceDate);

        Assert.Equal(new[] { 1 }, FinancialCommitmentSchedule.GetPendingInstallments(one, ReferenceDate).Select(x => x.Number));
        Assert.Equal(new[] { 2 }, FinancialCommitmentSchedule.GetPendingInstallments(two, ReferenceDate).Select(x => x.Number));
        Assert.Equal(new[] { 3 }, FinancialCommitmentSchedule.GetPendingInstallments(three, ReferenceDate).Select(x => x.Number));
    }

    [Fact]
    public void PreservesTheStoredCentAmountForEachInstallment()
    {
        var first = new FinancialCommitment("Valorant", 63.66m, 3, 0, 0m, 1, true, ReferenceDate);
        var second = new FinancialCommitment("Refund", 66.67m, 3, 0, 0m, 1, true, ReferenceDate);

        Assert.Equal(190.98m, FinancialCommitmentSchedule.GetPendingInstallments(first, ReferenceDate).Sum(x => x.Amount));
        Assert.Equal(200.01m, FinancialCommitmentSchedule.GetPendingInstallments(second, ReferenceDate).Sum(x => x.Amount));
    }

    [Fact]
    public void UsesCalendarMonthsAcrossYearAndEndOfMonth()
    {
        var yearTurn = new FinancialCommitment("Ano", 10m, 3, 0, 0m, 1, true, new DateOnly(2026, 12, 18));
        var endOfMonth = new FinancialCommitment("Fim", 10m, 3, 0, 0m, 1, true, new DateOnly(2027, 1, 31));

        Assert.Equal(new[]
        {
            new DateOnly(2026, 12, 18), new DateOnly(2027, 1, 18), new DateOnly(2027, 2, 18)
        }, FinancialCommitmentSchedule.GetPendingInstallments(yearTurn, ReferenceDate).Select(x => x.DueDate));
        Assert.Equal(new[]
        {
            new DateOnly(2027, 1, 31), new DateOnly(2027, 2, 28), new DateOnly(2027, 3, 31)
        }, FinancialCommitmentSchedule.GetPendingInstallments(endOfMonth, ReferenceDate).Select(x => x.DueDate));
    }
}
