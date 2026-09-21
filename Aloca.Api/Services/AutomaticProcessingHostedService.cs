using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class AutomaticProcessingHostedService(IServiceScopeFactory scopeFactory, ILogger<AutomaticProcessingHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ProcessOnceAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken)) await ProcessOnceAsync(stoppingToken);
    }

    private async Task ProcessOnceAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var today = BusinessClock.Today();
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
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex) { logger.LogError(ex, "Automatic financial processing failed."); }
    }
}

public static class BusinessClock
{
    public static DateOnly Today()
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows() ? "E. South America Standard Time" : "America/Sao_Paulo");
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone));
    }
}
