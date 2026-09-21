namespace Aloca.Api.Services;

public interface IBusinessClock
{
    DateTime UtcNow { get; }
    DateTime LocalNow { get; }
    DateOnly Today { get; }
}

public sealed class SystemBusinessClock(IConfiguration configuration) : IBusinessClock
{
    private readonly TimeZoneInfo zone = ResolveZone(configuration["Business:TimeZone"] ?? "America/Sao_Paulo");
    public DateTime UtcNow => DateTime.UtcNow;
    public DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(UtcNow, zone);
    public DateOnly Today => DateOnly.FromDateTime(LocalNow);

    private static TimeZoneInfo ResolveZone(string id)
    {
        if (OperatingSystem.IsWindows() && id == "America/Sao_Paulo") id = "E. South America Standard Time";
        return TimeZoneInfo.FindSystemTimeZoneById(id);
    }
}

// Compatibility for code that is intentionally outside DI (including older tests).
public static class BusinessClock
{
    public static DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
        DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows() ? "E. South America Standard Time" : "America/Sao_Paulo")));
}
