using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed record AllocationReconciliationResult(decimal ExcessRemoved, IReadOnlyCollection<AllocationReconciliationItem> Items);

public sealed record AllocationReconciliationItem(Guid CommitmentId, string CommitmentName, decimal Amount);

/// <summary>
/// Keeps persisted reservations covered by the real balance. Reservations are
/// commitments of money, not a second expense, so reconciliation only changes
/// AllocatedAmount and never creates a transaction.
/// </summary>
public sealed class FinancialAllocationReconciliationService(AlocaDbContext dbContext, FinancialBalanceService balanceService)
{
    public async Task<AllocationReconciliationResult> ReconcileAsync(CancellationToken ct)
    {
        var balance = await balanceService.GetAsync(ct);
        // A negative account balance has no reservable cash. Treat its
        // coverage ceiling as zero while preserving the real balance itself.
        var excess = balance.TotalReservado - Math.Max(0m, balance.SaldoReal);
        if (excess <= 0m) return new(0m, Array.Empty<AllocationReconciliationItem>());

        // Preserve urgent commitments first. Among the remaining commitments,
        // remove from lower priority and later due dates first. This is stable
        // and makes the result reproducible across requests and restarts.
        var commitments = await dbContext.FinancialCommitments
            .Where(x => x.AllocatedAmount > 0m && (x.TotalInstallments == 0 || x.PaidInstallments < x.TotalInstallments))
            .OrderBy(x => x.Urgent)
            .ThenByDescending(x => x.Priority ?? int.MinValue)
            .ThenByDescending(x => x.DueDate)
            .ThenByDescending(x => x.Id)
            .ToListAsync(ct);

        var remaining = excess;
        var removed = new List<AllocationReconciliationItem>();
        foreach (var commitment in commitments)
        {
            if (remaining <= 0m) break;
            var amount = Math.Min(commitment.AllocatedAmount, remaining);
            commitment.Deallocate(amount);
            removed.Add(new(commitment.Id, commitment.Name, amount));
            remaining -= amount;
        }

        if (remaining > 0m)
            throw new InvalidOperationException("Não foi possível reconciliar todas as reservas com o saldo real.");

        await dbContext.SaveChangesAsync(ct);
        var finalBalance = await balanceService.GetAsync(ct);
        if (finalBalance.TotalReservado > Math.Max(0m, finalBalance.SaldoReal))
            throw new InvalidOperationException("A operação deixaria reservas maiores que o saldo real.");

        return new(excess, removed);
    }
}
