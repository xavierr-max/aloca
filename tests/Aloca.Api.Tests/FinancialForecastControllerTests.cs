using Aloca.Api.Controllers;
using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Aloca.Api.Tests;

public sealed class FinancialForecastControllerTests
{
    [Theory]
    [InlineData(3)]
    [InlineData(6)]
    [InlineData(12)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(24)]
    [InlineData(36)]
    public async Task AcceptsSupportedPeriods(int months)
    {
        var service = new SpyForecastService();
        var controller = new FinancialForecastController(service, new TestClock());

        var result = await controller.Get(new DateOnly(2026, 10, 1), months, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(new DateOnly(2026, 10, 1), service.From);
        Assert.Equal(months, service.Months);
    }

    [Fact]
    public async Task RejectsUnsupportedPeriod()
    {
        var service = new SpyForecastService();
        var controller = new FinancialForecastController(service, new TestClock());

        var result = await controller.Get(new DateOnly(2026, 10, 1), 37, CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(400, badRequest.StatusCode);
        Assert.Null(service.Months);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(37)]
    public async Task RejectsPeriodsOutsideOneToThirtySixMonths(int months)
    {
        var service = new SpyForecastService();
        var controller = new FinancialForecastController(service, new TestClock());

        var result = await controller.Get(new DateOnly(2026, 10, 1), months, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Null(service.Months);
    }

    [Fact]
    public async Task ReturnsSingleCoherentPayloadWithoutControllerRecalculation()
    {
        var payload = new FinancialForecastResponse(
            new(2026, 10, 1), new(2026, 12, 31),
            new(100m, 250m, 200m, 50m, 150m, 250m, 100m, 20m, 70m, 40m, 40m, 100m, 66.6666666666666666666666666666667m, Array.Empty<ForecastCommitmentResponse>()),
            new[] { new ForecastMonthResponse(2026, 10, new(2026, 10, 1), new(2026, 10, 31), 100m, 200m, 0m, 200m, 50m, 0m, 50m, 150m, 250m, Array.Empty<ForecastItemResponse>(), Array.Empty<ForecastItemResponse>()) });
        var service = new SpyForecastService { Payload = payload };
        var controller = new FinancialForecastController(service, new TestClock());

        var result = await controller.Get(new DateOnly(2026, 10, 1), 3, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var returned = Assert.IsType<FinancialForecastResponse>(ok.Value);
        Assert.Same(payload, returned);
        var month = Assert.Single(returned.Months);
        Assert.Equal(month.RealizedIncome + month.PlannedIncome, month.TotalIncome);
        Assert.Equal(month.RealizedExpense + month.PlannedExpense, month.TotalExpense);
        Assert.Equal(month.TotalIncome - month.TotalExpense, month.MonthlyResult);
    }

    private sealed class SpyForecastService : IFinancialForecastService
    {
        public DateOnly? From { get; private set; }
        public int? Months { get; private set; }
        public FinancialForecastResponse Payload { get; init; } = new(new(2026, 10, 1), new(2026, 12, 31), new(0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 100m, Array.Empty<ForecastCommitmentResponse>()), Array.Empty<ForecastMonthResponse>());

        public Task<FinancialForecastResponse> GetAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken) => Task.FromResult(Payload);

        public Task<FinancialForecastResponse> GetAsync(DateOnly from, int months, CancellationToken cancellationToken)
        {
            From = from;
            Months = months;
            return Task.FromResult(Payload);
        }
    }

    private sealed class TestClock : IBusinessClock
    {
        public DateTime UtcNow => new(2026, 9, 21, 12, 0, 0, DateTimeKind.Utc);
        public DateTime LocalNow => UtcNow;
        public DateOnly Today => new(2026, 9, 21);
    }
}
