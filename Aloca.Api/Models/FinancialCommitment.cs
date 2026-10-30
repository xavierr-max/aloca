using Aloca.Api.Services;

namespace Aloca.Api.Models;

public sealed class FinancialCommitment
{
    private FinancialCommitment() { }

    public FinancialCommitment(string name, decimal installmentAmount, int totalInstallments, int paidInstallments,
        int? priority, DateOnly? dueDate = null, string? objective = null, bool urgent = false, bool automaticProcessing = false)
    {
        ValidateName(name); ValidateInstallmentAmount(installmentAmount); ValidateTotalInstallments(totalInstallments); ValidatePriority(priority);
        if (paidInstallments < 0 || paidInstallments > totalInstallments) throw new ArgumentOutOfRangeException(nameof(paidInstallments));
        Id = Guid.NewGuid(); Name = name.Trim(); InstallmentAmount = installmentAmount; TotalInstallments = totalInstallments;
        PaidInstallments = paidInstallments; Priority = priority; DueDate = dueDate ?? BusinessClock.Today(); Objective = objective?.Trim();
        Urgent = urgent; AutomaticProcessing = automaticProcessing; Frequency = totalInstallments == 1 ? RecurringIncomeFrequency.Once : RecurringIncomeFrequency.Monthly;
        EndDate = DueDate.AddMonths(totalInstallments - 1); IsRecurring = totalInstallments > 1;
    }

    public FinancialCommitment(string name, decimal amount, RecurringIncomeFrequency frequency, DateOnly firstDueDate, DateOnly? endDate,
        int? priority, string? objective = null, bool urgent = false, bool automaticProcessing = false)
    {
        ValidateName(name); ValidateInstallmentAmount(amount); ValidatePriority(priority);
        if (!Enum.IsDefined(frequency)) throw new ArgumentOutOfRangeException(nameof(frequency));
        if (endDate < firstDueDate) throw new ArgumentException("End date cannot be before first due date.", nameof(endDate));
        Id = Guid.NewGuid(); Name = name.Trim(); InstallmentAmount = amount; PaidInstallments = 0; Priority = priority; DueDate = firstDueDate;
        Frequency = frequency; EndDate = frequency == RecurringIncomeFrequency.Once ? firstDueDate : endDate; IsRecurring = frequency != RecurringIncomeFrequency.Once;
        TotalInstallments = EndDate.HasValue ? RecurringScheduleServiceCount(firstDueDate, frequency, EndDate) : 0; Objective = objective?.Trim(); Urgent = urgent; AutomaticProcessing = automaticProcessing;
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string Name { get; private set; } = null!;
    public decimal InstallmentAmount { get; private set; }
    public int TotalInstallments { get; private set; }
    public int PaidInstallments { get; private set; }
    public int? Priority { get; private set; }
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
    public ICollection<CommitmentPayment> CommitmentPayments { get; private set; } = new List<CommitmentPayment>();
    public ICollection<FinancialCommitmentOccurrence> Occurrences { get; private set; } = new List<FinancialCommitmentOccurrence>();
    public decimal TotalPaidAmount => CommitmentPayments.Where(x => !x.IsReversed).Sum(x => x.Amount);
    public int RemainingInstallments => IsOpenEnded ? int.MaxValue : Math.Max(0, TotalInstallments - PaidInstallments);
    public decimal RemainingAmount => IsOpenEnded ? (PaidInstallments == 0 ? InstallmentAmount : InstallmentAmount) : InstallmentAmount * RemainingInstallments;
    public bool IsCompleted => !IsOpenEnded && PaidInstallments == TotalInstallments;
    public decimal OverallRemainingAmount => IsOpenEnded ? InstallmentAmount : Math.Max(0m, TotalAmount - TotalPaidAmount);
    public bool RequiresAttention => Urgent && !IsCompleted && OverallRemainingAmount > 0m;

    public void UpdateDetails(string name, decimal installmentAmount, int totalInstallments, int? priority, Guid? categoryId, DateOnly? dueDate = null, string? objective = null, bool urgent = false, bool automaticProcessing = false)
    {
        ValidateName(name); ValidateInstallmentAmount(installmentAmount); ValidateTotalInstallments(totalInstallments); ValidatePriority(priority);
        if (totalInstallments < PaidInstallments) throw new ArgumentException("Total installments cannot be less than paid installments.", nameof(totalInstallments));
        if (dueDate.HasValue && PaidInstallments > 0 && dueDate.Value != DueDate) throw new InvalidOperationException("The first due date cannot be changed after a payment has been registered.");
        Name = name.Trim(); InstallmentAmount = installmentAmount; TotalInstallments = totalInstallments; Priority = priority; CategoryId = categoryId; DueDate = dueDate ?? DueDate; Objective = objective?.Trim(); Urgent = urgent; AutomaticProcessing = automaticProcessing;
    }

    public void UpdateSchedule(string name, decimal amount, RecurringIncomeFrequency frequency, DateOnly firstDueDate, DateOnly? endDate, int? priority, Guid? categoryId, string? objective = null, bool urgent = false, bool automaticProcessing = false)
    {
        ValidateName(name); ValidateInstallmentAmount(amount); ValidatePriority(priority); if (endDate < firstDueDate) throw new ArgumentException("End date cannot be before first due date.", nameof(endDate));
        if (PaidInstallments > 0 && firstDueDate != DueDate) throw new InvalidOperationException("The first due date cannot be changed after a payment has been registered.");
        Name = name.Trim(); InstallmentAmount = amount; Frequency = frequency; EndDate = frequency == RecurringIncomeFrequency.Once ? firstDueDate : endDate; IsRecurring = frequency != RecurringIncomeFrequency.Once; DueDate = firstDueDate; Priority = priority; CategoryId = categoryId; Objective = objective?.Trim(); Urgent = urgent; AutomaticProcessing = automaticProcessing; TotalInstallments = IsOpenEnded ? 0 : RecurringScheduleServiceCount(firstDueDate, frequency, EndDate);
    }

    public void SetCategory(Guid? categoryId) => CategoryId = categoryId;
    public decimal RegisterPayment() { if (IsCompleted) throw new InvalidOperationException("All installments have already been paid."); PaidInstallments++; return InstallmentAmount; }
    public void SetAutomaticProcessingWarning(string? warning) => AutomaticProcessingWarning = warning;
    public void ReverseLatestPayment(decimal paymentAmount) { if (PaidInstallments == 0) throw new InvalidOperationException("There are no payments to reverse."); PaidInstallments--; }

    private static void ValidateName(string name) { if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Commitment name is required.", nameof(name)); }
    private static void ValidateInstallmentAmount(decimal amount) { if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount)); }
    private static void ValidateTotalInstallments(int total) { if (total <= 0) throw new ArgumentOutOfRangeException(nameof(total)); }
    private static void ValidatePriority(int? priority) { if (priority is <= 0) throw new ArgumentOutOfRangeException(nameof(priority)); }
    private static int RecurringScheduleServiceCount(DateOnly start, RecurringIncomeFrequency frequency, DateOnly? end) { if (frequency == RecurringIncomeFrequency.Once) return 1; if (!end.HasValue) return 0; var count = 0; var current = start; while (current <= end.Value) { count++; current = RecurringScheduleService.Next(current, frequency, start.Day); } return count; }
}
