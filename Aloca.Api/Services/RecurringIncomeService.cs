using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class RecurringIncomeService(AlocaDbContext db)
{
    public async Task<IReadOnlyCollection<RecurringIncomeResponse>> GetAllAsync(CancellationToken ct)
    {
        await EnsureOccurrencesAsync(DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(24), ct);
        var rows = await db.RecurringIncomes.AsNoTracking().Include(x => x.Category).Include(x => x.Occurrences).OrderBy(x => x.Description).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<RecurringIncomeResponse?> GetAsync(Guid id, CancellationToken ct)
    { await EnsureOccurrencesAsync(DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(24), ct); var x = await db.RecurringIncomes.Include(x => x.Category).Include(x => x.Occurrences).SingleOrDefaultAsync(x => x.Id == id, ct); return x is null ? null : Map(x); }

    public async Task<RecurringIncomeResponse?> CreateAsync(RecurringIncomeRequest request, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(x => x.Id == request.CategoryId, ct)) return null;
        var item = new RecurringIncome(request.Description, request.Amount, request.CategoryId, request.Frequency, request.StartDate, request.EndDate, request.DayOfMonth); db.RecurringIncomes.Add(item); await db.SaveChangesAsync(ct); await EnsureOccurrencesAsync(DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(24), ct); return await GetAsync(item.Id, ct);
    }

    public async Task<RecurringIncomeResponse?> UpdateAsync(Guid id, RecurringIncomeRequest request, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(x => x.Id == request.CategoryId, ct)) return null;
        var item = await db.RecurringIncomes.Include(x => x.Occurrences).SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return null;
        item.Update(request.Description, request.Amount, request.CategoryId, request.Frequency, request.StartDate, request.EndDate, request.DayOfMonth);
        foreach (var occurrence in item.Occurrences.Where(x => x.Status == RecurringIncomeOccurrenceStatus.Planned)) occurrence.Cancel(); await db.SaveChangesAsync(ct); await EnsureOccurrencesAsync(DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(24), ct); return await GetAsync(id, ct);
    }

    public async Task<bool> SetActiveAsync(Guid id, bool active, CancellationToken ct)
    { var item = await db.RecurringIncomes.Include(x => x.Occurrences).SingleOrDefaultAsync(x => x.Id == id, ct); if (item is null) return false; item.SetActive(active); if (!active) foreach (var x in item.Occurrences.Where(x => x.Status == RecurringIncomeOccurrenceStatus.Planned)) x.Cancel(); await db.SaveChangesAsync(ct); return true; }

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

    public async Task<RecurringIncomeOccurrenceResponse?> ReceiveAsync(Guid occurrenceId, CancellationToken ct)
    {
        var occurrence = await db.RecurringIncomeOccurrences.Include(x => x.RecurringIncome).SingleOrDefaultAsync(x => x.Id == occurrenceId, ct);
        if (occurrence is null || occurrence.Status == RecurringIncomeOccurrenceStatus.Cancelled) return null;
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
                var transactionDate = DateOnly.FromDateTime(DateTime.UtcNow);
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
                    db.Entry(transaction).State = EntityState.Detached;
                    db.Entry(occurrence).State = EntityState.Detached;
                    occurrence = await db.RecurringIncomeOccurrences.Include(x => x.RecurringIncome).SingleAsync(x => x.Id == occurrenceId, ct);
                }
            }
        }
        return new(occurrence.Id, occurrence.ScheduledDate, occurrence.Amount, occurrence.Status, occurrence.TransactionId);
    }

    public async Task<IReadOnlyCollection<ProjectionMonthResponse>> ProjectionAsync(CancellationToken ct)
    {
        await EnsureOccurrencesAsync(DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(12), ct); var today = DateOnly.FromDateTime(DateTime.UtcNow); var end = today.AddMonths(12); var income = await db.Transactions.Where(x => x.Type == TransactionType.Income && x.Date <= end).ToListAsync(ct); var expenses = await db.Transactions.Where(x => x.Type == TransactionType.Expense && x.Date <= end).ToListAsync(ct); var planned = await db.RecurringIncomeOccurrences.Where(x => x.Status == RecurringIncomeOccurrenceStatus.Planned && x.ScheduledDate >= today && x.ScheduledDate <= end).ToListAsync(ct); var initial = await db.FinancialSettings.Select(x => (decimal?)x.InitialBalance).SingleOrDefaultAsync(ct) ?? 0m; var result = new List<ProjectionMonthResponse>(); var balance = initial + income.Where(x => x.Date < today).Sum(x => x.Type == TransactionType.Income ? x.Amount : -x.Amount);
        for (var month = new DateOnly(today.Year, today.Month, 1); month <= new DateOnly(end.Year, end.Month, 1); month = month.AddMonths(1)) { var next = month.AddMonths(1); var real = income.Where(x => x.Date >= month && x.Date < next).Sum(x => x.Amount); var future = planned.Where(x => x.ScheduledDate >= month && x.ScheduledDate < next).Sum(x => x.Amount); var outgo = expenses.Where(x => x.Date >= month && x.Date < next).Sum(x => x.Amount); balance += real + future - outgo; result.Add(new(month, real, future, outgo, balance)); } return result;
    }

    public async Task EnsureOccurrencesAsync(DateOnly horizon, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow); var items = await db.RecurringIncomes.Include(x => x.Occurrences).Where(x => x.IsActive && x.StartDate <= horizon && (!x.EndDate.HasValue || x.EndDate >= today)).ToListAsync(ct);
        foreach (var item in items) { var date = item.StartDate; while (date <= horizon && (!item.EndDate.HasValue || date <= item.EndDate)) { if (date >= today && !item.Occurrences.Any(x => x.ScheduledDate == date)) db.RecurringIncomeOccurrences.Add(new RecurringIncomeOccurrence(item, date)); date = Next(date, item.Frequency, item.DayOfMonth); } } await db.SaveChangesAsync(ct);
    }
    private static DateOnly Next(DateOnly date, RecurringIncomeFrequency frequency, int? day) => frequency switch { RecurringIncomeFrequency.Weekly => date.AddDays(7), RecurringIncomeFrequency.Fortnightly => date.AddDays(14), RecurringIncomeFrequency.Monthly => date.AddMonths(1).WithDay(day ?? date.Day), RecurringIncomeFrequency.Bimonthly => date.AddMonths(2).WithDay(day ?? date.Day), RecurringIncomeFrequency.Quarterly => date.AddMonths(3).WithDay(day ?? date.Day), RecurringIncomeFrequency.Semiannual => date.AddMonths(6).WithDay(day ?? date.Day), RecurringIncomeFrequency.Annual => date.AddYears(1).WithDay(day ?? date.Day), _ => date.AddMonths(1) };
    private static RecurringIncomeResponse Map(RecurringIncome x) => new(x.Id, x.Description, x.Amount, x.CategoryId, x.Category.Name, x.Frequency, x.StartDate, x.EndDate, x.DayOfMonth, x.IsActive, x.Occurrences.Where(o => o.Status == RecurringIncomeOccurrenceStatus.Planned).OrderBy(o => o.ScheduledDate).Select(o => (DateOnly?)o.ScheduledDate).FirstOrDefault(), x.Occurrences.OrderBy(o => o.ScheduledDate).Select(o => new RecurringIncomeOccurrenceResponse(o.Id, o.ScheduledDate, o.Amount, o.Status, o.TransactionId)).ToList());
}

file static class DateOnlyExtensions { public static DateOnly WithDay(this DateOnly date, int day) => new(date.Year, date.Month, Math.Min(day, DateTime.DaysInMonth(date.Year, date.Month))); }
