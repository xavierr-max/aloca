namespace Aloca.Api.Services;

public static class ForecastProjectionRules
{
    public static IReadOnlyCollection<ForecastEvent> FutureEvents(
        IEnumerable<ForecastEvent> events,
        DateOnly today)
    {
        return events
            .Where(x => x.Status == ForecastEventStatus.Planned &&
                        (x.AccountingDate >= today || x.Origin == ForecastEventOrigin.FinancialCommitmentInstallment))
            .Select(x => x.AccountingDate < today
                ? x with { AccountingDate = today }
                : x)
            .ToList();
    }
}
