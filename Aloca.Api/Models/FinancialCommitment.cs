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

    public decimal ExcessAllocatedAmount => decimal.Max(AllocatedAmount - RemainingAmount, 0m);

    public bool IsCompleted => PaidInstallments == TotalInstallments;

    public void UpdateDetails(string name, decimal installmentAmount, int totalInstallments, int priority, bool isFullyCommitted)
    {
        ValidateName(name);
        ValidateInstallmentAmount(installmentAmount);
        ValidateTotalInstallments(totalInstallments);
        ValidatePriority(priority);

        if (totalInstallments < PaidInstallments)
        {
            throw new ArgumentException("Total installments cannot be less than paid installments.", nameof(totalInstallments));
        }

        Name = name.Trim();
        InstallmentAmount = installmentAmount;
        TotalInstallments = totalInstallments;
        Priority = priority;
        IsFullyCommitted = isFullyCommitted;
    }

    public void Allocate(decimal amount)
    {
        ValidatePositiveAmount(amount, nameof(amount));
        AllocatedAmount += amount;
    }

    public void Deallocate(decimal amount)
    {
        ValidatePositiveAmount(amount, nameof(amount));
        if (amount > AllocatedAmount)
        {
            throw new InvalidOperationException("Deallocation amount cannot exceed the allocated amount.");
        }

        AllocatedAmount -= amount;
    }

    public void RegisterPayment()
    {
        if (IsCompleted)
        {
            throw new InvalidOperationException("All installments have already been paid.");
        }

        PaidInstallments++;
        AllocatedAmount = decimal.Max(0m, AllocatedAmount - InstallmentAmount);
    }

    public void ReverseLatestPayment()
    {
        if (PaidInstallments == 0)
        {
            throw new InvalidOperationException("There are no payments to reverse.");
        }

        PaidInstallments--;
    }

    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Commitment name is required.", nameof(name));
    }

    private static void ValidateInstallmentAmount(decimal amount)
    {
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount), "Installment amount must be greater than zero.");
    }

    private static void ValidateTotalInstallments(int total)
    {
        if (total <= 0) throw new ArgumentOutOfRangeException(nameof(total), "Total installments must be greater than zero.");
    }

    private static void ValidatePriority(int priority)
    {
        if (priority <= 0) throw new ArgumentOutOfRangeException(nameof(priority), "Priority must be greater than zero.");
    }

    private static void ValidatePositiveAmount(decimal amount, string parameterName)
    {
        if (amount <= 0) throw new ArgumentOutOfRangeException(parameterName, "Amount must be greater than zero.");
    }
}
