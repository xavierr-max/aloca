namespace Aloca.Api.Models;

public sealed class FinancialCommitment
{
    private FinancialCommitment()
    {
    }

    public FinancialCommitment(
        string name,
        decimal installmentAmount,
        int totalInstallments,
        int paidInstallments,
        decimal allocatedAmount,
        int priority,
        bool isFullyCommitted)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Commitment name is required.", nameof(name));
        }

        if (installmentAmount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(installmentAmount), "Installment amount must be greater than zero.");
        }

        if (totalInstallments <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(totalInstallments), "Total installments must be greater than zero.");
        }

        if (paidInstallments < 0 || paidInstallments > totalInstallments)
        {
            throw new ArgumentOutOfRangeException(nameof(paidInstallments), "Paid installments must be between zero and total installments.");
        }

        if (allocatedAmount < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(allocatedAmount), "Allocated amount cannot be negative.");
        }

        if (priority <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(priority), "Priority must be greater than zero.");
        }

        Id = Guid.NewGuid();
        Name = name.Trim();
        InstallmentAmount = installmentAmount;
        TotalInstallments = totalInstallments;
        PaidInstallments = paidInstallments;
        AllocatedAmount = allocatedAmount;
        Priority = priority;
        IsFullyCommitted = isFullyCommitted;
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; } = null!;

    public decimal InstallmentAmount { get; private set; }

    public int TotalInstallments { get; private set; }

    public int PaidInstallments { get; private set; }

    public decimal AllocatedAmount { get; private set; }

    public int Priority { get; private set; }

    public bool IsFullyCommitted { get; private set; }

    public decimal TotalAmount => InstallmentAmount * TotalInstallments;

    public int RemainingInstallments => TotalInstallments - PaidInstallments;

    public decimal RemainingAmount => InstallmentAmount * RemainingInstallments;

    public int CoveredInstallments
    {
        get
        {
            var installmentsCoveredByAllocation = decimal.Floor(AllocatedAmount / InstallmentAmount);
            return (int)decimal.Min(installmentsCoveredByAllocation, RemainingInstallments);
        }
    }

    public decimal AmountNeededForNextInstallment => RemainingInstallments == 0
        ? 0m
        : decimal.Max(InstallmentAmount - AllocatedAmount, 0m);

    public decimal AmountNeededForFullCoverage => decimal.Max(RemainingAmount - AllocatedAmount, 0m);
}
