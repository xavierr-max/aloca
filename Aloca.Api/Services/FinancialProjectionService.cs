using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialProjectionService(AlocaDbContext db, RecurringIncomeService recurringService)
{
    public async Task<FinancialProjectionResponse> GetAsync(int months, CancellationToken ct)
    {
        months = Math.Clamp(months, 3, 24);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var firstMonth = new DateOnly(today.Year, today.Month, 1);
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
        var initial = await db.FinancialSettings.Select(x => (decimal?)x.InitialBalance).SingleOrDefaultAsync(ct) ?? 0m;
        var paymentDates = await db.CommitmentPayments.AsNoTracking().Where(x => x.PaidAt.Date <= DateTime.UtcNow.Date)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;

        var currentBalance = initial
            + transactions.Where(x => x.Date <= today && x.Type == TransactionType.Income).Sum(x => x.Amount)
            - transactions.Where(x => x.Date <= today && x.Type == TransactionType.Expense).Sum(x => x.Amount)
            - paymentDates;

        var futureIncome = transactions.Where(x => x.Type == TransactionType.Income && x.Date > today && x.Date < endExclusive)
            .Select(x => new ProjectionMovementResponse(x.Id.ToString(), x.Description, x.Amount, x.Date, x.Category?.Name, x.RecurringIncomeOccurrenceId.HasValue, null, null)).ToList();
        futureIncome.AddRange(recurring.Select(x => new ProjectionMovementResponse(x.Id.ToString(), x.RecurringIncome.Description, x.Amount, x.ScheduledDate, x.RecurringIncome.Category?.Name, true, null, null)));

        var futureExpenses = transactions.Where(x => x.Type == TransactionType.Expense && x.Date > today && x.Date < endExclusive)
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
        for (var month = firstMonth; month < endExclusive; month = month.AddMonths(1))
        {
            var next = month.AddMonths(1);
            var incomes = futureIncome.Where(x => x.Date >= month && x.Date < next).OrderBy(x => x.Date).ToList();
            var expenses = futureExpenses.Where(x => x.Date >= month && x.Date < next).OrderBy(x => x.Date).ToList();
            var incomeTotal = incomes.Sum(x => x.Amount);
            var expenseTotal = expenses.Sum(x => x.Amount);
            var opening = balance;
            balance += incomeTotal - expenseTotal;
            result.Add(new(month, opening, incomeTotal, expenseTotal, incomeTotal - expenseTotal, balance, incomes, expenses));
        }

        return new(currentBalance, result.Sum(x => x.TotalIncome), result.Sum(x => x.TotalExpense), balance, result);
    }
}
