using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class AutomaticProcessingHostedService(IServiceScopeFactory scopeFactory, ILogger<AutomaticProcessingHostedService> logger, IBusinessClock clock) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ProcessOnceAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken)) await ProcessOnceAsync(stoppingToken);
    }

    private async Task ProcessOnceAsync(CancellationToken ct)
    {
        var started = clock.UtcNow;
        logger.LogInformation("Automatic processing started");
        try
        {
            using var scope = scopeFactory.CreateScope();
            var today = clock.Today;
            var db = scope.ServiceProvider.GetRequiredService<AlocaDbContext>();
            var currentUser = scope.ServiceProvider.GetRequiredService<ICurrentUserAccessor>();
            var accountIds = await db.Accounts.AsNoTracking().Select(x => x.Id).ToListAsync(ct);
            foreach (var accountId in accountIds)
            {
                currentUser.Set(accountId);
                await scope.ServiceProvider.GetRequiredService<RecurringIncomeService>().ProcessDueAsync(today, ct);
                await scope.ServiceProvider.GetRequiredService<FinancialCommitmentService>().ProcessDueAsync(today, ct);
            }
            currentUser.Set(null);
            logger.LogInformation("Automatic processing completed account_count={AccountCount} duration_ms={DurationMs}", accountIds.Count, (clock.UtcNow - started).TotalMilliseconds);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex) { logger.LogError(ex, "Automatic processing failed duration_ms={DurationMs}", (clock.UtcNow - started).TotalMilliseconds); }
    }
}
