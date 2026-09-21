namespace Aloca.Api.Models;

public sealed class CommitmentPayment
{
    private CommitmentPayment() { }

    public CommitmentPayment(Guid financialCommitmentId, decimal amount, int installmentNumber, DateTime paidAt, bool wasAutomatic = false)
    {
        Id = Guid.NewGuid();
        FinancialCommitmentId = financialCommitmentId;
        Amount = amount;
        InstallmentNumber = installmentNumber;
        PaidAt = paidAt;
        WasAutomatic = wasAutomatic;
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public Guid FinancialCommitmentId { get; private set; }
    public decimal Amount { get; private set; }
    public int InstallmentNumber { get; private set; }
    public DateTime PaidAt { get; private set; }
    public bool WasAutomatic { get; private set; }
    public FinancialCommitment FinancialCommitment { get; private set; } = null!;
}
