using Aloca.Api.DTOs;

namespace Aloca.Api.Services;

public interface IForecastCalculator
{
    FinancialForecastResponse Calculate(
        DateOnly from,
        DateOnly to,
        IEnumerable<ForecastEvent> events,
        decimal openingBalance);
}

/// <summary>
/// Owns the month-by-month accumulation. The opening balance is supplied by
/// the application service so this calculator remains pure and cannot create
/// a competing balance rule.
/// </summary>
public sealed class ForecastCalculator : IForecastCalculator
{
    public FinancialForecastResponse Calculate(
        DateOnly from,
        DateOnly to,
        IEnumerable<ForecastEvent> events,
        decimal openingBalance)
    {
        ArgumentOutOfRangeException.ThrowIfGreaterThan(from, to);
        ArgumentNullException.ThrowIfNull(events);

        var normalizedFrom = new DateOnly(from.Year, from.Month, 1);
        var normalizedTo = new DateOnly(to.Year, to.Month, 1);
        var sourceEvents = events.ToList();
        var months = new List<ForecastMonthResponse>();
        var balance = openingBalance;

        for (var month = normalizedFrom; month <= normalizedTo; month = month.AddMonths(1))
        {
            var startDate = month;
            var endDate = month.AddMonths(1).AddDays(-1);
            var monthEvents = sourceEvents
                .Where(x => x.AccountingDate >= startDate && x.AccountingDate <= endDate)
                .OrderBy(x => x.AccountingDate)
                .ThenBy(x => x.SourceId)
                .ToList();
            var incomeEvents = monthEvents.Where(x => x.Type == ForecastEventType.Income).ToList();
            var expenseEvents = monthEvents.Where(x => x.Type == ForecastEventType.Expense).ToList();
            var realizedIncome = incomeEvents.Where(x => x.Status == ForecastEventStatus.Realized).Sum(x => x.Amount);
            var plannedIncome = incomeEvents.Where(x => x.Status == ForecastEventStatus.Planned).Sum(x => x.Amount);
            var realizedExpense = expenseEvents.Where(x => x.Status == ForecastEventStatus.Realized).Sum(x => x.Amount);
            var plannedExpense = expenseEvents.Where(x => x.Status == ForecastEventStatus.Planned).Sum(x => x.Amount);
            var totalIncome = realizedIncome + plannedIncome;
            var totalExpense = realizedExpense + plannedExpense;
            var monthlyResult = totalIncome - totalExpense;
            var closingBalance = balance + monthlyResult;

            months.Add(new(
                month.Year,
                month.Month,
                startDate,
                endDate,
                balance,
                realizedIncome,
                plannedIncome,
                totalIncome,
                realizedExpense,
                plannedExpense,
                totalExpense,
                monthlyResult,
                closingBalance,
                incomeEvents.Select(ToResponse).ToList(),
                expenseEvents.Select(ToResponse).ToList()));

            balance = closingBalance;
        }

        var totalIncomeAmount = months.Sum(x => x.TotalIncome);
        var totalExpenseAmount = months.Sum(x => x.TotalExpense);
        var periodMetrics = FinancialDomainCalculator.CalculatePeriodMetrics(
            months.Sum(x => x.RealizedIncome), months.Sum(x => x.PlannedIncome),
            months.Sum(x => x.RealizedExpense), months.Sum(x => x.PlannedExpense));
        var summary = new ForecastSummaryResponse(
            openingBalance,
            balance,
            totalIncomeAmount,
            totalExpenseAmount,
            totalIncomeAmount - totalExpenseAmount,
            balance,
            0m,
            0m,
            0m,
            0m,
            0m,
            0m,
            100m,
            Array.Empty<ForecastCommitmentResponse>(),
            periodMetrics.RealizedIncome, periodMetrics.PlannedIncome,
            periodMetrics.RealizedExpense, periodMetrics.PlannedExpense,
            periodMetrics.RealResult, periodMetrics.ForecastResult);
        return new FinancialForecastResponse(
            normalizedFrom,
            new DateOnly(normalizedTo.Year, normalizedTo.Month, DateTime.DaysInMonth(normalizedTo.Year, normalizedTo.Month)),
            summary,
            months);
    }

    private static ForecastItemResponse ToResponse(ForecastEvent item) => new(
        item.SourceId,
        item.Type,
        item.Status,
        item.Amount,
        item.AccountingDate,
        item.ScheduledDate,
        item.CategoryId,
        item.CategoryName,
        item.RecurringIncomeId,
        item.FinancialCommitmentId,
        item.InstallmentNumber,
        item.TransactionId,
        item.Origin,
        item.Description,
        item.RecurringIncomeOccurrenceId);
}
