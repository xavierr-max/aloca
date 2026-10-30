namespace Aloca.Api.Models;

public sealed class CommitmentPayment
{
    private CommitmentPayment() { }

    public CommitmentPayment(Guid financialCommitmentId, decimal amount, int installmentNumber, DateTime paidAt, bool wasAutomatic = false, Guid? financialCommitmentOccurrenceId = null)
    {
        Id = Guid.NewGuid();
        FinancialCommitmentId = financialCommitmentId;
        Amount = amount;
        InstallmentNumber = installmentNumber;
        PaidAt = paidAt;
        WasAutomatic = wasAutomatic;
        FinancialCommitmentOccurrenceId = financialCommitmentOccurrenceId;
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public Guid FinancialCommitmentId { get; private set; }
    public decimal Amount { get; private set; }
    public int InstallmentNumber { get; private set; }
    public DateTime PaidAt { get; private set; }
    public bool WasAutomatic { get; private set; }
    public Guid? FinancialCommitmentOccurrenceId { get; private set; }
    public DateTime? ReversedAt { get; private set; }
    public Guid? ReversalTransactionId { get; private set; }
    public FinancialCommitmentOccurrence? FinancialCommitmentOccurrence { get; private set; }
    public FinancialCommitment FinancialCommitment { get; private set; } = null!;

    public bool IsReversed => ReversedAt.HasValue;
    public void MarkReversed(DateTime reversedAt, Guid reversalTransactionId)
    {
        if (IsReversed && ReversalTransactionId != reversalTransactionId)
            throw new InvalidOperationException("Payment has already been reversed.");
        ReversedAt ??= reversedAt;
        ReversalTransactionId ??= reversalTransactionId;
    }
}
