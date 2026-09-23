using Aloca.Api.Services;

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
        int? priority,
        bool isFullyCommitted,
        DateOnly? dueDate = null, string? objective = null, bool urgent = false, bool automaticProcessing = false)
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

        if (priority is <= 0)
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
        DueDate = dueDate ?? BusinessClock.Today();
        Objective = objective?.Trim();
        Urgent = urgent;
        AutomaticProcessing = automaticProcessing;
        Frequency = totalInstallments == 1 ? RecurringIncomeFrequency.Once : RecurringIncomeFrequency.Monthly;
        EndDate = DueDate.AddMonths(totalInstallments - 1);
        IsRecurring = totalInstallments > 1;
    }

    public FinancialCommitment(string name, decimal amount, RecurringIncomeFrequency frequency, DateOnly firstDueDate, DateOnly? endDate,
        int? priority, bool isFullyCommitted, string? objective = null, bool urgent = false, bool automaticProcessing = false)
    {
        ValidateName(name);
        ValidateInstallmentAmount(amount);
        if (!Enum.IsDefined(frequency)) throw new ArgumentOutOfRangeException(nameof(frequency));
        if (endDate < firstDueDate) throw new ArgumentException("End date cannot be before first due date.", nameof(endDate));
        ValidatePriority(priority);

        Id = Guid.NewGuid(); Name = name.Trim(); InstallmentAmount = amount;
        PaidInstallments = 0; AllocatedAmount = 0m; Priority = priority; IsFullyCommitted = isFullyCommitted;
        DueDate = firstDueDate; Frequency = frequency; EndDate = frequency == RecurringIncomeFrequency.Once ? firstDueDate : endDate;
        IsRecurring = frequency != RecurringIncomeFrequency.Once; TotalInstallments = EndDate.HasValue ? RecurringScheduleServiceCount(firstDueDate, frequency, EndDate) : 0;
        Objective = objective?.Trim(); Urgent = urgent; AutomaticProcessing = automaticProcessing;
    }

    public Guid Id { get; private set; }

    public Guid UserId { get; private set; }

    public string Name { get; private set; } = null!;

    public decimal InstallmentAmount { get; private set; }

    public int TotalInstallments { get; private set; }

    public int PaidInstallments { get; private set; }

    public decimal AllocatedAmount { get; private set; }

    public int? Priority { get; private set; }

    public bool IsFullyCommitted { get; private set; }

    public Guid? CategoryId { get; private set; }
    public Category? Category { get; private set; }

    public DateOnly DueDate { get; private set; }
    public RecurringIncomeFrequency Frequency { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public bool IsRecurring { get; private set; }
    public string? Objective { get; private set; }

    public bool Urgent { get; private set; }
    public bool AutomaticProcessing { get; private set; }
    public string? AutomaticProcessingWarning { get; private set; }

    public bool IsOpenEnded => IsRecurring && !EndDate.HasValue;
    public decimal TotalAmount => IsOpenEnded ? 0m : InstallmentAmount * TotalInstallments;

    // AllocatedAmount tracks the reserve still attached to unpaid installments.
    // Include paid installments here so overall coverage remains meaningful
    // throughout the full commitment lifecycle.
    public decimal TotalAllocatedAmount => PaidInstallments * InstallmentAmount + AllocatedAmount;

    public decimal OverallRemainingAmount => IsOpenEnded ? AmountNeededForNextInstallment : decimal.Max(TotalAmount - TotalAllocatedAmount, 0m);

    public decimal OverallCoveragePercentage => IsOpenEnded
        ? (InstallmentAmount <= 0m ? 0m : decimal.Min(AllocatedAmount / InstallmentAmount * 100m, 100m))
        : TotalAmount <= 0m ? 0m
        : decimal.Min(TotalAllocatedAmount / TotalAmount * 100m, 100m);

    public int RemainingInstallments => IsOpenEnded ? int.MaxValue : TotalInstallments - PaidInstallments;

    public decimal RemainingAmount => IsOpenEnded ? AmountNeededForNextInstallment : InstallmentAmount * RemainingInstallments;

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

    // For an open-ended commitment RemainingAmount already means the amount
    // missing from the current occurrence. Finite commitments expose the
    // amount due across all unpaid installments.
    public decimal AmountNeededForFullCoverage => IsOpenEnded
        ? AmountNeededForNextInstallment
        : decimal.Max(RemainingAmount - AllocatedAmount, 0m);

    public decimal ExcessAllocatedAmount => decimal.Max(AllocatedAmount - (IsOpenEnded ? InstallmentAmount : RemainingAmount), 0m);

    public bool IsCompleted => !IsOpenEnded && PaidInstallments == TotalInstallments;
    public ICollection<FinancialCommitmentOccurrence> Occurrences { get; private set; } = new List<FinancialCommitmentOccurrence>();

    public bool RequiresAttention => Urgent && !IsCompleted && OverallRemainingAmount > 0m;

    public void UpdateDetails(string name, decimal installmentAmount, int totalInstallments, int? priority, bool isFullyCommitted, Guid? categoryId, DateOnly? dueDate = null, string? objective = null, bool urgent = false, bool automaticProcessing = false)
    {
        ValidateName(name);
        ValidateInstallmentAmount(installmentAmount);
        ValidateTotalInstallments(totalInstallments);
        ValidatePriority(priority);

        if (totalInstallments < PaidInstallments)
        {
            throw new ArgumentException("Total installments cannot be less than paid installments.", nameof(totalInstallments));
        }

        if (dueDate.HasValue && PaidInstallments > 0 && dueDate.Value != DueDate)
        {
            throw new InvalidOperationException("The first due date cannot be changed after a payment has been registered.");
        }

        Name = name.Trim();
        InstallmentAmount = installmentAmount;
        TotalInstallments = totalInstallments;
        Priority = priority;
        IsFullyCommitted = isFullyCommitted;
        CategoryId = categoryId;
        DueDate = dueDate ?? DueDate;
        Objective = objective?.Trim();
        Urgent = urgent;
        AutomaticProcessing = automaticProcessing;
    }

    public void UpdateSchedule(string name, decimal amount, RecurringIncomeFrequency frequency, DateOnly firstDueDate, DateOnly? endDate,
        int? priority, bool isFullyCommitted, Guid? categoryId, string? objective = null, bool urgent = false, bool automaticProcessing = false)
    {
        ValidateName(name); ValidateInstallmentAmount(amount); ValidatePriority(priority);
        if (endDate < firstDueDate) throw new ArgumentException("End date cannot be before first due date.", nameof(endDate));
        if (PaidInstallments > 0 && firstDueDate != DueDate) throw new InvalidOperationException("The first due date cannot be changed after a payment has been registered.");
        Name = name.Trim(); InstallmentAmount = amount; Frequency = frequency; EndDate = frequency == RecurringIncomeFrequency.Once ? firstDueDate : endDate;
        IsRecurring = frequency != RecurringIncomeFrequency.Once; DueDate = firstDueDate; Priority = priority; IsFullyCommitted = isFullyCommitted;
        CategoryId = categoryId; Objective = objective?.Trim(); Urgent = urgent; AutomaticProcessing = automaticProcessing;
        if (!IsOpenEnded) TotalInstallments = RecurringScheduleServiceCount(firstDueDate, frequency, EndDate);
        else TotalInstallments = 0;
    }

    public void SetCategory(Guid? categoryId) => CategoryId = categoryId;

    public void Allocate(decimal amount)
    {
        ValidatePositiveAmount(amount, nameof(amount));
        if (amount > AmountNeededForFullCoverage)
        {
            throw new InvalidOperationException("A alocação não pode exceder o valor necessário para cobrir o compromisso.");
        }
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

    public decimal ReleaseAllAllocation()
    {
        var released = AllocatedAmount;
        AllocatedAmount = 0m;
        return released;
    }

    public decimal RegisterPayment()
    {
        if (IsCompleted)
        {
            throw new InvalidOperationException("All installments have already been paid.");
        }

        var paymentAmount = decimal.Min(InstallmentAmount, RemainingAmount);
        PaidInstallments++;
        AllocatedAmount = decimal.Max(0m, AllocatedAmount - paymentAmount);
        return paymentAmount;
    }

    public void SetAutomaticProcessingWarning(string? warning) => AutomaticProcessingWarning = warning;

    public void ReverseLatestPayment(decimal paymentAmount)
    {
        if (PaidInstallments == 0)
        {
            throw new InvalidOperationException("There are no payments to reverse.");
        }

        PaidInstallments--;
        AllocatedAmount += paymentAmount;
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

    private static int RecurringScheduleServiceCount(DateOnly start, RecurringIncomeFrequency frequency, DateOnly? end)
    {
        if (frequency == RecurringIncomeFrequency.Once) return 1;
        if (!end.HasValue) return 0;
        var count = 0;
        var current = start;
        while (current <= end.Value) { count++; current = RecurringScheduleService.Next(current, frequency, start.Day); }
        return count;
    }

    private static void ValidatePriority(int? priority)
    {
        if (priority is <= 0) throw new ArgumentOutOfRangeException(nameof(priority), "Priority must be greater than zero.");
    }

    private static void ValidatePositiveAmount(decimal amount, string parameterName)
    {
        if (amount <= 0) throw new ArgumentOutOfRangeException(parameterName, "Amount must be greater than zero.");
    }
}
