using Aloca.Api.Services;

namespace Aloca.Api.Tests;

public sealed class FinancialDomainCalculatorTests
{
    [Fact]
    public void DerivesOfficialBalancesWithoutTreatingReserveAsExpense()
    {
        const decimal current = 1000m;
        const decimal reserved = 300m;
        const decimal pending = 600m;

        var unallocated = FinancialDomainCalculator.Unallocated(current, reserved);
        var deficit = FinancialDomainCalculator.CoverageDeficit(pending, reserved);

        Assert.Equal(700m, unallocated);
        Assert.Equal(300m, deficit);
        Assert.Equal(400m, FinancialDomainCalculator.Free(unallocated, deficit));
        Assert.Equal(1000m, current);
    }

    [Theory]
    [InlineData(1000, 600, 600, 600, 400, 0, 400)]
    [InlineData(1000, 0, 0, 0, 1000, 0, 1000)]
    [InlineData(1000, 1500, 300, 300, 700, 1200, 0)]
    public void DerivesTheOfficialReserveScenarios(
        decimal current,
        decimal pending,
        decimal reserved,
        decimal expectedReserved,
        decimal expectedUnallocated,
        decimal expectedUncovered,
        decimal expectedFree)
    {
        var metrics = FinancialDomainCalculator.CalculateReserveMetrics(current, reserved, pending);

        Assert.Equal(expectedReserved, metrics.Reserved);
        Assert.Equal(expectedUnallocated, metrics.Unallocated);
        Assert.Equal(expectedUncovered, metrics.UncoveredCommitments);
        Assert.Equal(expectedFree, metrics.Free);
        Assert.InRange(metrics.Free, 0m, metrics.Unallocated);
    }

    [Fact]
    public void ClampsDerivedMetricsAtZero()
    {
        Assert.Equal(0m, FinancialDomainCalculator.Unallocated(100m, 250m));
        Assert.Equal(0m, FinancialDomainCalculator.Free(100m, 250m));
        Assert.Equal(0m, FinancialDomainCalculator.CoverageDeficit(100m, 250m));
    }

    [Fact]
    public void SeparatesRealAndForecastResults()
    {
        Assert.Equal(300m, FinancialDomainCalculator.RealResult(500m, 200m));
        Assert.Equal(400m, FinancialDomainCalculator.ForecastResult(500m, 100m, 200m, 0m));
    }

    [Fact]
    public void ForecastClosingBalanceAddsOnlyTheSuppliedFutureFlow()
    {
        Assert.Equal(1300m, FinancialDomainCalculator.EstimatedClosingBalance(1000m, 500m, 200m));
    }

    [Fact]
    public void CalculatesPeriodMetricsWithoutMixingStates()
    {
        var metrics = FinancialDomainCalculator.CalculatePeriodMetrics(1500m, 500m, 700m, 600m);

        Assert.Equal(1500m, metrics.RealizedIncome);
        Assert.Equal(500m, metrics.PlannedIncome);
        Assert.Equal(2000m, metrics.TotalIncome);
        Assert.Equal(700m, metrics.RealizedExpense);
        Assert.Equal(600m, metrics.PlannedExpense);
        Assert.Equal(1300m, metrics.TotalExpense);
        Assert.Equal(800m, metrics.RealResult);
        Assert.Equal(700m, metrics.ForecastResult);
    }
}
