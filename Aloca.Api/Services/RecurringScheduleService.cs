using Aloca.Api.Models;

namespace Aloca.Api.Services;

public static class RecurringScheduleService
{
    public static DateOnly WithDay(this DateOnly date, int day) => new(date.Year, date.Month, Math.Min(day, DateTime.DaysInMonth(date.Year, date.Month)));

    public static DateOnly Next(DateOnly date, RecurringIncomeFrequency frequency, int? dayOfMonth = null) => frequency switch
    {
        RecurringIncomeFrequency.Once => date,
        RecurringIncomeFrequency.Weekly => date.AddDays(7),
        RecurringIncomeFrequency.Fortnightly => date.AddDays(14),
        RecurringIncomeFrequency.Monthly => date.AddMonths(1).WithDay(dayOfMonth ?? date.Day),
        RecurringIncomeFrequency.Bimonthly => date.AddMonths(2).WithDay(dayOfMonth ?? date.Day),
        RecurringIncomeFrequency.Quarterly => date.AddMonths(3).WithDay(dayOfMonth ?? date.Day),
        RecurringIncomeFrequency.Semiannual => date.AddMonths(6).WithDay(dayOfMonth ?? date.Day),
        RecurringIncomeFrequency.Annual => date.AddYears(1).WithDay(dayOfMonth ?? date.Day),
        _ => throw new ArgumentOutOfRangeException(nameof(frequency))
    };

    public static IEnumerable<DateOnly> Generate(DateOnly start, RecurringIncomeFrequency frequency, DateOnly? endDate, DateOnly horizon, int? dayOfMonth = null)
    {
        var date = start;
        while (date <= horizon && (!endDate.HasValue || date <= endDate.Value))
        {
            yield return date;
            if (frequency == RecurringIncomeFrequency.Once) yield break;
            date = Next(date, frequency, dayOfMonth);
        }
    }
}
