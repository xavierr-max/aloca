namespace Aloca.Api.Models;

public sealed record PendingInstallment(
    int Number,
    int Total,
    DateOnly DueDate,
    decimal Amount);

public static class FinancialCommitmentSchedule
{
    public static IReadOnlyList<PendingInstallment> GetPendingInstallments(
        FinancialCommitment commitment,
        DateOnly referenceDate)
    {
        ArgumentNullException.ThrowIfNull(commitment);

        // referenceDate deliberately does not remove an unpaid installment.
        // DueDate is a civil date, and an overdue obligation remains pending
        // until PaidInstallments advances.
        _ = referenceDate;

        return Enumerable.Range(commitment.PaidInstallments, commitment.RemainingInstallments)
            .Select(index => new PendingInstallment(
                index + 1,
                commitment.TotalInstallments,
                commitment.DueDate.AddMonths(index),
                commitment.InstallmentAmount))
            .ToList();
    }
}
