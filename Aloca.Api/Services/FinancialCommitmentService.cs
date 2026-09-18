using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialCommitmentService(AlocaDbContext dbContext, FinancialBalanceService balanceService)
{
    public async Task<IReadOnlyCollection<FinancialCommitmentResponse>> GetAllAsync(bool? isCompleted, bool? isFullyCommitted, CancellationToken ct)
    {
        var query = dbContext.FinancialCommitments.AsNoTracking().Include(x => x.Category).AsQueryable();
        if (isCompleted.HasValue) query = isCompleted.Value ? query.Where(x => x.PaidInstallments == x.TotalInstallments) : query.Where(x => x.PaidInstallments < x.TotalInstallments);
        if (isFullyCommitted.HasValue) query = query.Where(x => x.IsFullyCommitted == isFullyCommitted.Value);
        var items = await query.OrderBy(x => x.Priority).ThenBy(x => x.Name).ThenBy(x => x.Id).ToListAsync(ct);
        return items.Select(ToResponse).ToList();
    }

    public async Task<FinancialCommitmentResponse?> GetByIdAsync(Guid id, CancellationToken ct) =>
        await dbContext.FinancialCommitments.AsNoTracking().Include(x => x.Category).SingleOrDefaultAsync(x => x.Id == id, ct) is { } item ? ToResponse(item) : null;

    public async Task<FinancialCommitment> CreateAsync(FinancialCommitmentCreateRequest request, CancellationToken ct)
    {
        await ValidateCategoryAsync(request.CategoryId, ct);
        var dueDate = request.DueDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (dueDate < DateOnly.FromDateTime(DateTime.UtcNow))
            throw new InvalidOperationException("The first due date cannot be earlier than today for a new commitment.");
        var item = new FinancialCommitment(request.Name, request.InstallmentAmount, request.TotalInstallments, 0, 0m, request.Priority, request.IsFullyCommitted, dueDate);
        item.SetCategory(request.CategoryId);
        dbContext.FinancialCommitments.Add(item); await dbContext.SaveChangesAsync(ct); return item;
    }

    public async Task<FinancialCommitment?> UpdateAsync(Guid id, FinancialCommitmentUpdateRequest request, CancellationToken ct)
    {
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null;
        await ValidateCategoryAsync(request.CategoryId, ct);
        item.UpdateDetails(request.Name, request.InstallmentAmount, request.TotalInstallments, request.Priority, request.IsFullyCommitted, request.CategoryId, request.DueDate);
        await dbContext.SaveChangesAsync(ct); return item;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct) { var item = await dbContext.FinancialCommitments.FindAsync([id], ct); if (item is null) return false; dbContext.Remove(item); await dbContext.SaveChangesAsync(ct); return true; }

    public async Task<FinancialCommitment?> MutateAsync(Guid id, Action<FinancialCommitment> mutation, CancellationToken ct)
    { var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null; mutation(item); await dbContext.SaveChangesAsync(ct); return item; }

    public async Task<FinancialCommitment?> RegisterPaymentAsync(Guid id, CancellationToken ct)
    {
        await using var transaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(ct) : null;
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return null;
        if (item.AllocatedAmount < item.InstallmentAmount) throw new InvalidOperationException($"Insufficient allocation. Missing {item.InstallmentAmount - item.AllocatedAmount:C} for the next installment.");
        var amount = item.RegisterPayment();
        dbContext.CommitmentPayments.Add(new CommitmentPayment(item.Id, amount, item.PaidInstallments, DateTime.UtcNow));
        await dbContext.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return item;
    }

    public async Task<FinancialCommitment?> AllocateAsync(Guid id, decimal amount, CancellationToken ct)
    {
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return null;
        var balance = await balanceService.GetAsync(ct);
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount), "Amount must be greater than zero.");
        if (amount > balance.FreeBalance) throw new InvalidOperationException("Insufficient free balance for this allocation.");
        if (amount > item.AmountNeededForFullCoverage) throw new InvalidOperationException("Allocation cannot exceed the amount needed for full coverage.");
        item.Allocate(amount);
        await dbContext.SaveChangesAsync(ct);
        return item;
    }

    private async Task ValidateCategoryAsync(Guid? categoryId, CancellationToken ct)
    {
        if (categoryId.HasValue && !await dbContext.Categories.AnyAsync(x => x.Id == categoryId.Value, ct))
            throw new InvalidOperationException("Category was not found.");
    }

    private static FinancialCommitmentResponse ToResponse(FinancialCommitment x)
    {
        var nextDueDate = FinancialCommitmentSchedule.GetPendingInstallments(x, DateOnly.FromDateTime(DateTime.UtcNow)).FirstOrDefault()?.DueDate;
        return new(x.Id, x.Name, x.InstallmentAmount, x.TotalInstallments, x.PaidInstallments, x.RemainingInstallments, x.TotalAmount, x.RemainingAmount, x.AllocatedAmount, x.CoveredInstallments, x.AmountNeededForNextInstallment, x.AmountNeededForFullCoverage, x.ExcessAllocatedAmount, x.Priority, x.Priority.Label(), x.IsFullyCommitted, x.IsCompleted, x.CategoryId, x.Category?.Name, x.DueDate, nextDueDate);
    }
}
