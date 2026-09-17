using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialAllocationService(AlocaDbContext dbContext, FinancialBalanceService balanceService)
{
    private static readonly SemaphoreSlim DistributionGate = new(1, 1);

    public async Task<AllocationPreviewResponse> PreviewAsync(CancellationToken ct)
    {
        var plan = await BuildPlanAsync(ct);
        return new(plan.AvailableBalance, plan.Total, plan.AvailableBalance - plan.Total, plan.Changes);
    }

    public async Task<AllocationDistributionResponse> DistributeAsync(CancellationToken ct)
    {
        await DistributionGate.WaitAsync(ct);
        try
        {
            await using var transaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(ct) : null;
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
            return new(before.Balance, before.AllocatedAmount, plan.Total, after.AllocatedAmount, after.FreeBalance, plan.Changes);
        }
        finally { DistributionGate.Release(); }
    }

    private async Task<AllocationPlan> BuildPlanAsync(CancellationToken ct)
    {
        var balance = await balanceService.GetAsync(ct);
        var available = balance.FreeBalance;
        var commitments = await dbContext.FinancialCommitments
            .Where(x => x.IsFullyCommitted && x.PaidInstallments < x.TotalInstallments)
            .OrderBy(x => x.Priority).ThenBy(x => x.Name).ThenBy(x => x.Id)
            .ToListAsync(ct);
        var changes = new List<AllocationChangeResponse>();
        foreach (var commitment in commitments)
        {
            if (available <= 0) break;
            var needed = Math.Max(0m, commitment.RemainingAmount - commitment.AllocatedAmount);
            var amount = Math.Min(available, needed);
            if (amount <= 0) continue;
            changes.Add(new(commitment.Id, commitment.Name, amount));
            available -= amount;
        }
        return new(balance.FreeBalance, changes.Sum(x => x.Amount), changes);
    }

    private sealed record AllocationPlan(decimal AvailableBalance, decimal Total, IReadOnlyCollection<AllocationChangeResponse> Changes);
}
