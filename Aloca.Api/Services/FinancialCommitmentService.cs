using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

namespace Aloca.Api.Services;

public sealed class FinancialCommitmentService(AlocaDbContext dbContext, FinancialBalanceService balanceService, FinancialAllocationReconciliationService? reconciliation = null, IBusinessClock? clock = null, ILogger<FinancialCommitmentService>? logger = null)
{
    private IBusinessClock Clock => clock ?? new SystemBusinessClock(new ConfigurationBuilder().Build());
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> paymentLocks = new();
    private FinancialAllocationReconciliationService Reconciliation => reconciliation ??= new(dbContext, balanceService);
    public async Task<IReadOnlyCollection<FinancialCommitmentResponse>> GetAllAsync(bool? isCompleted, bool? isFullyCommitted, CancellationToken ct)
    {
        await EnsureOccurrencesAsync(Clock.Today.AddMonths(24), ct);
        var query = dbContext.FinancialCommitments.AsNoTracking().Include(x => x.Category).Include(x => x.Occurrences).AsQueryable();
        if (isCompleted.HasValue)
            query = isCompleted.Value
                ? query.Where(x => x.TotalInstallments > 0 && x.PaidInstallments == x.TotalInstallments)
                : query.Where(x => x.TotalInstallments == 0 || x.PaidInstallments < x.TotalInstallments);
        if (isFullyCommitted.HasValue) query = query.Where(x => x.IsFullyCommitted == isFullyCommitted.Value);
        var items = await query.OrderBy(x => x.Priority == null).ThenBy(x => x.Priority).ThenBy(x => x.Name).ThenBy(x => x.Id).ToListAsync(ct);
        var available = (await balanceService.GetAsync(ct)).SaldoNaoAlocado;
        return items.Select(x => ToResponse(x, available)).ToList();
    }

    public async Task<FinancialCommitmentResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        await EnsureOccurrencesAsync(Clock.Today.AddMonths(24), ct);
        return await dbContext.FinancialCommitments.AsNoTracking().Include(x => x.Category).Include(x => x.Occurrences).SingleOrDefaultAsync(x => x.Id == id, ct) is { } item
            ? ToResponse(item, (await balanceService.GetAsync(ct)).SaldoNaoAlocado)
            : null;
    }

    public async Task<FinancialCommitment> CreateAsync(FinancialCommitmentCreateRequest request, CancellationToken ct)
    {
        await ValidateCategoryAsync(request.CategoryId, ct);
        var dueDate = request.DueDate ?? Clock.Today;
        FinancialCommitment item;
        if (request.Frequency.HasValue)
            item = new FinancialCommitment(request.Name, request.InstallmentAmount, request.Frequency.Value, dueDate, request.EndDate, request.Priority, request.IsFullyCommitted ?? true, request.Objective, request.Urgent, request.AutomaticProcessing);
        else
            item = new FinancialCommitment(request.Name, request.InstallmentAmount, request.TotalInstallments ?? throw new ArgumentException("Informe o total de parcelas ou a frequência."), 0, 0m, request.Priority, request.IsFullyCommitted ?? true, dueDate, request.Objective, request.Urgent, request.AutomaticProcessing);
        item.SetCategory(request.CategoryId);
        dbContext.FinancialCommitments.Add(item); await dbContext.SaveChangesAsync(ct); await EnsureOccurrencesAsync(Clock.Today.AddMonths(24), ct); logger?.LogInformation("Commitment created commitment_id={CommitmentId}", item.Id); return item;
    }

    public async Task<FinancialCommitment?> UpdateAsync(Guid id, FinancialCommitmentUpdateRequest request, CancellationToken ct)
    {
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null;
        await ValidateCategoryAsync(request.CategoryId, ct);
        if (request.Frequency.HasValue)
            item.UpdateSchedule(request.Name, request.InstallmentAmount, request.Frequency.Value, request.DueDate ?? item.DueDate, request.EndDate, request.Priority, request.IsFullyCommitted ?? item.IsFullyCommitted, request.CategoryId, request.Objective, request.Urgent, request.AutomaticProcessing);
        else
            item.UpdateDetails(request.Name, request.InstallmentAmount, request.TotalInstallments ?? throw new ArgumentException("Informe o total de parcelas ou a frequência."), request.Priority, request.IsFullyCommitted ?? item.IsFullyCommitted, request.CategoryId, request.DueDate, request.Objective, request.Urgent, request.AutomaticProcessing);
        await dbContext.SaveChangesAsync(ct); await EnsureOccurrencesAsync(Clock.Today.AddMonths(24), ct); await Reconciliation.ReconcileAsync(ct); logger?.LogInformation("Commitment changed commitment_id={CommitmentId}", item.Id); return item;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct) { var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return false; dbContext.Remove(item); await dbContext.SaveChangesAsync(ct); logger?.LogInformation("Commitment deleted commitment_id={CommitmentId}", id); return true; }

    public async Task<FinancialCommitment?> MutateAsync(Guid id, Action<FinancialCommitment> mutation, CancellationToken ct)
    { var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null; mutation(item); await dbContext.SaveChangesAsync(ct); return item; }

    public async Task<FinancialCommitment?> RegisterPaymentAsync(Guid id, CancellationToken ct, bool automatic = false, Guid? occurrenceId = null)
    {
        var gate = paymentLocks.GetOrAdd(id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return null;
        await EnsureOccurrencesAsync(Clock.Today.AddMonths(24), ct);
        var occurrence = occurrenceId.HasValue
            ? await dbContext.FinancialCommitmentOccurrences.SingleOrDefaultAsync(x => x.Id == occurrenceId.Value && x.FinancialCommitmentId == id, ct)
            : await dbContext.FinancialCommitmentOccurrences.Where(x => x.FinancialCommitmentId == id && x.Status != FinancialCommitmentOccurrenceStatus.Paid && x.Status != FinancialCommitmentOccurrenceStatus.Cancelled).OrderBy(x => x.InstallmentNumber).FirstOrDefaultAsync(ct);
        if (occurrence is null && !occurrenceId.HasValue)
        {
            var first = FinancialCommitmentSchedule.GetPendingInstallments(item, Clock.Today).FirstOrDefault();
            if (first is not null)
            {
                occurrence = new FinancialCommitmentOccurrence(item, first.DueDate, first.Number);
                dbContext.FinancialCommitmentOccurrences.Add(occurrence);
            }
        }
        if (occurrence?.Status == FinancialCommitmentOccurrenceStatus.Paid) return item;
        if (item.IsCompleted) return item;
        var allocatedForInstallment = Math.Min(Math.Max(item.AllocatedAmount, 0m), item.InstallmentAmount);
        var missing = Math.Max(0m, item.InstallmentAmount - allocatedForInstallment);
        if (missing > 0m) throw new InvalidOperationException($"Ainda faltam {missing:C} para cobrir esta cobrança.");
        var amount = item.RegisterPayment();
        if (amount <= 0m) throw new InvalidOperationException("O valor da cobrança deve ser maior que zero.");
        item.SetAutomaticProcessingWarning(null);
        var payment = new CommitmentPayment(item.Id, amount, occurrence?.InstallmentNumber ?? item.PaidInstallments, Clock.UtcNow, automatic, occurrence?.Id);
        dbContext.CommitmentPayments.Add(payment);
        dbContext.Transactions.Add(new Transaction(item.Name, amount, TransactionType.Expense, Clock.Today, item.CategoryId,
            financialCommitmentId: item.Id, wasAutomatic: automatic, commitmentPaymentId: payment.Id));
        occurrence?.MarkPaid(payment.Id);
        try
        {
            await dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            if (transaction is not null) await transaction.RollbackAsync(ct);
            dbContext.ChangeTracker.Clear();
            var committed = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (committed is not null && committed.PaidInstallments > item.PaidInstallments)
                return committed;
            throw;
        }
        if (transaction is not null) await transaction.CommitAsync(ct);
        logger?.LogInformation("Payment registered commitment_id={CommitmentId} payment_id={PaymentId} automatic={Automatic}", item.Id, payment.Id, automatic);
        return item;
        }
        finally { gate.Release(); }
    }

    public async Task<int> ProcessDueAsync(DateOnly today, CancellationToken ct)
    {
        await EnsureOccurrencesAsync(today.AddMonths(24), ct);
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
                await RegisterPaymentAsync(item.Id, ct, automatic: true, occurrenceId: await GetOccurrenceIdAsync(item.Id, due.Number, ct));
                processed++;
            }
        }
        await dbContext.SaveChangesAsync(ct);
        return processed;
    }

    public async Task<FinancialCommitment?> ReverseLatestPaymentAsync(Guid id, CancellationToken ct, Guid? occurrenceId = null)
    {
        var gate = paymentLocks.GetOrAdd(id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
        await using var transaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(ct) : null;
        var item = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return null;
        var payment = await dbContext.CommitmentPayments.Where(x => x.FinancialCommitmentId == id && (!occurrenceId.HasValue || x.FinancialCommitmentOccurrenceId == occurrenceId))
            .OrderByDescending(x => x.InstallmentNumber).ThenByDescending(x => x.PaidAt).FirstOrDefaultAsync(ct);
        if (payment is null) throw new InvalidOperationException("There are no payments to reverse.");
        item.ReverseLatestPayment(payment.Amount);
        var paidOccurrence = await dbContext.FinancialCommitmentOccurrences.SingleOrDefaultAsync(x => x.Id == payment.FinancialCommitmentOccurrenceId, ct);
        paidOccurrence?.RestoreAfterPayment();
        var paymentMovement = await dbContext.Transactions.SingleOrDefaultAsync(x => x.CommitmentPaymentId == payment.Id, ct);
        if (paymentMovement is not null) dbContext.Transactions.Remove(paymentMovement);
        dbContext.CommitmentPayments.Remove(payment);
        try
        {
            await dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            if (transaction is not null) await transaction.RollbackAsync(ct);
            dbContext.ChangeTracker.Clear();
            var committed = await dbContext.FinancialCommitments.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (committed is not null && !await dbContext.CommitmentPayments.AnyAsync(x => x.FinancialCommitmentId == id, ct))
                return committed;
            throw;
        }
        if (transaction is not null) await transaction.CommitAsync(ct);
        logger?.LogInformation("Payment reversed commitment_id={CommitmentId} payment_id={PaymentId}", item.Id, payment.Id);
        return item;
        }
        finally { gate.Release(); }
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

    private FinancialCommitmentResponse ToResponse(FinancialCommitment x, decimal availableToAllocate)
    {
        var nextDueDate = FinancialCommitmentSchedule.GetPendingInstallments(x, Clock.Today).FirstOrDefault()?.DueDate;
        var allocatedForNext = Math.Min(Math.Max(x.AllocatedAmount, 0m), x.InstallmentAmount);
        var remainingForNext = Math.Max(0m, x.InstallmentAmount - allocatedForNext);
        var coverage = x.InstallmentAmount <= 0m ? 0m : Math.Min(100m, allocatedForNext / x.InstallmentAmount * 100m);
        var canPay = !x.IsCompleted && x.InstallmentAmount > 0m && remainingForNext == 0m;
        var canAllocate = !x.IsCompleted && x.AmountNeededForFullCoverage > 0m && availableToAllocate > 0m;
        var occurrences = x.Occurrences.OrderBy(o => o.ScheduledDate).Select(o => new FinancialCommitmentOccurrenceResponse(o.Id, o.ScheduledDate, o.InstallmentNumber, o.Amount, o.Status, o.CommitmentPaymentId, o.ProcessedAt)).ToList();
        return new(x.Id, x.Name, x.InstallmentAmount, x.TotalInstallments, x.PaidInstallments, x.RemainingInstallments, x.TotalAmount, x.RemainingAmount, x.AllocatedAmount, x.CoveredInstallments, x.AmountNeededForNextInstallment, x.AmountNeededForFullCoverage, x.ExcessAllocatedAmount, x.Priority, x.Priority.Label(), x.IsFullyCommitted, x.IsCompleted, x.CategoryId, x.Category?.Name, x.DueDate, nextDueDate, x.Objective, x.Urgent, x.TotalAllocatedAmount, x.OverallRemainingAmount, x.OverallCoveragePercentage, x.RequiresAttention, x.AutomaticProcessing, x.AutomaticProcessingWarning, x.Frequency, x.EndDate, x.IsRecurring, x.IsOpenEnded, allocatedForNext, remainingForNext, coverage, canPay, availableToAllocate, canAllocate, occurrences);
    }

    private async Task<Guid?> GetOccurrenceIdAsync(Guid commitmentId, int installmentNumber, CancellationToken ct) =>
        (await dbContext.FinancialCommitmentOccurrences.SingleOrDefaultAsync(x => x.FinancialCommitmentId == commitmentId && x.InstallmentNumber == installmentNumber, ct))?.Id;

    public async Task EnsureOccurrencesAsync(DateOnly horizon, CancellationToken ct)
    {
        var today = Clock.Today;
        var items = await dbContext.FinancialCommitments.Include(x => x.Occurrences).ToListAsync(ct);
        foreach (var item in items)
        {
            var schedule = FinancialCommitmentSchedule.GetInstallments(item, today, horizon);
            foreach (var installment in schedule)
            {
                var existing = item.Occurrences.FirstOrDefault(x => x.ScheduledDate == installment.DueDate);
                if (existing is null)
                    dbContext.FinancialCommitmentOccurrences.Add(new FinancialCommitmentOccurrence(item, installment.DueDate, installment.Number));
                else if (installment.Number > item.PaidInstallments)
                    existing.UpdateForecastAmount(item.InstallmentAmount);
            }
            foreach (var occurrence in item.Occurrences.Where(x => x.ScheduledDate >= today && x.Status is FinancialCommitmentOccurrenceStatus.Planned or FinancialCommitmentOccurrenceStatus.Pending))
                if (!schedule.Any(x => x.DueDate == occurrence.ScheduledDate)) occurrence.Cancel();
        }
        await dbContext.SaveChangesAsync(ct);
    }
}
