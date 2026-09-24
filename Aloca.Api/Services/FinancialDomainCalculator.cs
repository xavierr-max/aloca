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

    public sealed record ReserveMetrics(
        decimal Reserved,
        decimal Unallocated,
        decimal UncoveredCommitments,
        decimal Free);

    public static decimal Reserved(IEnumerable<decimal> amounts) =>
        amounts.Sum(amount => Math.Max(0m, amount));

    public static decimal Unallocated(decimal currentBalance, decimal reserved) =>
        Math.Max(0m, currentBalance - Math.Max(0m, reserved));

    public static decimal CoverageDeficit(decimal pendingCommitments, decimal reserved) =>
        Math.Max(0m, pendingCommitments - Math.Max(0m, reserved));

    public static decimal Free(decimal unallocated, decimal uncoveredCommitments) =>
        Math.Max(0m, unallocated - Math.Max(0m, uncoveredCommitments));

    public static ReserveMetrics CalculateReserveMetrics(
        decimal currentBalance,
        decimal reserved,
        decimal pendingCommitments)
    {
        var normalizedReserved = Math.Max(0m, reserved);
        var unallocated = Unallocated(currentBalance, normalizedReserved);
        var uncovered = CoverageDeficit(Math.Max(0m, pendingCommitments), normalizedReserved);
        return new(normalizedReserved, unallocated, uncovered, Free(unallocated, uncovered));
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
