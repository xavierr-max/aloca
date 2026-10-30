using Aloca.Api.Services;

namespace Aloca.Api.Tests;

public sealed class FinancialDomainCalculatorTests
{
    [Fact]
    public void RealResultUsesOnlyEffectiveFlows()
        => Assert.Equal(300m, FinancialDomainCalculator.RealResult(500m, 200m));

    [Fact]
    public void ForecastClosingBalanceAddsOnlySuppliedFutureFlow()
        => Assert.Equal(1300m, FinancialDomainCalculator.EstimatedClosingBalance(1000m, 500m, 200m));

    [Fact]
    public void PeriodMetricsSeparateRealizedAndPlannedAmounts()
    {
        var metrics = FinancialDomainCalculator.CalculatePeriodMetrics(1500m, 500m, 700m, 600m);
        Assert.Equal(1500m, metrics.RealizedIncome);
        Assert.Equal(500m, metrics.PlannedIncome);
        Assert.Equal(700m, metrics.RealizedExpense);
        Assert.Equal(600m, metrics.PlannedExpense);
        Assert.Equal(800m, metrics.RealResult);
        Assert.Equal(700m, metrics.ForecastResult);
    }
}
