using Aloca.Api.Data;
using Aloca.Api.Health;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Aloca.Api.Tests;

public sealed class PostgresHealthCheckTests
{
    [Fact]
    public async Task ReportsHealthyWhenDatabaseCanConnect()
    {
        using var provider = new ServiceCollection()
            .AddDbContext<AlocaDbContext>(options => options.UseInMemoryDatabase("health-available"))
            .BuildServiceProvider();

        var result = await new PostgresHealthCheck(provider.GetRequiredService<IServiceScopeFactory>())
            .CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task ReportsUnhealthyWhenPostgresIsUnavailable()
    {
        using var provider = new ServiceCollection()
            .AddDbContext<AlocaDbContext>(options => options.UseNpgsql(
                "Host=127.0.0.1;Port=1;Database=unavailable;Username=unavailable;Password=unavailable;Timeout=1;"))
            .BuildServiceProvider();

        var result = await new PostgresHealthCheck(provider.GetRequiredService<IServiceScopeFactory>())
            .CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Null(result.Exception);
        Assert.True(string.IsNullOrEmpty(result.Description));
    }
}
