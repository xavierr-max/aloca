using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialSettingsService(AlocaDbContext dbContext, FinancialAllocationReconciliationService? reconciliation = null)
{
    private FinancialAllocationReconciliationService Reconciliation => reconciliation ??= new(dbContext, new FinancialBalanceService(dbContext));
    public async Task<FinancialSettingsResponse> GetAsync(CancellationToken ct)
    {
        var settings = await GetOrCreateAsync(ct);
        return new(settings.InitialBalance);
    }

    public async Task<FinancialSettingsResponse> UpdateAsync(decimal initialBalance, CancellationToken ct)
    {
        await using var dbTransaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
        var settings = await GetOrCreateAsync(ct);
        settings.UpdateInitialBalance(initialBalance);
        await dbContext.SaveChangesAsync(ct);
        await Reconciliation.ReconcileAsync(ct);
        if (dbTransaction is not null) await dbTransaction.CommitAsync(ct);
        return new(settings.InitialBalance);
    }

    public async Task<FinancialBalanceSnapshot> AdjustCurrentBalanceAsync(decimal newBalance, IBusinessClock clock, CancellationToken ct)
    {
        if (newBalance < 0m) throw new ArgumentOutOfRangeException(nameof(newBalance));
        await using var dbTransaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
        var balance = await new FinancialBalanceService(dbContext, clock).GetAsync(ct);
        var difference = decimal.Round(newBalance - balance.SaldoReal, 2, MidpointRounding.ToEven);
        if (difference != 0m)
        {
            dbContext.Transactions.Add(new Transaction(
                "Ajuste manual de saldo", Math.Abs(difference),
                difference > 0m ? TransactionType.Income : TransactionType.Expense,
                clock.Today, null, isBalanceAdjustment: true));
            await dbContext.SaveChangesAsync(ct);
            await Reconciliation.ReconcileAsync(ct);
        }
        if (dbTransaction is not null) await dbTransaction.CommitAsync(ct);
        return await new FinancialBalanceService(dbContext, clock).GetAsync(ct);
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
