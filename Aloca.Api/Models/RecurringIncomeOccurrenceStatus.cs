namespace Aloca.Api.Models;

public enum RecurringIncomeOccurrenceStatus
{
    Planned,
    Received,
    Cancelled,
    Paused
}

public enum RecurringIncomeOccurrenceCancellationSource
{
    User,
    SystemExpiry,
    LegacyReschedule,
    LegacyPause
}
