using Aloca.Api.Services;

namespace Aloca.Api.Tests;

public sealed class BusinessClockTests
{
    [Fact]
    public void Converts_utc_across_business_midnight()
    {
        var clock = new FixedBusinessClock(new DateTime(2026, 1, 1, 2, 59, 0, DateTimeKind.Utc), "America/Sao_Paulo");
        Assert.Equal(new DateOnly(2025, 12, 31), clock.Today);

        clock.Set(new DateTime(2026, 1, 1, 3, 1, 0, DateTimeKind.Utc));
        Assert.Equal(new DateOnly(2026, 1, 1), clock.Today);
    }

    [Fact]
    public void Keeps_month_and_year_boundaries_in_business_timezone()
    {
        var clock = new FixedBusinessClock(new DateTime(2025, 12, 31, 15, 0, 0, DateTimeKind.Utc), "America/Sao_Paulo");
        Assert.Equal(new DateOnly(2025, 12, 31), clock.Today);
        Assert.Equal(new DateOnly(2026, 1, 1), clock.Today.AddDays(1));
        Assert.Equal(new DateOnly(2026, 1, 31), clock.Today.AddMonths(1));
    }

    private sealed class FixedBusinessClock(DateTime utc, string zoneId) : IBusinessClock
    {
        private DateTime current = utc;
        private readonly TimeZoneInfo zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        public DateTime UtcNow => current;
        public DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(current, zone);
        public DateOnly Today => DateOnly.FromDateTime(LocalNow);
        public void Set(DateTime value) => current = DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }
}
