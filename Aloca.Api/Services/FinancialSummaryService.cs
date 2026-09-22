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
        return new(x.InitialBalance, x.TotalIncome, x.TotalExpense, x.SaldoReal, x.TotalReservado, x.SaldoNaoAlocado, x.SaldoLivre, x.DeficitCobertura);
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
            .Where(x => x.DueDate < nextPeriod &&
                        ((x.EndDate == null && x.Frequency != RecurringIncomeFrequency.Once) ||
                         (x.EndDate != null && x.EndDate >= period)))
            .ToListAsync(ct);
        var commitmentIds = commitments.Select(x => x.Id).ToArray();
        var payments = await db.CommitmentPayments.AsNoTracking()
            .Where(x => commitmentIds.Contains(x.FinancialCommitmentId))
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
                var occurrenceAllocated = paid ? commitment.InstallmentAmount :
                    Math.Clamp(commitment.AllocatedAmount - pendingIndex * commitment.InstallmentAmount, 0m, commitment.InstallmentAmount);
                if (!paid) pendingIndex++;
                var remaining = Math.Max(0m, commitment.InstallmentAmount - occurrenceAllocated);
                details.Add(new(
                    $"{commitment.Id}:{occurrence.Number}", commitment.Name,
                    commitment.IsRecurring || commitment.TotalInstallments > 1 ? occurrence.Number : null,
                    commitment.IsOpenEnded ? null : commitment.TotalInstallments,
                    occurrence.Date, commitment.InstallmentAmount, occurrenceAllocated, remaining,
                    commitment.InstallmentAmount == 0 ? 100m : Math.Min(100m, occurrenceAllocated / commitment.InstallmentAmount * 100m),
                    paid, remaining == 0m));
            }
        }

        var committed = details.Sum(x => x.DueAmount);
        var allocated = details.Sum(x => x.AllocatedAmount);
        var missing = Math.Max(0m, committed - allocated);
        var expectedIncome = incomes.Where(x => x.Status == RecurringIncomeOccurrenceStatus.Planned && x.ScheduledDate >= today).Sum(x => x.Amount);
        var expectedCommitments = details.Where(x => !x.IsPaid && x.DueDate >= today).Sum(x => x.DueAmount);
        var currentBalance = (await balanceService.GetAsync(ct)).SaldoReal;
        return new(period, incomes.Sum(x => x.Amount), committed, incomes.Sum(x => x.Amount) - committed,
            allocated, missing, committed > 0 ? Math.Min(100m, allocated / committed * 100m) : 100m,
            currentBalance + expectedIncome - expectedCommitments, details);
    }

}
