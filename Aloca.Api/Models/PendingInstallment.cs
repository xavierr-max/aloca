using Aloca.Api.Services;

namespace Aloca.Api.Models;

public sealed record PendingInstallment(
    int Number,
    int Total,
    DateOnly DueDate,
    decimal Amount);

public static class FinancialCommitmentSchedule
{
    public static IReadOnlyList<PendingInstallment> GetPendingInstallments(FinancialCommitment commitment, DateOnly referenceDate, DateOnly? horizon = null)
    {
        ArgumentNullException.ThrowIfNull(commitment);

        // referenceDate deliberately does not remove an unpaid installment.
        // DueDate is a civil date, and an overdue obligation remains pending
        // until PaidInstallments advances.
        _ = referenceDate;

        var scheduleFrequency = commitment.Frequency == RecurringIncomeFrequency.Once ? RecurringIncomeFrequency.Once : commitment.IsRecurring ? commitment.Frequency : RecurringIncomeFrequency.Monthly;
        var endDate = commitment.Frequency == RecurringIncomeFrequency.Once ? commitment.DueDate : commitment.IsRecurring ? commitment.EndDate : commitment.DueDate.AddMonths(commitment.TotalInstallments - 1);
        var scheduleHorizon = horizon ?? (commitment.IsOpenEnded ? referenceDate.AddMonths(24) : endDate!.Value);
        var dates = RecurringScheduleService.Generate(commitment.DueDate, scheduleFrequency, endDate, scheduleHorizon, commitment.DueDate.Day)
            .Skip(commitment.PaidInstallments).ToList();
        return dates.Select((date, offset) => new PendingInstallment(
            commitment.PaidInstallments + offset + 1,
            commitment.IsOpenEnded ? 0 : commitment.TotalInstallments,
            date, commitment.InstallmentAmount)).ToList();
    }
}
