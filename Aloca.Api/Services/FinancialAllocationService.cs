using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialAllocationService(AlocaDbContext dbContext, FinancialBalanceService balanceService)
{
    public async Task<AllocationPreviewResponse> PreviewAsync(CancellationToken ct)
    {
        var plan = await BuildPlanAsync(ct);
        return new(plan.UnallocatedBalance, plan.Total,
            Math.Max(0m, plan.UnallocatedBalance - plan.Total), plan.Changes);
    }

    public async Task<AllocationDistributionResponse> DistributeAsync(CancellationToken ct)
    {
        await FinancialAllocationConcurrency.Gate.WaitAsync(ct);
        try
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
            var before = await balanceService.GetAsync(ct);
            var plan = await BuildPlanAsync(ct);
            foreach (var change in plan.Changes)
            {
                var commitment = await dbContext.FinancialCommitments.SingleAsync(x => x.Id == change.FinancialCommitmentId, ct);
                commitment.Allocate(change.Amount);
            }
            await dbContext.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            var after = await balanceService.GetAsync(ct);
            return new(before.SaldoReal, before.TotalReservado, plan.Total, after.TotalReservado, after.SaldoNaoAlocado, after.DeficitCobertura, plan.Changes);
        }
        finally { FinancialAllocationConcurrency.Gate.Release(); }
    }

    private async Task<AllocationPlan> BuildPlanAsync(CancellationToken ct)
    {
        var balance = await balanceService.GetAsync(ct);
        var available = balance.UnallocatedBalance;
        var commitments = await dbContext.FinancialCommitments
            .Where(x => x.IsFullyCommitted && (x.TotalInstallments == 0 || x.PaidInstallments < x.TotalInstallments))
            .OrderBy(x => x.Priority == null).ThenBy(x => x.Priority).ThenBy(x => x.Name).ThenBy(x => x.Id)
            .ToListAsync(ct);
        var changes = new List<AllocationChangeResponse>();
        foreach (var commitment in commitments)
        {
            if (available <= 0) break;
            var needed = commitment.AmountNeededForFullCoverage;
            var amount = Math.Min(available, needed);
            if (amount <= 0) continue;
            changes.Add(new(commitment.Id, commitment.Name, amount));
            available -= amount;
        }
        return new(balance.UnallocatedBalance, changes.Sum(x => x.Amount), changes);
    }

    private sealed record AllocationPlan(decimal UnallocatedBalance, decimal Total, IReadOnlyCollection<AllocationChangeResponse> Changes);
}
