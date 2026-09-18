using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialProjectionService(AlocaDbContext db, RecurringIncomeService recurringService, FinancialBalanceService balanceService)
{
    public static FinancialProjectionMonthResponse ProjectMonth(
        DateOnly month,
        decimal openingBalance,
        IReadOnlyCollection<ProjectionMovementResponse> incomes,
        IReadOnlyCollection<ProjectionMovementResponse> expenses)
    {
        var entries = incomes.Sum(x => x.Amount);
        var outgoing = expenses.Sum(x => x.Amount);
        var netResult = entries - outgoing;
        return new(month, openingBalance, entries, outgoing, netResult,
            openingBalance + netResult, incomes, expenses);
    }

    public FinancialProjectionService(AlocaDbContext db, RecurringIncomeService recurringService)
        : this(db, recurringService, new FinancialBalanceService(db)) { }

    public Task<FinancialProjectionResponse> GetAsync(int months, CancellationToken ct) => GetAsync(months, null, ct);

    public async Task<FinancialProjectionResponse> GetAsync(int months, DateOnly? requestedStart, CancellationToken ct)
    {
        // The chart decides how many returned months it displays. The caller may
        // request a longer horizon so a selected month outside that view still
        // uses the same accumulated projection engine.
        months = Math.Max(1, months);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var firstMonth = requestedStart.HasValue ? new DateOnly(requestedStart.Value.Year, requestedStart.Value.Month, 1) : new DateOnly(today.Year, today.Month, 1);
        // A projection requested for a future month still needs to walk the
        // months before it so its opening balance is the accumulated forecast,
        // just like the regular chart projection.
        var calculationStart = firstMonth > new DateOnly(today.Year, today.Month, 1)
            ? new DateOnly(today.Year, today.Month, 1)
            : firstMonth;
        var endExclusive = firstMonth.AddMonths(months);
        await recurringService.EnsureOccurrencesAsync(endExclusive.AddDays(-1), ct);

        // Every source is loaded once. The rest of the work is deterministic in memory.
        var transactions = await db.Transactions.AsNoTracking().Include(x => x.Category)
            .Where(x => x.Date <= endExclusive).ToListAsync(ct);
        var recurring = await db.RecurringIncomeOccurrences.AsNoTracking()
            .Include(x => x.RecurringIncome).ThenInclude(x => x.Category)
            // A planned occurrence is the source of a forecast only while it has
            // no generated transaction. The link check keeps an inconsistent
            // legacy row from being counted together with its transaction.
            .Where(x => x.Status == RecurringIncomeOccurrenceStatus.Planned && x.TransactionId == null && x.ScheduledDate >= today && x.ScheduledDate < endExclusive)
            .ToListAsync(ct);
        var commitments = await db.FinancialCommitments.AsNoTracking().Include(x => x.Category)
            .Where(x => x.PaidInstallments < x.TotalInstallments).ToListAsync(ct);
        var currentBalance = (await balanceService.GetAsync(ct)).SaldoReal;

        var futureIncome = transactions.Where(x => x.Type == TransactionType.Income && x.Date >= calculationStart && x.Date < endExclusive && x.Date > today)
            .Select(x => new ProjectionMovementResponse(x.Id.ToString(), x.Description, x.Amount, x.Date, x.Category?.Name, x.RecurringIncomeOccurrenceId.HasValue, null, null)).ToList();
        futureIncome.AddRange(recurring.Select(x => new ProjectionMovementResponse(x.Id.ToString(), x.RecurringIncome.Description, x.Amount, x.ScheduledDate, x.RecurringIncome.Category?.Name, true, null, null)));

        var futureExpenses = transactions.Where(x => x.Type == TransactionType.Expense && x.Date >= calculationStart && x.Date < endExclusive && x.Date > today)
            .Select(x => new ProjectionMovementResponse(x.Id.ToString(), x.Description, x.Amount, x.Date, x.Category?.Name, false, null, null)).ToList();
        foreach (var commitment in commitments)
        {
            foreach (var installment in FinancialCommitmentSchedule.GetPendingInstallments(commitment, today))
            {
                if (installment.DueDate < firstMonth || installment.DueDate >= endExclusive) continue;
                futureExpenses.Add(new ProjectionMovementResponse(
                    $"{commitment.Id}:{installment.Number}", commitment.Name, installment.Amount, installment.DueDate,
                    commitment.Category?.Name, false, installment.Number, installment.Total));
            }
        }

        var result = new List<FinancialProjectionMonthResponse>(months);
        var balance = currentBalance;
        for (var month = calculationStart; month < endExclusive; month = month.AddMonths(1))
        {
            var next = month.AddMonths(1);
            var incomes = futureIncome.Where(x => x.Date >= month && x.Date < next).OrderBy(x => x.Date).ToList();
            var expenses = futureExpenses.Where(x => x.Date >= month && x.Date < next).OrderBy(x => x.Date).ToList();
            var monthProjection = ProjectMonth(month, balance, incomes, expenses);
            balance = monthProjection.ClosingBalance;
            if (month >= firstMonth)
                result.Add(monthProjection);
        }

        return new(currentBalance, result.Sum(x => x.TotalIncome), result.Sum(x => x.TotalExpense), balance, result);
    }
}
