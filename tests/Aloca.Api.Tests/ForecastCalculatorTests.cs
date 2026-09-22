using Aloca.Api.Services;

namespace Aloca.Api.Tests;

public sealed class ForecastCalculatorTests
{
    [Fact]
    public void CalculatesOnlyIncome()
    {
        var result = Calculate(100m, Event(ForecastEventType.Income, ForecastEventStatus.Realized, 250m, new(2026, 9, 5)));

        var month = Assert.Single(result.Months);
        Assert.Equal(250m, month.RealizedIncome);
        Assert.Equal(250m, month.TotalIncome);
        Assert.Equal(0m, month.TotalExpense);
        Assert.Equal(350m, month.ClosingBalance);
    }

    [Fact]
    public void CalculatesOnlyExpenses()
    {
        var result = Calculate(100m, Event(ForecastEventType.Expense, ForecastEventStatus.Planned, 250m, new(2026, 9, 5)));

        var month = Assert.Single(result.Months);
        Assert.Equal(250m, month.PlannedExpense);
        Assert.Equal(-250m, month.MonthlyResult);
        Assert.Equal(-150m, month.ClosingBalance);
    }

    [Fact]
    public void CalculatesIncomeAndExpensesTogether()
    {
        var result = Calculate(100m, new[] {
            Event(ForecastEventType.Income, ForecastEventStatus.Realized, 500m, new(2026, 9, 5)),
            Event(ForecastEventType.Income, ForecastEventStatus.Planned, 100m, new(2026, 9, 10)),
            Event(ForecastEventType.Expense, ForecastEventStatus.Realized, 200m, new(2026, 9, 12)),
            Event(ForecastEventType.Expense, ForecastEventStatus.Planned, 50m, new(2026, 9, 15)) }, new(2026, 9, 1), new(2026, 9, 30));

        var month = Assert.Single(result.Months);
        Assert.Equal(600m, month.TotalIncome);
        Assert.Equal(250m, month.TotalExpense);
        Assert.Equal(350m, month.MonthlyResult);
        Assert.Equal(450m, month.ClosingBalance);
        Assert.Equal(2, month.IncomeItems.Count);
        Assert.Equal(2, month.ExpenseItems.Count);
    }

    [Fact]
    public void EmptyMonthCarriesPreviousBalance()
    {
        var result = Calculate(100m, new[] { Event(ForecastEventType.Income, ForecastEventStatus.Planned, 50m, new(2026, 9, 5)) }, new(2026, 9, 1), new(2026, 10, 31));

        Assert.Equal(150m, result.Months.First().ClosingBalance);
        var empty = result.Months.Last();
        Assert.Equal(150m, empty.OpeningBalance);
        Assert.Equal(150m, empty.ClosingBalance);
        Assert.Empty(empty.IncomeItems);
        Assert.Empty(empty.ExpenseItems);
    }

    [Fact]
    public void AllowsNegativeProjectedBalance()
    {
        var result = Calculate(10m, Event(ForecastEventType.Expense, ForecastEventStatus.Planned, 25m, new(2026, 9, 5)));

        Assert.Equal(-15m, Assert.Single(result.Months).ClosingBalance);
    }

    [Fact]
    public void AccumulatesAcrossSeveralMonths()
    {
        var result = Calculate(100m, new[] {
            Event(ForecastEventType.Income, ForecastEventStatus.Planned, 50m, new(2026, 9, 5)),
            Event(ForecastEventType.Expense, ForecastEventStatus.Planned, 20m, new(2026, 10, 5)),
            Event(ForecastEventType.Income, ForecastEventStatus.Realized, 10m, new(2026, 11, 5)) }, new(2026, 9, 1), new(2026, 11, 30));

        var months = result.Months.ToList();
        Assert.Equal(100m, months[0].OpeningBalance);
        Assert.Equal(150m, months[0].ClosingBalance);
        Assert.Equal(150m, months[1].OpeningBalance);
        Assert.Equal(130m, months[1].ClosingBalance);
        Assert.Equal(130m, months[2].OpeningBalance);
        Assert.Equal(140m, months[2].ClosingBalance);
    }

    [Fact]
    public void HandlesYearBoundaryChronologically()
    {
        var result = Calculate(100m, new[] {
            Event(ForecastEventType.Income, ForecastEventStatus.Planned, 20m, new(2026, 12, 20)),
            Event(ForecastEventType.Expense, ForecastEventStatus.Planned, 15m, new(2027, 1, 5)) }, new(2026, 12, 1), new(2027, 1, 31));

        Assert.Equal(2026, result.Months.First().Year);
        Assert.Equal(12, result.Months.First().Month);
        Assert.Equal(120m, result.Months.First().ClosingBalance);
        Assert.Equal(120m, result.Months.Last().OpeningBalance);
        Assert.Equal(105m, result.Months.Last().ClosingBalance);
    }

    [Fact]
    public void ClosingBalanceBecomesNextOpeningBalance()
    {
        var result = Calculate(75m, new[] {
            Event(ForecastEventType.Income, ForecastEventStatus.Planned, 25m, new(2026, 9, 5)),
            Event(ForecastEventType.Expense, ForecastEventStatus.Planned, 10m, new(2026, 10, 5)) }, new(2026, 9, 1), new(2026, 10, 31));

        var months = result.Months.ToList();
        Assert.Equal(months[0].ClosingBalance, months[1].OpeningBalance);
    }

    private static Aloca.Api.DTOs.FinancialForecastResponse Calculate(
        decimal openingBalance,
        IEnumerable<ForecastEvent> events,
        DateOnly from,
        DateOnly to) =>
        new ForecastCalculator().Calculate(from, to, events, openingBalance);

    private static Aloca.Api.DTOs.FinancialForecastResponse Calculate(
        decimal openingBalance,
        ForecastEvent @event) =>
        new ForecastCalculator().Calculate(new(2026, 9, 1), new(2026, 9, 30), new[] { @event }, openingBalance);

    private static ForecastEvent Event(ForecastEventType type, ForecastEventStatus status, decimal amount, DateOnly date) =>
        new(Guid.NewGuid().ToString("N"), type, status, amount, date, status == ForecastEventStatus.Planned ? date : null,
            null, null, null, null, null, null, ForecastEventOrigin.Transaction, "Teste", null);
}
