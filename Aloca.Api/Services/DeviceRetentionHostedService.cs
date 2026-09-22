using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class DeviceRetentionHostedService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<DeviceRetentionHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await CleanupAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        while (await timer.WaitForNextTickAsync(stoppingToken)) await CleanupAsync(stoppingToken);
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        try
        {
            var retentionDays = configuration.GetValue("Privacy:UnlinkedDeviceRetentionDays", 90);
            if (retentionDays < 1) throw new InvalidOperationException("Privacy:UnlinkedDeviceRetentionDays must be at least 1.");
            var cutoff = DateTime.UtcNow.AddDays(-retentionDays);
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AlocaDbContext>();
            var devices = await db.Devices
                .Where(x => x.LastSeenAt < cutoff && !db.DeviceAccounts.Any(link => link.DeviceId == x.Id))
                .ToListAsync(ct);
            if (devices.Count == 0) return;
            db.Devices.RemoveRange(devices);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Removed {DeviceCount} unlinked device records older than {RetentionDays} days.", devices.Count, retentionDays);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex) { logger.LogError(ex, "Device retention cleanup failed."); }
    }
}
