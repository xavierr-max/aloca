namespace Aloca.Api.Models;

public enum FinancialCommitmentOccurrenceStatus
{
    Planned,
    Pending,
    Paid,
    Cancelled
}

public sealed class FinancialCommitmentOccurrence
{
    private FinancialCommitmentOccurrence() { }

    public FinancialCommitmentOccurrence(FinancialCommitment commitment, DateOnly scheduledDate, int installmentNumber, DateOnly? businessToday = null)
    {
        Id = Guid.NewGuid();
        FinancialCommitmentId = commitment.Id;
        ScheduledDate = scheduledDate;
        InstallmentNumber = installmentNumber;
        Amount = commitment.InstallmentAmount;
        Status = scheduledDate < (businessToday ?? DateOnly.FromDateTime(DateTime.UtcNow)) ? FinancialCommitmentOccurrenceStatus.Pending : FinancialCommitmentOccurrenceStatus.Planned;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public Guid FinancialCommitmentId { get; private set; }
    public FinancialCommitment FinancialCommitment { get; private set; } = null!;
    public DateOnly ScheduledDate { get; private set; }
    public int InstallmentNumber { get; private set; }
    public decimal Amount { get; private set; }
    public FinancialCommitmentOccurrenceStatus Status { get; private set; }
    public Guid? CommitmentPaymentId { get; private set; }
    public CommitmentPayment? CommitmentPayment { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? ProcessedAt { get; private set; }

    public void UpdateForecastAmount(decimal amount)
    {
        if (Status is FinancialCommitmentOccurrenceStatus.Planned or FinancialCommitmentOccurrenceStatus.Pending)
            Amount = amount;
    }

    public void MarkPaid(Guid paymentId)
    {
        if (Status == FinancialCommitmentOccurrenceStatus.Paid && CommitmentPaymentId == paymentId) return;
        if (Status == FinancialCommitmentOccurrenceStatus.Paid) throw new InvalidOperationException("Occurrence is already paid.");
        Status = FinancialCommitmentOccurrenceStatus.Paid;
        CommitmentPaymentId = paymentId;
        ProcessedAt = DateTime.UtcNow;
    }

    public void RestoreAfterPayment(DateOnly? businessToday = null)
    {
        if (Status != FinancialCommitmentOccurrenceStatus.Paid) return;
        Status = ScheduledDate < (businessToday ?? DateOnly.FromDateTime(DateTime.UtcNow)) ? FinancialCommitmentOccurrenceStatus.Pending : FinancialCommitmentOccurrenceStatus.Planned;
        CommitmentPaymentId = null;
        ProcessedAt = null;
    }

    public void Cancel()
    {
        if (Status is FinancialCommitmentOccurrenceStatus.Planned or FinancialCommitmentOccurrenceStatus.Pending)
            Status = FinancialCommitmentOccurrenceStatus.Cancelled;
    }
}
