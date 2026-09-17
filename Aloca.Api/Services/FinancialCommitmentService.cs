using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialCommitmentService(AlocaDbContext dbContext, FinancialBalanceService balanceService)
{
    public async Task<IReadOnlyCollection<FinancialCommitmentResponse>> GetAllAsync(bool? isCompleted, bool? isFullyCommitted, CancellationToken ct)
    {
        var query = dbContext.FinancialCommitments.AsNoTracking().AsQueryable();
        if (isCompleted.HasValue) query = isCompleted.Value ? query.Where(x => x.PaidInstallments == x.TotalInstallments) : query.Where(x => x.PaidInstallments < x.TotalInstallments);
        if (isFullyCommitted.HasValue) query = query.Where(x => x.IsFullyCommitted == isFullyCommitted.Value);
        var items = await query.OrderBy(x => x.Priority).ThenBy(x => x.Name).ThenBy(x => x.Id).ToListAsync(ct);
        return items.Select(ToResponse).ToList();
    }

    public async Task<FinancialCommitmentResponse?> GetByIdAsync(Guid id, CancellationToken ct) =>
        await dbContext.FinancialCommitments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct) is { } item ? ToResponse(item) : null;

    public async Task<FinancialCommitment> CreateAsync(FinancialCommitmentCreateRequest request, CancellationToken ct)
    {
        var item = new FinancialCommitment(request.Name, request.InstallmentAmount, request.TotalInstallments, 0, 0m, request.Priority, request.IsFullyCommitted);
        dbContext.FinancialCommitments.Add(item); await dbContext.SaveChangesAsync(ct); return item;
    }

    public async Task<FinancialCommitment?> UpdateAsync(Guid id, FinancialCommitmentUpdateRequest request, CancellationToken ct)
    {
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null;
        item.UpdateDetails(request.Name, request.InstallmentAmount, request.TotalInstallments, request.Priority, request.IsFullyCommitted);
        await dbContext.SaveChangesAsync(ct); return item;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct) { var item = await dbContext.FinancialCommitments.FindAsync([id], ct); if (item is null) return false; dbContext.Remove(item); await dbContext.SaveChangesAsync(ct); return true; }

    public async Task<FinancialCommitment?> MutateAsync(Guid id, Action<FinancialCommitment> mutation, CancellationToken ct)
    { var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null; mutation(item); await dbContext.SaveChangesAsync(ct); return item; }

    public async Task<FinancialCommitment?> AllocateAsync(Guid id, decimal amount, CancellationToken ct)
    {
        var balance = await balanceService.GetAsync(ct);
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount), "Amount must be greater than zero.");
        if (amount > balance.FreeBalance) throw new InvalidOperationException("Insufficient free balance for this allocation.");
        return await MutateAsync(id, x => x.Allocate(amount), ct);
    }

    private static FinancialCommitmentResponse ToResponse(FinancialCommitment x) => new(x.Id, x.Name, x.InstallmentAmount, x.TotalInstallments, x.PaidInstallments, x.RemainingInstallments, x.TotalAmount, x.RemainingAmount, x.AllocatedAmount, x.CoveredInstallments, x.AmountNeededForNextInstallment, x.AmountNeededForFullCoverage, x.ExcessAllocatedAmount, x.Priority, x.IsFullyCommitted, x.IsCompleted);
}
