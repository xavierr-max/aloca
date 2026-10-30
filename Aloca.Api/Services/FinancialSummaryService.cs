using Aloca.Api.DTOs;
using Aloca.Api.Data;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialSummaryService
{
    private readonly AlocaDbContext db;
    private readonly FinancialBalanceService balanceService;
    private readonly IBusinessClock clock;

    public FinancialSummaryService(AlocaDbContext dbContext, FinancialBalanceService balanceService, IBusinessClock? businessClock = null)
    { db = dbContext; this.balanceService = balanceService; clock = businessClock ?? new SystemBusinessClock(new ConfigurationBuilder().Build()); }

    public FinancialSummaryService(FinancialBalanceService balanceService)
    { this.balanceService = balanceService; db = balanceService.DbContext; clock = new SystemBusinessClock(new ConfigurationBuilder().Build()); }

    public FinancialSummaryService(AlocaDbContext dbContext) : this(dbContext, new FinancialBalanceService(dbContext)) { }

    public async Task<FinancialSummaryResponse> GetAsync(CancellationToken cancellationToken)
    {
        var x = await balanceService.GetAsync(cancellationToken);
        return new(x.InitialBalance, x.TotalIncome, x.TotalExpense, x.CurrentBalance, clock.Today);
    }

    public async Task<MonthlyFinancialSummaryResponse> GetMonthlyAsync(DateOnly period, CancellationToken ct)
    {
        // DateOnly is the API contract: discard any day supplied by a client
        // and never derive the month from a local/UTC DateTime conversion.
        period = new DateOnly(period.Year, period.Month, 1);
        var nextPeriod = period.AddMonths(1);
        var today = clock.Today;
        await new RecurringIncomeService(db, clock: clock).EnsureOccurrencesAsync(nextPeriod.AddDays(-1), ct);
        var incomes = await db.RecurringIncomeOccurrences.AsNoTracking()
            .Include(x => x.RecurringIncome)
            .Where(x => x.ScheduledDate >= period && x.ScheduledDate < nextPeriod &&
                        x.Status != RecurringIncomeOccurrenceStatus.Cancelled &&
                        x.Status != RecurringIncomeOccurrenceStatus.Paused)
            .ToListAsync(ct);
        var commitments = await db.FinancialCommitments.AsNoTracking()
            .Include(x => x.CommitmentPayments)
            .Where(x => x.DueDate < nextPeriod &&
                        ((x.EndDate == null && x.Frequency != RecurringIncomeFrequency.Once) ||
                         (x.EndDate != null && x.EndDate >= period)))
            .ToListAsync(ct);
        var commitmentIds = commitments.Select(x => x.Id).ToArray();
        var transactions = await db.Transactions.AsNoTracking()
            .Where(x => x.Date >= period && x.Date < nextPeriod && !x.IsBalanceAdjustment && x.Description != "Ajuste manual de saldo")
            .ToListAsync(ct);
        var payments = await db.CommitmentPayments.AsNoTracking()
            .Where(x => commitmentIds.Contains(x.FinancialCommitmentId) && !x.ReversedAt.HasValue)
            .Select(x => new { x.FinancialCommitmentId, x.InstallmentNumber })
            .ToListAsync(ct);

        var details = new List<MonthlyCommitmentResponse>();
        foreach (var commitment in commitments)
        {
            var frequency = commitment.Frequency == RecurringIncomeFrequency.Once
                ? RecurringIncomeFrequency.Once
                : commitment.IsRecurring ? commitment.Frequency : RecurringIncomeFrequency.Monthly;
            var end = commitment.Frequency == RecurringIncomeFrequency.Once
                ? commitment.DueDate
                : commitment.IsRecurring ? commitment.EndDate : commitment.DueDate.AddMonths(commitment.TotalInstallments - 1);
            var dates = RecurringScheduleService.Generate(commitment.DueDate, frequency, end, nextPeriod.AddDays(-1), commitment.DueDate.Day)
                .Select((date, index) => (Date: date, Number: index + 1))
                .Where(x => x.Date >= period && x.Date < nextPeriod)
                .ToList();
            var paidNumbers = payments.Where(x => x.FinancialCommitmentId == commitment.Id)
                .Select(x => x.InstallmentNumber).ToHashSet();
            var pendingIndex = RecurringScheduleService.Generate(commitment.DueDate, frequency, end, period.AddDays(-1), commitment.DueDate.Day)
                .Select((date, index) => index + 1)
                .Count(number => !paidNumbers.Contains(number));
            foreach (var occurrence in dates)
            {
                var paid = paidNumbers.Contains(occurrence.Number);
                var occurrencePaid = paid ? commitment.InstallmentAmount : 0m;
                if (!paid) pendingIndex++;
                var remaining = Math.Max(0m, commitment.InstallmentAmount - occurrencePaid);
                details.Add(new(
                    commitment.Id, $"{commitment.Id}:{occurrence.Number}", commitment.Name,
                    commitment.IsRecurring || commitment.TotalInstallments > 1 ? occurrence.Number : null,
                    commitment.IsOpenEnded ? null : commitment.TotalInstallments,
                    occurrence.Date, commitment.InstallmentAmount, occurrencePaid, remaining,
                    paid, commitment.Priority, commitment.Urgent,
                    commitment.RequiresAttention, commitment.IsCompleted,
                    commitment.OverallRemainingAmount));
            }
        }

        var commitmentTotal = details.Sum(x => x.DueAmount);
        var paidAmount = details.Sum(x => x.PaidAmount);
        var realizedIncome = transactions.Where(x => x.Type == TransactionType.Income && x.Date <= today).Sum(x => x.Amount);
        var realizedExpense = transactions.Where(x => x.Type == TransactionType.Expense && x.Date <= today).Sum(x => x.Amount);
        var futureTransactionIncome = transactions.Where(x => x.Type == TransactionType.Income && x.Date > today).Sum(x => x.Amount);
        var futureTransactionExpense = transactions.Where(x => x.Type == TransactionType.Expense && x.Date > today).Sum(x => x.Amount);
        var plannedIncome = incomes.Where(x => x.Status == RecurringIncomeOccurrenceStatus.Planned && !x.TransactionId.HasValue).Sum(x => x.Amount);
        var plannedExpense = details.Where(x => !x.IsPaid).Sum(x => x.DueAmount);
        var currentBalance = (await balanceService.GetAsync(ct)).SaldoReal;
        var projectionStart = new DateOnly(today.Year, today.Month, 1);
        var projectionEnd = nextPeriod.AddDays(-1);
        var projectedClosingBalance = currentBalance;
        if (projectionStart <= projectionEnd)
        {
            var projectionEvents = await new ForecastEventNormalizer(db, clock)
                .NormalizeAsync(projectionStart, projectionEnd, ct);
            var projection = new ForecastCalculator().Calculate(
                projectionStart,
                projectionEnd,
                ForecastProjectionRules.FutureEvents(projectionEvents, today),
                currentBalance);
            projectedClosingBalance = projection.Months.LastOrDefault()?.ClosingBalance ?? currentBalance;
        }
        var urgentCommitments = (await db.FinancialCommitments.AsNoTracking()
                .Include(x => x.CommitmentPayments)
                .Where(x => x.Urgent)
                .ToListAsync(ct))
            .Where(x => x.RequiresAttention)
            .Select(x => new MonthlyUrgentCommitmentResponse(x.Id, x.Name, x.OverallRemainingAmount))
            .ToList();
        plannedIncome += futureTransactionIncome;
        plannedExpense += futureTransactionExpense;
        var metrics = FinancialDomainCalculator.CalculatePeriodMetrics(realizedIncome, plannedIncome, realizedExpense, plannedExpense);
        return new(period, incomes.Sum(x => x.Amount), commitmentTotal, paidAmount - commitmentTotal,
            plannedIncome + plannedExpense, paidAmount,
            projectedClosingBalance, details, urgentCommitments,
            metrics.RealizedIncome, metrics.PlannedIncome, metrics.TotalIncome,
            metrics.RealizedExpense, metrics.PlannedExpense, metrics.TotalExpense,
            metrics.RealResult, metrics.ForecastResult);
    }

}
