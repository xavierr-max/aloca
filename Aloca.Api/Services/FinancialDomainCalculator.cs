namespace Aloca.Api.Services;

/// <summary>
/// Pure financial-domain formulas. Application services collect events and
/// reservations; this type defines how the resulting metrics are derived.
/// </summary>
public static class FinancialDomainCalculator
{
    public sealed record PeriodMetrics(
        decimal RealizedIncome,
        decimal PlannedIncome,
        decimal TotalIncome,
        decimal RealizedExpense,
        decimal PlannedExpense,
        decimal TotalExpense,
        decimal RealResult,
        decimal ForecastResult);

    public static PeriodMetrics CalculatePeriodMetrics(
        decimal realizedIncome,
        decimal plannedIncome,
        decimal realizedExpense,
        decimal plannedExpense)
    {
        var totalIncome = realizedIncome + plannedIncome;
        var totalExpense = realizedExpense + plannedExpense;
        return new(realizedIncome, plannedIncome, totalIncome,
            realizedExpense, plannedExpense, totalExpense,
            RealResult(realizedIncome, realizedExpense),
            ForecastResult(realizedIncome, plannedIncome, realizedExpense, plannedExpense));
    }

    public static decimal RealResult(decimal realizedIncome, decimal realizedExpense) =>
        realizedIncome - realizedExpense;

    public static decimal ForecastResult(decimal realizedIncome, decimal plannedIncome,
        decimal realizedExpense, decimal plannedExpense) =>
        realizedIncome + plannedIncome - realizedExpense - plannedExpense;

    public static decimal EstimatedClosingBalance(decimal currentBalance,
        decimal futureIncome, decimal futureExpense) =>
        currentBalance + futureIncome - futureExpense;
}
