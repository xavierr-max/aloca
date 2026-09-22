using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

namespace Aloca.Api.Services;

public sealed class RecurringIncomeService(AlocaDbContext db, FinancialAllocationReconciliationService? reconciliation = null, IBusinessClock? clock = null)
{
    private const int MaxHistoryOccurrences = 120;
    private IBusinessClock Clock => clock ?? new SystemBusinessClock(new ConfigurationBuilder().Build());
    private FinancialAllocationReconciliationService Reconciliation => reconciliation ??= new(db, new FinancialBalanceService(db, Clock));
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> occurrenceLocks = new();
    public async Task<IReadOnlyCollection<RecurringIncomeResponse>> GetAllAsync(CancellationToken ct)
    {
        await EnsureOccurrencesAsync(Clock.Today.AddMonths(24), ct);
        var rows = await db.RecurringIncomes.AsNoTracking().Include(x => x.Category)
            .Include(x => x.Occurrences.OrderByDescending(o => o.ScheduledDate).ThenByDescending(o => o.Id).Take(MaxHistoryOccurrences))
            .OrderBy(x => x.Description).ThenBy(x => x.Id).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<RecurringIncomeResponse?> GetAsync(Guid id, CancellationToken ct)
    { await EnsureOccurrencesAsync(Clock.Today.AddMonths(24), ct); var x = await db.RecurringIncomes.Include(x => x.Category).Include(x => x.Occurrences.OrderByDescending(o => o.ScheduledDate).ThenByDescending(o => o.Id).Take(MaxHistoryOccurrences)).SingleOrDefaultAsync(x => x.Id == id, ct); return x is null ? null : Map(x); }

    public async Task<RecurringIncomeResponse?> CreateAsync(RecurringIncomeRequest request, CancellationToken ct)
    {
        if (request.CategoryId.HasValue && !await db.Categories.AnyAsync(x => x.Id == request.CategoryId.Value, ct)) return null;
        var item = new RecurringIncome(request.Description, request.Amount, request.CategoryId, request.Frequency, request.StartDate, request.EndDate, request.DayOfMonth, request.AutomaticProcessing); db.RecurringIncomes.Add(item); await db.SaveChangesAsync(ct); await EnsureOccurrencesAsync(Clock.Today.AddMonths(24), ct); return await GetAsync(item.Id, ct);
    }

    public async Task<RecurringIncomeResponse?> UpdateAsync(Guid id, RecurringIncomeRequest request, CancellationToken ct)
    {
        if (request.CategoryId.HasValue && !await db.Categories.AnyAsync(x => x.Id == request.CategoryId.Value, ct)) return null;
        var item = await db.RecurringIncomes.Include(x => x.Occurrences).SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null;
        var today = Clock.Today;
        RepairLegacyCancelledBatch(item, GenerateDates(item, today.AddMonths(24)), today);
        item.Update(request.Description, request.Amount, request.CategoryId, request.Frequency, request.StartDate, request.EndDate, request.DayOfMonth, request.AutomaticProcessing);
        await ReconcileFutureOccurrencesAsync(item, today.AddMonths(24), ct);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<bool> SetActiveAsync(Guid id, bool active, CancellationToken ct)
    {
        var item = await db.RecurringIncomes.Include(x => x.Occurrences).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return false;

        var today = Clock.Today;
        item.SetActive(active);
        if (active)
        {
            foreach (var occurrence in item.Occurrences.Where(x => x.ScheduledDate < today && (x.Status is RecurringIncomeOccurrenceStatus.Planned or RecurringIncomeOccurrenceStatus.Paused)))
                occurrence.Expire();
            // Restore future occurrences paused by this operation and legacy rows
            // that were incorrectly cancelled by the previous implementation.
            foreach (var occurrence in item.Occurrences.Where(x => x.ScheduledDate >= today && (x.Status is RecurringIncomeOccurrenceStatus.Paused or RecurringIncomeOccurrenceStatus.Cancelled)))
                occurrence.RestoreAfterPause();
        }
        else
        {
            foreach (var occurrence in item.Occurrences.Where(x => x.ScheduledDate >= today && x.Status == RecurringIncomeOccurrenceStatus.Planned))
                occurrence.Pause();
        }

        await db.SaveChangesAsync(ct);
        if (active) await EnsureOccurrencesAsync(today.AddMonths(24), ct);
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var item = await db.RecurringIncomes.Include(x => x.Occurrences).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return false;

        var transactionIds = item.Occurrences.Where(x => x.TransactionId.HasValue).Select(x => x.TransactionId!.Value).ToList();
        var transactions = await db.Transactions.Where(x => transactionIds.Contains(x.Id)).ToListAsync(ct);
        foreach (var transaction in transactions) transaction.DetachRecurringIncomeOccurrence();

        db.RecurringIncomeOccurrences.RemoveRange(item.Occurrences);
        db.RecurringIncomes.Remove(item);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<RecurringIncomeOccurrenceResponse?> ReceiveAsync(Guid occurrenceId, CancellationToken ct, DateOnly? processingDate = null)
    {
        await using var dbTransaction = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct) : null;
        var transactionRolledBack = false;
        var occurrence = await db.RecurringIncomeOccurrences.Include(x => x.RecurringIncome).SingleOrDefaultAsync(x => x.Id == occurrenceId, ct);
        if (occurrence is null || !occurrence.RecurringIncome.IsActive || occurrence.Status is RecurringIncomeOccurrenceStatus.Cancelled or RecurringIncomeOccurrenceStatus.Paused) return null;
        if (occurrence.TransactionId is null)
        {
            var existing = await db.Transactions.SingleOrDefaultAsync(x => x.RecurringIncomeOccurrenceId == occurrenceId, ct);
            if (existing is not null)
            {
                occurrence.LinkExistingTransaction(existing.Id);
                await db.SaveChangesAsync(ct);
            }
            else
            {
                // Um recebimento antecipado entra no saldo real no dia em que foi confirmado.
                // A data agendada continua pertencendo à ocorrência, que fica marcada como recebida
                // e deixa de ser considerada pela projeção.
                var transactionDate = processingDate ?? Clock.Today;
                if (occurrence.ScheduledDate < transactionDate) transactionDate = occurrence.ScheduledDate;
                var transaction = new Transaction(occurrence.RecurringIncome.Description, occurrence.Amount, TransactionType.Income, transactionDate, occurrence.RecurringIncome.CategoryId, occurrence.Id);
                db.Transactions.Add(transaction);
                    occurrence.Receive(transaction.Id);
                try
                {
                    await db.SaveChangesAsync(ct);
                }
                catch (DbUpdateException)
                {
                    if (dbTransaction is not null) await dbTransaction.RollbackAsync(ct);
                    transactionRolledBack = true;
                    db.Entry(transaction).State = EntityState.Detached;
                    db.Entry(occurrence).State = EntityState.Detached;
                    db.ChangeTracker.Clear();
                    occurrence = await db.RecurringIncomeOccurrences.Include(x => x.RecurringIncome).SingleAsync(x => x.Id == occurrenceId, ct);
                    if (occurrence.TransactionId is null)
                        throw;
                }
                if (occurrence.TransactionId == transaction.Id)
                    await Reconciliation.ReconcileAsync(ct);
            }
        }
        if (dbTransaction is not null && !transactionRolledBack) await dbTransaction.CommitAsync(ct);
        return new(occurrence.Id, occurrence.ScheduledDate, occurrence.Amount, occurrence.Status, occurrence.TransactionId, occurrence.CancellationSource, occurrence.ProcessedAt);
    }

    public async Task<int> ProcessDueAsync(DateOnly today, CancellationToken ct)
    {
        await EnsureOccurrencesAsync(today, ct);
        var due = await db.RecurringIncomeOccurrences
            .Include(x => x.RecurringIncome)
            .Where(x => x.ScheduledDate <= today && x.Status == RecurringIncomeOccurrenceStatus.Planned && x.RecurringIncome.IsActive && x.RecurringIncome.AutomaticProcessing)
            .OrderBy(x => x.ScheduledDate).ToListAsync(ct);
        var processed = 0;
        foreach (var occurrence in due)
        {
            if (await ReceiveAsync(occurrence.Id, ct, today) is { Status: RecurringIncomeOccurrenceStatus.Received }) processed++;
        }
        return processed;
    }

    public async Task<IReadOnlyCollection<ProjectionMonthResponse>> ProjectionAsync(CancellationToken ct)
    {
        await EnsureOccurrencesAsync(Clock.Today.AddMonths(12), ct); var today = Clock.Today; var end = today.AddMonths(12); var income = await db.Transactions.Where(x => x.Type == TransactionType.Income && x.Date <= end).ToListAsync(ct); var expenses = await db.Transactions.Where(x => x.Type == TransactionType.Expense && x.Date <= end).ToListAsync(ct); var planned = await db.RecurringIncomeOccurrences.Where(x => x.Status == RecurringIncomeOccurrenceStatus.Planned && x.ScheduledDate >= today && x.ScheduledDate <= end).ToListAsync(ct); var initial = await db.FinancialSettings.Select(x => (decimal?)x.InitialBalance).SingleOrDefaultAsync(ct) ?? 0m; var result = new List<ProjectionMonthResponse>(); var balance = initial + income.Where(x => x.Date < today).Sum(x => x.Type == TransactionType.Income ? x.Amount : -x.Amount);
        for (var month = new DateOnly(today.Year, today.Month, 1); month <= new DateOnly(end.Year, end.Month, 1); month = month.AddMonths(1)) { var next = month.AddMonths(1); var real = income.Where(x => x.Date >= month && x.Date < next).Sum(x => x.Amount); var future = planned.Where(x => x.ScheduledDate >= month && x.ScheduledDate < next).Sum(x => x.Amount); var outgo = expenses.Where(x => x.Date >= month && x.Date < next).Sum(x => x.Amount); balance += real + future - outgo; result.Add(new(month, real, future, outgo, balance)); } return result;
    }

    public async Task EnsureOccurrencesAsync(DateOnly horizon, CancellationToken ct)
    {
        // Unit-test contexts may intentionally run without tenant filtering; use
        // one process-wide gate there while authenticated requests are isolated
        // per account.
        var accountId = db.CurrentUserId ?? Guid.Empty;
        var gate = occurrenceLocks.GetOrAdd(accountId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
        var today = Clock.Today; var items = await db.RecurringIncomes.Include(x => x.Occurrences).Where(x => x.IsActive && x.StartDate <= horizon && (!x.EndDate.HasValue || x.EndDate >= today)).ToListAsync(ct);
        foreach (var item in items) await ReconcileFutureOccurrencesAsync(item, horizon, ct);
        await db.SaveChangesAsync(ct);
        }
        finally { gate.Release(); }
    }
    private async Task ReconcileFutureOccurrencesAsync(RecurringIncome item, DateOnly horizon, CancellationToken ct)
    {
        var today = Clock.Today;
        var expectedDates = GenerateDates(item, horizon).Where(x => x >= today).ToHashSet();
        RepairLegacyCancelledBatch(item, expectedDates, today);

        var obsoleteForecasts = item.Occurrences.Where(x => x.ScheduledDate >= today && !expectedDates.Contains(x.ScheduledDate) && x.Status is RecurringIncomeOccurrenceStatus.Planned or RecurringIncomeOccurrenceStatus.Paused).ToList();
        db.RecurringIncomeOccurrences.RemoveRange(obsoleteForecasts);

        foreach (var date in expectedDates.OrderBy(x => x))
        {
            // Older data can contain two forecast rows for the same date. The
            // monthly summary must remain readable while those rows are being
            // reconciled; a duplicate must not turn into a 500 via LINQ.
            var existing = item.Occurrences.FirstOrDefault(x => x.ScheduledDate == date);
            if (existing is null)
            {
                db.RecurringIncomeOccurrences.Add(new RecurringIncomeOccurrence(item, date));
                continue;
            }

            if (existing.Status == RecurringIncomeOccurrenceStatus.Paused && item.IsActive)
                existing.RestoreAfterPause();
        }
    }
    private static HashSet<DateOnly> GenerateDates(RecurringIncome item, DateOnly horizon)
    {
        return RecurringScheduleService.Generate(item.StartDate, item.Frequency, item.EndDate, horizon, item.DayOfMonth).ToHashSet();
    }
    private static void RepairLegacyCancelledBatch(RecurringIncome item, IEnumerable<DateOnly> expectedDates, DateOnly today)
    {
        if (!item.IsActive) return;
        var futureExpected = expectedDates.Where(x => x >= today).ToHashSet();
        if (futureExpected.Count == 0) return;
        var future = item.Occurrences.Where(x => x.ScheduledDate >= today).ToList();
        var isLegacyBatch = futureExpected.All(date => future.FirstOrDefault(x => x.ScheduledDate == date) is { Status: RecurringIncomeOccurrenceStatus.Cancelled, TransactionId: null } occurrence && occurrence.CancellationSource != RecurringIncomeOccurrenceCancellationSource.User)
            && future.All(x => !futureExpected.Contains(x.ScheduledDate) || x.Status == RecurringIncomeOccurrenceStatus.Cancelled);
        if (!isLegacyBatch) return;
        foreach (var occurrence in future.Where(x => futureExpected.Contains(x.ScheduledDate))) occurrence.RestoreLegacyForecast();
    }
    private static DateOnly Next(DateOnly date, RecurringIncomeFrequency frequency, int? day) => frequency switch { RecurringIncomeFrequency.Weekly => date.AddDays(7), RecurringIncomeFrequency.Fortnightly => date.AddDays(14), RecurringIncomeFrequency.Monthly => date.AddMonths(1).WithDay(day ?? date.Day), RecurringIncomeFrequency.Bimonthly => date.AddMonths(2).WithDay(day ?? date.Day), RecurringIncomeFrequency.Quarterly => date.AddMonths(3).WithDay(day ?? date.Day), RecurringIncomeFrequency.Semiannual => date.AddMonths(6).WithDay(day ?? date.Day), RecurringIncomeFrequency.Annual => date.AddYears(1).WithDay(day ?? date.Day), _ => date.AddMonths(1) };
    private RecurringIncomeResponse Map(RecurringIncome x)
    {
        var today = Clock.Today;
        var next = x.IsActive
            ? x.Occurrences.Where(o => o.Status == RecurringIncomeOccurrenceStatus.Planned && o.ScheduledDate >= today).OrderBy(o => o.ScheduledDate).Select(o => (DateOnly?)o.ScheduledDate).FirstOrDefault()
            : null;
        return new(x.Id, x.Description, x.Amount, x.CategoryId, x.Category?.Name, x.Frequency, x.StartDate, x.EndDate, x.DayOfMonth, x.IsActive, x.AutomaticProcessing, next, x.Occurrences.OrderBy(o => o.ScheduledDate).Select(o => new RecurringIncomeOccurrenceResponse(o.Id, o.ScheduledDate, o.Amount, o.Status, o.TransactionId, o.CancellationSource, o.ProcessedAt)).ToList());
    }
}

 
