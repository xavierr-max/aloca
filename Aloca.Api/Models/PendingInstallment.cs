using Aloca.Api.Services;

namespace Aloca.Api.Models;

public sealed record PendingInstallment(
    int Number,
    int Total,
    DateOnly DueDate,
    decimal Amount);

public static class FinancialCommitmentSchedule
{
    public static IReadOnlyList<PendingInstallment> GetInstallments(FinancialCommitment commitment, DateOnly referenceDate, DateOnly? horizon = null)
    {
        ArgumentNullException.ThrowIfNull(commitment);
        var frequency = commitment.Frequency == RecurringIncomeFrequency.Once ? RecurringIncomeFrequency.Once : commitment.IsRecurring ? commitment.Frequency : RecurringIncomeFrequency.Monthly;
        var endDate = commitment.Frequency == RecurringIncomeFrequency.Once ? commitment.DueDate : commitment.IsRecurring ? commitment.EndDate : commitment.DueDate.AddMonths(commitment.TotalInstallments - 1);
        var scheduleHorizon = horizon ?? (commitment.IsOpenEnded ? referenceDate.AddMonths(24) : endDate!.Value);
        return RecurringScheduleService.Generate(commitment.DueDate, frequency, endDate, scheduleHorizon, commitment.DueDate.Day)
            .Select((date, offset) => new PendingInstallment(offset + 1, commitment.IsOpenEnded ? 0 : commitment.TotalInstallments, date, commitment.InstallmentAmount)).ToList();
    }
    public static IReadOnlyList<PendingInstallment> GetPendingInstallments(FinancialCommitment commitment, DateOnly referenceDate, DateOnly? horizon = null)
    {
        ArgumentNullException.ThrowIfNull(commitment);

        // referenceDate deliberately does not remove an unpaid installment.
        // DueDate is a civil date, and an overdue obligation remains pending
        // until PaidInstallments advances.
        _ = referenceDate;

        return GetInstallments(commitment, referenceDate, horizon).Skip(commitment.PaidInstallments).ToList();
    }
}
