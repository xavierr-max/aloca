using Aloca.Api.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Aloca.Api.Health;

public sealed class PostgresHealthCheck(IServiceScopeFactory scopeFactory) : IHealthCheck
{
    public PostgresHealthCheck(IServiceScopeFactory scopeFactory, ILogger<PostgresHealthCheck> _) : this(scopeFactory) { }
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        ILogger<PostgresHealthCheck>? logger = null;
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AlocaDbContext>();
            logger = scope.ServiceProvider.GetService<ILogger<PostgresHealthCheck>>();
            return await db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : Unhealthy(logger);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return Unhealthy(logger);
        }
        catch
        {
            return Unhealthy(logger);
        }
    }

    private static HealthCheckResult Unhealthy(ILogger<PostgresHealthCheck>? logger)
    {
        logger?.LogError("Database unavailable health_check=postgres");
        return HealthCheckResult.Unhealthy();
    }
}
