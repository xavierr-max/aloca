using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public interface IFinancialForecastService
{
    Task<FinancialForecastResponse> GetAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);
    Task<FinancialForecastResponse> GetAsync(DateOnly from, int months, CancellationToken cancellationToken);
}

public sealed class FinancialForecastService(IForecastEventNormalizer normalizer, IForecastCalculator calculator, FinancialBalanceService balanceService, IBusinessClock clock) : IFinancialForecastService
{
    public async Task<FinancialForecastResponse> GetAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        await new RecurringIncomeService(balanceService.DbContext, clock: clock).EnsureOccurrencesAsync(to, ct);
        var events = await normalizer.NormalizeAsync(from, to, ct);
        var balance = await balanceService.GetAsync(ct);
        var forecast = calculator.Calculate(from, to, ForecastProjectionRules.FutureEvents(events, clock.Today), balance.CurrentBalance);
        var commitments = await balanceService.DbContext.FinancialCommitments.AsNoTracking().Include(x => x.Occurrences)
            .Where(x => x.TotalInstallments == 0 || x.PaidInstallments < x.TotalInstallments).ToListAsync(ct);
        var details = commitments.SelectMany(c => FinancialCommitmentSchedule.GetPendingInstallments(c, clock.Today, to)
            .Where(i => i.DueDate >= from && i.DueDate <= to)
            .Select(i => new ForecastCommitmentResponse(c.Id, c.Name, i.Amount, i.Amount, i.DueDate, i.DueDate <= clock.Today ? "pending" : "planned", i.Number, i.Total == 0 ? null : i.Total, c.Priority))).ToList();
        var planned = details.Sum(x => x.DueAmount);
        var summary = forecast.Summary with { PlannedCommitmentAmount = planned, RemainingCommitmentAmount = planned, Commitments = details };
        return forecast with { Summary = summary };
    }

    public Task<FinancialForecastResponse> GetAsync(DateOnly from, int months, CancellationToken ct)
    {
        if (months is < 1 or > 36) throw new ArgumentOutOfRangeException(nameof(months));
        var start = new DateOnly(from.Year, from.Month, 1);
        return GetAsync(start, start.AddMonths(months).AddDays(-1), ct);
    }
}
