using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialSettingsService(AlocaDbContext dbContext)
{
    public async Task<FinancialSettingsResponse> GetAsync(CancellationToken ct)
    {
        var settings = await GetOrCreateAsync(ct);
        return new(settings.InitialBalance);
    }

    public async Task<FinancialSettingsResponse> UpdateAsync(decimal initialBalance, CancellationToken ct)
    {
        var settings = await GetOrCreateAsync(ct);
        settings.UpdateInitialBalance(initialBalance);
        await dbContext.SaveChangesAsync(ct);
        return new(settings.InitialBalance);
    }

    private async Task<FinancialSettings> GetOrCreateAsync(CancellationToken ct)
    {
        var settings = await dbContext.FinancialSettings.SingleOrDefaultAsync(ct);
        if (settings is not null) return settings;
        settings = new FinancialSettings(0m);
        dbContext.FinancialSettings.Add(settings);
        await dbContext.SaveChangesAsync(ct);
        return settings;
    }
}
