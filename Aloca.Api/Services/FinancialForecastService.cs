using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public interface IFinancialForecastService
{
    Task<FinancialForecastResponse> GetAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken);

    Task<FinancialForecastResponse> GetAsync(
        DateOnly from,
        int months,
        CancellationToken cancellationToken);
}

/// <summary>
/// Single application boundary for forecast data consumed by future cards,
/// charts and monthly details.
/// </summary>
public sealed class FinancialForecastService(
    IForecastEventNormalizer normalizer,
    IForecastCalculator calculator,
    FinancialBalanceService balanceService,
    IBusinessClock clock) : IFinancialForecastService
{
    public async Task<FinancialForecastResponse> GetAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        // Forecast is also a direct entry point (unlike the recurring-income
        // list endpoint), so it must materialize active future occurrences
        // before normalization. Otherwise a persisted recurring-income row
        // without forecast rows is silently absent from the projection.
        await new RecurringIncomeService(balanceService.DbContext, clock: clock)
            .EnsureOccurrencesAsync(to, cancellationToken);
        var events = await normalizer.NormalizeAsync(from, to, cancellationToken);
        // The first opening balance is the current real balance: initial
        // balance plus all transactions dated up to the business date, less
        // all realized expenses dated up to that date. Therefore `from` is
        // expected to be the first month projected from the current state.
        var openingBalance = (await balanceService.GetAsync(cancellationToken)).SaldoReal;
        var today = clock.Today;
        // The opening balance already contains every realized transaction up
        // to today. Only planned events may change the future projection.
        // Overdue unpaid commitments remain economically pending, so project
        // them from today instead of dropping them because their due date is
        // in the past.
        var projectionEvents = ForecastProjectionRules.FutureEvents(events, today);
        var forecast = calculator.Calculate(from, to, projectionEvents, openingBalance);
        var balance = await balanceService.GetAsync(cancellationToken);
        var commitments = await balanceService.DbContext.FinancialCommitments
            .AsNoTracking()
            .Include(x => x.Category)
            .Where(x => x.TotalInstallments == 0 || x.PaidInstallments < x.TotalInstallments)
            .OrderBy(x => x.DueDate)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var details = new List<ForecastCommitmentResponse>();
        foreach (var commitment in commitments)
        {
            var availableAllocation = Math.Max(0m, commitment.AllocatedAmount);
            foreach (var installment in FinancialCommitmentSchedule.GetPendingInstallments(commitment, clock.Today, to)
                         .Where(x => x.DueDate >= from && x.DueDate <= to))
            {
                var covered = Math.Min(availableAllocation, installment.Amount);
                availableAllocation -= covered;
                var remaining = Math.Max(0m, installment.Amount - covered);
                var percentage = installment.Amount <= 0m
                    ? 100m
                    : Math.Min(100m, Math.Max(0m, covered / installment.Amount * 100m));
                details.Add(new(
                    commitment.Id,
                    commitment.Name,
                    installment.Amount,
                    covered,
                    remaining,
                    percentage,
                    installment.DueDate,
                    remaining == 0m ? "covered" : covered > 0m ? "partial" : "pending",
                    installment.Number,
                    installment.Total == 0 ? null : installment.Total,
                    commitment.Priority));
            }
        }

        var requiredAmount = commitments.Sum(x => Math.Max(0m, x.RemainingAmount));
        var totalAllocated = FinancialCalculations.TotalReservado(commitments.Select(x => x.AllocatedAmount));
        var metrics = FinancialDomainCalculator.CalculateReserveMetrics(balance.SaldoReal, totalAllocated, requiredAmount);
        var coverage = requiredAmount <= 0m
            ? 100m
            : Math.Min(100m, Math.Max(0m, totalAllocated / requiredAmount * 100m));
        var summary = forecast.Summary with
        {
            TotalCommitted = requiredAmount,
            TotalAllocated = metrics.Reserved,
            UnallocatedBalance = metrics.Unallocated,
            CoverageDeficit = metrics.UncoveredCommitments,
            FreeBalance = metrics.Free,
            RequiredAmount = requiredAmount,
            CoveragePercentage = coverage,
            Commitments = details
        };
        var monthsWithCoverage = forecast.Months.Select(month =>
        {
            var monthCommitments = details
                .Where(x => x.DueDate >= month.StartDate && x.DueDate <= month.EndDate)
                .ToList();
            var committed = monthCommitments.Sum(x => x.RequiredAmount);
            var allocated = monthCommitments.Sum(x => x.AllocatedAmount);
            var monthCoverage = committed <= 0m
                ? 100m
                : Math.Min(100m, Math.Max(0m, allocated / committed * 100m));
            var monthDeficit = Math.Max(0m, committed - allocated);
            var monthMetrics = FinancialDomainCalculator.CalculateReserveMetrics(balance.SaldoReal, allocated, committed);
            return month with
            {
                Committed = committed,
                Allocated = monthMetrics.Reserved,
                ConsideredBalance = balance.SaldoReal,
                FreeBalance = monthMetrics.Free,
                Coverage = monthCoverage,
                Commitments = monthCommitments,
                CoverageDeficit = monthMetrics.UncoveredCommitments
            };
        }).ToList();
        return forecast with { Summary = summary, Months = monthsWithCoverage };
    }

    public Task<FinancialForecastResponse> GetAsync(
        DateOnly from,
        int months,
        CancellationToken cancellationToken)
    {
        if (months is < 1 or > 24)
            throw new ArgumentOutOfRangeException(nameof(months), "O período deve estar entre 1 e 24 meses.");

        var start = new DateOnly(from.Year, from.Month, 1);
        var end = start.AddMonths(months).AddDays(-1);
        return GetAsync(start, end, cancellationToken);
    }
}
