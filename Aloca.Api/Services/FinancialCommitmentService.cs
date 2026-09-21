using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialCommitmentService(AlocaDbContext dbContext, FinancialBalanceService balanceService, FinancialAllocationReconciliationService? reconciliation = null)
{
    private FinancialAllocationReconciliationService Reconciliation => reconciliation ??= new(dbContext, balanceService);
    public async Task<IReadOnlyCollection<FinancialCommitmentResponse>> GetAllAsync(bool? isCompleted, bool? isFullyCommitted, CancellationToken ct)
    {
        var query = dbContext.FinancialCommitments.AsNoTracking().Include(x => x.Category).AsQueryable();
        if (isCompleted.HasValue)
            query = isCompleted.Value
                ? query.Where(x => x.TotalInstallments > 0 && x.PaidInstallments == x.TotalInstallments)
                : query.Where(x => x.TotalInstallments == 0 || x.PaidInstallments < x.TotalInstallments);
        if (isFullyCommitted.HasValue) query = query.Where(x => x.IsFullyCommitted == isFullyCommitted.Value);
        var items = await query.OrderBy(x => x.Priority == null).ThenBy(x => x.Priority).ThenBy(x => x.Name).ThenBy(x => x.Id).ToListAsync(ct);
        var available = (await balanceService.GetAsync(ct)).SaldoNaoAlocado;
        return items.Select(x => ToResponse(x, available)).ToList();
    }

    public async Task<FinancialCommitmentResponse?> GetByIdAsync(Guid id, CancellationToken ct) =>
        await dbContext.FinancialCommitments.AsNoTracking().Include(x => x.Category).SingleOrDefaultAsync(x => x.Id == id, ct) is { } item
            ? ToResponse(item, (await balanceService.GetAsync(ct)).SaldoNaoAlocado)
            : null;

    public async Task<FinancialCommitment> CreateAsync(FinancialCommitmentCreateRequest request, CancellationToken ct)
    {
        await ValidateCategoryAsync(request.CategoryId, ct);
        var dueDate = request.DueDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (dueDate < DateOnly.FromDateTime(DateTime.UtcNow))
            throw new InvalidOperationException("The first due date cannot be earlier than today for a new commitment.");
        FinancialCommitment item;
        if (request.Frequency.HasValue)
            item = new FinancialCommitment(request.Name, request.InstallmentAmount, request.Frequency.Value, dueDate, request.EndDate, request.Priority, request.IsFullyCommitted ?? true, request.Objective, request.Urgent, request.AutomaticProcessing);
        else
            item = new FinancialCommitment(request.Name, request.InstallmentAmount, request.TotalInstallments ?? throw new ArgumentException("Informe o total de parcelas ou a frequência."), 0, 0m, request.Priority, request.IsFullyCommitted ?? true, dueDate, request.Objective, request.Urgent, request.AutomaticProcessing);
        item.SetCategory(request.CategoryId);
        dbContext.FinancialCommitments.Add(item); await dbContext.SaveChangesAsync(ct); return item;
    }

    public async Task<FinancialCommitment?> UpdateAsync(Guid id, FinancialCommitmentUpdateRequest request, CancellationToken ct)
    {
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null;
        await ValidateCategoryAsync(request.CategoryId, ct);
        if (request.Frequency.HasValue)
            item.UpdateSchedule(request.Name, request.InstallmentAmount, request.Frequency.Value, request.DueDate ?? item.DueDate, request.EndDate, request.Priority, request.IsFullyCommitted ?? item.IsFullyCommitted, request.CategoryId, request.Objective, request.Urgent, request.AutomaticProcessing);
        else
            item.UpdateDetails(request.Name, request.InstallmentAmount, request.TotalInstallments ?? throw new ArgumentException("Informe o total de parcelas ou a frequência."), request.Priority, request.IsFullyCommitted ?? item.IsFullyCommitted, request.CategoryId, request.DueDate, request.Objective, request.Urgent, request.AutomaticProcessing);
        await dbContext.SaveChangesAsync(ct); await Reconciliation.ReconcileAsync(ct); return item;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct) { var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return false; dbContext.Remove(item); await dbContext.SaveChangesAsync(ct); return true; }

    public async Task<FinancialCommitment?> MutateAsync(Guid id, Action<FinancialCommitment> mutation, CancellationToken ct)
    { var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null; mutation(item); await dbContext.SaveChangesAsync(ct); return item; }

    public async Task<FinancialCommitment?> RegisterPaymentAsync(Guid id, CancellationToken ct, bool automatic = false)
    {
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return null;
        if (item.IsCompleted) throw new InvalidOperationException("Esta cobrança já foi paga.");
        var allocatedForInstallment = Math.Min(Math.Max(item.AllocatedAmount, 0m), item.InstallmentAmount);
        var missing = Math.Max(0m, item.InstallmentAmount - allocatedForInstallment);
        if (missing > 0m) throw new InvalidOperationException($"Ainda faltam {missing:C} para cobrir esta cobrança.");
        var amount = item.RegisterPayment();
        if (amount <= 0m) throw new InvalidOperationException("O valor da cobrança deve ser maior que zero.");
        item.SetAutomaticProcessingWarning(null);
        var payment = new CommitmentPayment(item.Id, amount, item.PaidInstallments, DateTime.UtcNow, automatic);
        dbContext.CommitmentPayments.Add(payment);
        dbContext.Transactions.Add(new Transaction(item.Name, amount, TransactionType.Expense, BusinessClock.Today(), item.CategoryId,
            financialCommitmentId: item.Id, wasAutomatic: automatic, commitmentPaymentId: payment.Id));
        await dbContext.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return item;
    }

    public async Task<int> ProcessDueAsync(DateOnly today, CancellationToken ct)
    {
        var items = await dbContext.FinancialCommitments.Where(x => x.AutomaticProcessing && (x.TotalInstallments == 0 || x.PaidInstallments < x.TotalInstallments)).ToListAsync(ct);
        var processed = 0;
        foreach (var item in items)
        {
            while (FinancialCommitmentSchedule.GetPendingInstallments(item, today).FirstOrDefault() is { } due && due.DueDate <= today)
            {
                if (item.AllocatedAmount < item.InstallmentAmount)
                {
                    item.SetAutomaticProcessingWarning($"Pagamento automático não realizado: faltam {(item.InstallmentAmount - item.AllocatedAmount):C}.");
                    break;
                }
                await RegisterPaymentAsync(item.Id, ct, automatic: true);
                processed++;
            }
        }
        await dbContext.SaveChangesAsync(ct);
        return processed;
    }

    public async Task<FinancialCommitment?> ReverseLatestPaymentAsync(Guid id, CancellationToken ct)
    {
        await using var transaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(ct) : null;
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return null;
        var payment = await dbContext.CommitmentPayments.Where(x => x.FinancialCommitmentId == id)
            .OrderByDescending(x => x.InstallmentNumber).ThenByDescending(x => x.PaidAt).FirstOrDefaultAsync(ct);
        if (payment is null) throw new InvalidOperationException("There are no payments to reverse.");
        item.ReverseLatestPayment(payment.Amount);
        var paymentMovement = await dbContext.Transactions.SingleOrDefaultAsync(x => x.CommitmentPaymentId == payment.Id, ct);
        if (paymentMovement is not null) dbContext.Transactions.Remove(paymentMovement);
        dbContext.CommitmentPayments.Remove(payment);
        await dbContext.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return item;
    }

    public async Task<FinancialCommitment?> AllocateAsync(Guid id, decimal amount, CancellationToken ct)
    {
        await FinancialAllocationConcurrency.Gate.WaitAsync(ct);
        try
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
            var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (item is null) return null;
            var balance = await balanceService.GetAsync(ct);
            if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount), "Amount must be greater than zero.");
            var availableToAllocate = balance.SaldoNaoAlocado;
            if (amount > availableToAllocate) throw FinancialDomainErrors.InsufficientBalance(amount, availableToAllocate);
            if (amount > item.AmountNeededForFullCoverage)
                throw FinancialDomainErrors.InvalidAllocation("A alocação não pode exceder o valor necessário para cobrir o compromisso.");
            item.Allocate(amount);
            await dbContext.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return item;
        }
        finally { FinancialAllocationConcurrency.Gate.Release(); }
    }

    public async Task<FinancialCommitment?> AllocateNextInstallmentAsync(Guid id, CancellationToken ct)
    {
        await FinancialAllocationConcurrency.Gate.WaitAsync(ct);
        try
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
            var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (item is null) return null;
            var balance = await balanceService.GetAsync(ct);
            var availableToAllocate = balance.SaldoNaoAlocado;
            var amount = Math.Min(item.AmountNeededForNextInstallment, availableToAllocate);
            if (amount <= 0m) return item;
            item.Allocate(amount);
            await dbContext.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return item;
        }
        finally { FinancialAllocationConcurrency.Gate.Release(); }
    }

    public async Task<FinancialCommitment?> AllocateAvailableAsync(Guid id, CancellationToken ct)
    {
        await FinancialAllocationConcurrency.Gate.WaitAsync(ct);
        try
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
            var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (item is null) return null;
            var availableToAllocate = (await balanceService.GetAsync(ct)).SaldoNaoAlocado;
            var amount = Math.Min(item.AmountNeededForFullCoverage, availableToAllocate);
            if (amount <= 0m) return item;
            item.Allocate(amount);
            await dbContext.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return item;
        }
        finally { FinancialAllocationConcurrency.Gate.Release(); }
    }

    public async Task<FinancialCommitment?> DeallocateAsync(Guid id, decimal amount, CancellationToken ct)
    {
        await FinancialAllocationConcurrency.Gate.WaitAsync(ct);
        try
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
            var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (item is null) return null;
            item.Deallocate(amount);
            await dbContext.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return item;
        }
        finally { FinancialAllocationConcurrency.Gate.Release(); }
    }

    public async Task<FinancialCommitment?> ReleaseAllAllocationAsync(Guid id, CancellationToken ct)
    {
        await FinancialAllocationConcurrency.Gate.WaitAsync(ct);
        try
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
            var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (item is null) return null;
            item.ReleaseAllAllocation();
            await dbContext.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return item;
        }
        finally { FinancialAllocationConcurrency.Gate.Release(); }
    }

    private async Task ValidateCategoryAsync(Guid? categoryId, CancellationToken ct)
    {
        if (categoryId.HasValue && !await dbContext.Categories.AnyAsync(x => x.Id == categoryId.Value, ct))
            throw new InvalidOperationException("Group was not found.");
    }

    private static FinancialCommitmentResponse ToResponse(FinancialCommitment x, decimal availableToAllocate)
    {
        var nextDueDate = FinancialCommitmentSchedule.GetPendingInstallments(x, DateOnly.FromDateTime(DateTime.UtcNow)).FirstOrDefault()?.DueDate;
        var allocatedForNext = Math.Min(Math.Max(x.AllocatedAmount, 0m), x.InstallmentAmount);
        var remainingForNext = Math.Max(0m, x.InstallmentAmount - allocatedForNext);
        var coverage = x.InstallmentAmount <= 0m ? 0m : Math.Min(100m, allocatedForNext / x.InstallmentAmount * 100m);
        var canPay = !x.IsCompleted && x.InstallmentAmount > 0m && remainingForNext == 0m;
        var canAllocate = !x.IsCompleted && x.AmountNeededForFullCoverage > 0m && availableToAllocate > 0m;
        return new(x.Id, x.Name, x.InstallmentAmount, x.TotalInstallments, x.PaidInstallments, x.RemainingInstallments, x.TotalAmount, x.RemainingAmount, x.AllocatedAmount, x.CoveredInstallments, x.AmountNeededForNextInstallment, x.AmountNeededForFullCoverage, x.ExcessAllocatedAmount, x.Priority, x.Priority.Label(), x.IsFullyCommitted, x.IsCompleted, x.CategoryId, x.Category?.Name, x.DueDate, nextDueDate, x.Objective, x.Urgent, x.TotalAllocatedAmount, x.OverallRemainingAmount, x.OverallCoveragePercentage, x.RequiresAttention, x.AutomaticProcessing, x.AutomaticProcessingWarning, x.Frequency, x.EndDate, x.IsRecurring, x.IsOpenEnded, allocatedForNext, remainingForNext, coverage, canPay, availableToAllocate, canAllocate);
    }
}
